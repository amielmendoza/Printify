import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { requireUser } from "@/lib/auth"
import { downloadFile, uploadFile } from "@/lib/storage"

const PIAPI_KEY = process.env.PIAPI_KEY
const PIAPI_URL = "https://api.piapi.ai/api/v1/task"

// Persistent cache: processed transparent PNGs are stored in the photos bucket
// under this prefix, keyed by the SHA-256 of the source image. A given photo is
// therefore sent to PiAPI at most once, ever — across previews, reloads, batch
// runs and users — which is what keeps credit usage minimal.
const CACHE_PREFIX = "nobg"

// Simple per-user, in-memory rate limit to avoid burning PiAPI credits.
const RATE_LIMIT = 60 // requests
const RATE_WINDOW = 60 * 1000 // per minute
const hits = new Map<string, number[]>()

function rateLimited(userId: string): boolean {
  const now = Date.now()
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW)
  recent.push(now)
  hits.set(userId, recent)
  return recent.length > RATE_LIMIT
}

function pngResponse(data: ArrayBuffer | Uint8Array, cached: boolean): NextResponse {
  return new NextResponse(data as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      "X-BG-Cache": cached ? "hit" : "miss",
    },
  })
}

/**
 * Background removal via PiAPI (RMBG-2.0), with a persistent content-addressed
 * cache in Supabase Storage so each unique photo only ever costs one credit.
 */
export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let imageBytes: ArrayBuffer
  try {
    imageBytes = await request.arrayBuffer()
  } catch {
    return NextResponse.json({ error: "No image provided" }, { status: 400 })
  }
  if (!imageBytes || imageBytes.byteLength === 0) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 })
  }

  // 1) Serve from the persistent cache if we've processed this exact photo before.
  const hash = createHash("sha256").update(Buffer.from(imageBytes)).digest("hex")
  const cachePath = `${CACHE_PREFIX}/${hash}.png`
  try {
    const cached = await downloadFile("photos", cachePath)
    if (cached && cached.byteLength > 0) {
      return pngResponse(cached, true)
    }
  } catch {
    // cache lookup failure -> fall through to processing
  }

  // 2) Not cached — this is the only path that spends a credit. Rate-limit it.
  if (rateLimited(user.id)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }
  if (!PIAPI_KEY) {
    return NextResponse.json({ error: "PiAPI key not configured" }, { status: 500 })
  }

  const contentType = request.headers.get("content-type") || "image/jpeg"
  let png: ArrayBuffer
  try {
    png = await piApiRemove(imageBytes, contentType)
  } catch (err) {
    console.error("Background removal error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "Background removal failed" }, { status: 502 })
  }

  // 3) Save to the cache for next time (best-effort; never block the response).
  uploadFile("photos", cachePath, png, "image/png", true).catch((e) =>
    console.warn("Failed to cache no-bg result:", e instanceof Error ? e.message : e)
  )

  return pngResponse(png, false)
}

// --- PiAPI ----------------------------------------------------------------

async function piApiRemove(imageBytes: ArrayBuffer, contentType: string): Promise<ArrayBuffer> {
  const base64 = Buffer.from(imageBytes).toString("base64")
  const dataUrl = `data:${contentType};base64,${base64}`

  const res = await fetch(PIAPI_URL, {
    method: "POST",
    headers: { "x-api-key": PIAPI_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "Qubico/image-toolkit",
      task_type: "background-remove",
      input: { image: dataUrl, rmbg_model: "RMBG-2.0" },
    }),
  })
  if (!res.ok) {
    throw new Error(`piapi ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }

  const result = await res.json()
  const taskId = result.data?.task_id
  if (!taskId) throw new Error("piapi: no task_id")
  if (result.data.status === "completed") {
    return downloadResult(result.data.output)
  }
  return pollTask(taskId)
}

async function pollTask(taskId: string): Promise<ArrayBuffer> {
  const MAX_POLLS = 30
  const POLL_INTERVAL = 2000
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))
    const res = await fetch(`${PIAPI_URL}/${taskId}`, { headers: { "x-api-key": PIAPI_KEY! } })
    if (!res.ok) continue
    const result = await res.json()
    const status = result.data?.status
    if (status === "completed") return downloadResult(result.data.output)
    if (status === "failed") {
      throw new Error(`piapi task failed: ${JSON.stringify(result.data?.error ?? {}).slice(0, 200)}`)
    }
  }
  throw new Error("piapi: timed out")
}

async function downloadResult(output: Record<string, string>): Promise<ArrayBuffer> {
  if (output?.image_url) {
    const imgRes = await fetch(output.image_url)
    if (imgRes.ok) return imgRes.arrayBuffer()
  }
  if (output?.image_base64) {
    return Buffer.from(output.image_base64, "base64").buffer as ArrayBuffer
  }
  throw new Error("piapi: no result image")
}

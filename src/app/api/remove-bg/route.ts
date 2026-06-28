import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"

const PIAPI_KEY = process.env.PIAPI_KEY
const PIAPI_URL = "https://api.piapi.ai/api/v1/task"

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

/**
 * Background removal via PiAPI (RMBG-2.0 model).
 * $0.001 per image. Returns transparent PNG.
 */
export async function POST(request: NextRequest) {
  // Require authentication
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (rateLimited(user.id)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  if (!PIAPI_KEY) {
    return NextResponse.json({ error: "PiAPI key not configured" }, { status: 500 })
  }

  try {
    const imageBytes = await request.arrayBuffer()
    if (!imageBytes || imageBytes.byteLength === 0) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    // Convert to base64 data URL for PiAPI
    const contentType = request.headers.get("content-type") || "image/jpeg"
    const base64 = Buffer.from(imageBytes).toString("base64")
    const dataUrl = `data:${contentType};base64,${base64}`

    // Create task
    const res = await fetch(PIAPI_URL, {
      method: "POST",
      headers: {
        "x-api-key": PIAPI_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "Qubico/image-toolkit",
        task_type: "background-remove",
        input: {
          image: dataUrl,
          rmbg_model: "RMBG-2.0",
        },
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error("PiAPI error:", res.status, errorText)
      return NextResponse.json({ error: "Background removal failed" }, { status: res.status })
    }

    const result = await res.json()
    const taskId = result.data?.task_id

    if (!taskId) {
      console.error("PiAPI no task_id:", JSON.stringify(result).slice(0, 300))
      return NextResponse.json({ error: "Background removal failed" }, { status: 502 })
    }

    // If already completed
    if (result.data.status === "completed") {
      return downloadResult(result.data.output)
    }

    // Poll for completion
    return await pollTask(taskId)
  } catch (err) {
    console.error("Background removal error:", err)
    return NextResponse.json({ error: "Background removal failed" }, { status: 500 })
  }
}

async function pollTask(taskId: string): Promise<NextResponse> {
  const MAX_POLLS = 30
  const POLL_INTERVAL = 2000

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))

    const res = await fetch(`${PIAPI_URL}/${taskId}`, {
      headers: { "x-api-key": PIAPI_KEY! },
    })

    if (!res.ok) continue

    const result = await res.json()
    const status = result.data?.status

    if (status === "completed") {
      return downloadResult(result.data.output)
    }

    if (status === "failed") {
      console.error("PiAPI task failed:", JSON.stringify(result.data).slice(0, 300))
      return NextResponse.json({ error: "Background removal failed" }, { status: 502 })
    }
  }

  return NextResponse.json({ error: "Background removal timed out" }, { status: 504 })
}

async function downloadResult(output: Record<string, string>): Promise<NextResponse> {
  // Prefer direct image URL download
  if (output.image_url) {
    const imgRes = await fetch(output.image_url)
    if (imgRes.ok) {
      const buffer = await imgRes.arrayBuffer()
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      })
    }
  }

  // Fallback: base64
  if (output.image_base64) {
    const buffer = Buffer.from(output.image_base64, "base64")
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    })
  }

  return NextResponse.json({ error: "No result image" }, { status: 502 })
}

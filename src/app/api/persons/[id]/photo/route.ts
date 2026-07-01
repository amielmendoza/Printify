import { NextRequest, NextResponse } from "next/server"
import { getExternalCreds } from "@/lib/auth"
import { getExternalPersonById } from "@/lib/external-api"
import { downloadFile, uploadFile } from "@/lib/storage"

// Returns a person's photo. To avoid re-downloading the whole-school evesms
// payload on every request (the in-memory cache doesn't survive serverless cold
// starts), each photo is cached in Supabase Storage on first fetch and served
// from there afterwards.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const creds = await getExternalCreds(request)
  if (!creds) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { extToken: token, schoolId } = creds
  if (!token || !schoolId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // ID format is "schoolPersonID-index"; the numeric part identifies the photo.
  const schoolPersonId = id.split("-")[0]
  const cachePath = `ext/${schoolId}/${schoolPersonId}.jpg`

  const headers = { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" }

  // 1) Serve from the Storage cache if we've fetched this photo before.
  try {
    const cached = await downloadFile("photos", cachePath)
    if (cached && cached.byteLength > 0) {
      return new NextResponse(cached as BodyInit, { headers })
    }
  } catch {
    // cache miss / lookup error -> fall through to the external API
  }

  // 2) Fetch from the external API (pulls the school payload), then cache it.
  const person = await getExternalPersonById(token, schoolId, schoolPersonId)
  if (!person?.picture) {
    return new NextResponse(null, { status: 404 })
  }

  const imageBuffer = Buffer.from(person.picture, "base64")

  // Best-effort cache write; never block the response on it.
  uploadFile("photos", cachePath, imageBuffer, "image/jpeg", true).catch(() => {})

  return new NextResponse(new Uint8Array(imageBuffer), { headers })
}

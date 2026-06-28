import { NextRequest, NextResponse } from "next/server"
import { getExternalCreds } from "@/lib/auth"
import { getExternalPersonById } from "@/lib/external-api"

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

  // ID format is "schoolPersonID-index", extract the numeric part
  const schoolPersonId = id.split("-")[0]
  const person = await getExternalPersonById(token, schoolId, schoolPersonId)

  if (!person?.picture) {
    return new NextResponse(null, { status: 404 })
  }

  // Decode base64 to binary
  const imageBuffer = Buffer.from(person.picture, "base64")

  return new NextResponse(new Uint8Array(imageBuffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  })
}

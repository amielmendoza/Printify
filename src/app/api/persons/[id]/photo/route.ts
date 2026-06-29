import { NextRequest, NextResponse } from "next/server"
import { getExternalCreds } from "@/lib/auth"
import { getExternalPersonById } from "@/lib/external-api"

// Minimal JPEG/PNG dimension reader (no deps). Returns null if unrecognized.
function readImageSize(buf: Buffer): { w: number; h: number } | null {
  // PNG: width/height are big-endian uint32 at offsets 16/20.
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }
  // JPEG: scan for a Start-Of-Frame marker.
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off++
        continue
      }
      const marker = buf[off + 1]
      const isSOF =
        marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
      if (isSOF) {
        return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) }
      }
      off += 2 + buf.readUInt16BE(off + 2)
    }
  }
  return null
}

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

  // TEMP DIAGNOSTIC: log the source photo's real dimensions so we can tell
  // whether blur comes from the source or from our rendering. Remove later.
  const dims = readImageSize(imageBuffer)
  console.log(
    `[photo-size] person=${schoolPersonId} bytes=${imageBuffer.length} dims=${
      dims ? `${dims.w}x${dims.h}` : "unknown"
    }`
  )

  return new NextResponse(new Uint8Array(imageBuffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  })
}

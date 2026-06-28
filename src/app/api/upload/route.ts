import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { uploadFile, type BucketName } from "@/lib/storage"

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!user.orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const bucket = formData.get("bucket") as string | null

  if (!file || !bucket) {
    return NextResponse.json({ error: "Missing file or bucket" }, { status: 400 })
  }

  if (!["templates", "photos"].includes(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 })
  }

  const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "pdf"]
  const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: `File type .${ext} not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(", ")}` }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum 20 MB." }, { status: 400 })
  }

  const MIME_MAP: Record<string, string[]> = {
    jpg: ["image/jpeg"], jpeg: ["image/jpeg"], png: ["image/png"],
    gif: ["image/gif"], webp: ["image/webp"], pdf: ["application/pdf"],
  }
  if (!MIME_MAP[ext]?.includes(file.type)) {
    return NextResponse.json({ error: "File extension does not match content type" }, { status: 400 })
  }

  const blobName = `${user.orgId}/${crypto.randomUUID()}.${ext}`

  try {
    const bytes = await file.arrayBuffer()
    await uploadFile(bucket as BucketName, blobName, bytes, file.type)
    // Return the blob name (path within the bucket), matching the prior shape.
    return NextResponse.json({ path: blobName })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    )
  }
}

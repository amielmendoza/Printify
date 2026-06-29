import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { getSignedUrl } from "@/lib/storage"

// Mints a short-lived signed URL for a stored blob in Supabase Storage.
// Requires authentication.
export async function GET(request: NextRequest) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const bucket = searchParams.get("bucket")
  const path = searchParams.get("path")

  if (!bucket || !path) {
    return NextResponse.json({ error: "Missing bucket or path" }, { status: 400 })
  }
  if (!["templates", "photos"].includes(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 })
  }

  try {
    const url = await getSignedUrl(`${bucket}/${path}`)
    return NextResponse.json({ url })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to mint URL" },
      { status: 500 }
    )
  }
}

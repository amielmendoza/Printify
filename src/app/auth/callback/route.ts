import { NextResponse } from "next/server"

// OAuth callback is no longer used (auth is via credentials/external API).
// Kept as a safe redirect for any stale links.
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const next = searchParams.get("next") ?? "/"
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/"
  return NextResponse.redirect(`${origin}${safeNext}`)
}

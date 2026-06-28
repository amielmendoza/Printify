import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// Lightweight DB health check. (Azure SQL does not pause like Supabase free
// tier, so the keep-alive cron is no longer strictly necessary — this remains
// a harmless liveness probe.)
export async function GET() {
  try {
    await prisma.organization.count()
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 }
    )
  }
}

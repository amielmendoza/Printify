import { NextRequest, NextResponse } from "next/server"
import { getExternalCreds } from "@/lib/auth"
import { getExternalPersons } from "@/lib/external-api"

// Forces a fresh pull of the roster from evesms (bypasses the in-memory cache
// and repopulates it), so the whole app sees the latest people, details, and
// fields on their next read. Triggered from Settings → Data → Refresh.
export async function POST(request: NextRequest) {
  const creds = await getExternalCreds(request)
  if (!creds) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { extToken: token, schoolId } = creds
  if (!token || !schoolId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const persons = await getExternalPersons(token, schoolId, true)
  if (!persons) {
    return NextResponse.json({ error: "Failed to refresh from evesms" }, { status: 502 })
  }

  return NextResponse.json({ ok: true, count: persons.length })
}

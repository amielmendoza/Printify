import { NextRequest, NextResponse } from "next/server"
import { getExternalCreds } from "@/lib/auth"
import { getExternalPersons } from "@/lib/external-api"

// Internal / image / id-only fields that shouldn't be offered as printable text.
const EXCLUDE = new Set(
  [
    "picture", "signature", "pictureId", "signatureId", "schoolPersonId",
    "schoolId", "personId", "parentUserId", "hasFetcher", "hasEsc",
  ].map((s) => s.toLowerCase())
)

// Curated/computed fields shown first (nicer formatting than the raw keys).
const CURATED = [
  { value: "full_name", label: "Full Name" },
  { value: "id_number", label: "ID Number (LRN)" },
  { value: "grade_section", label: "Grade & Section" },
]

const ACRONYMS = /\b(id|lrn|rfid|tin|sss|esc|qr|sy)\b/gi

function humanize(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .trim()
  const titled = spaced.charAt(0).toUpperCase() + spaced.slice(1)
  return titled.replace(ACRONYMS, (m) => m.toUpperCase())
}

// Returns the list of person fields that can be placed on a template. Derived
// live from an evesms record, so newly-added API fields appear automatically.
export async function GET(request: NextRequest) {
  const creds = await getExternalCreds(request)
  if (!creds) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { extToken: token, schoolId } = creds
  if (!token || !schoolId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const persons = await getExternalPersons(token, schoolId)
  const sample = persons?.[0] as Record<string, unknown> | undefined

  const rawFields = sample
    ? Object.keys(sample)
        .filter((k) => !EXCLUDE.has(k.toLowerCase()))
        .map((k) => ({ value: k, label: humanize(k) }))
    : []

  // Prepend curated fields; drop raw duplicates of what curated already covers.
  const curatedRawKeys = new Set(["firstName", "lastName", "gradeLevelSection", "lrn"])
  const fields = [
    ...CURATED,
    ...rawFields.filter((f) => !curatedRawKeys.has(f.value)),
  ]

  return NextResponse.json({ fields })
}

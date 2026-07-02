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

// Known GetAll_V2 fields, always shown even when null for everyone (evesms omits
// null fields per record, so they can't be discovered dynamically). Field values
// are resolved case-insensitively, so exact JSON key casing doesn't matter here.
const BASELINE = [
  { value: "fullName1", label: "Full Name (format 1)" },
  { value: "fullName2", label: "Full Name (format 2)" },
  { value: "firstName", label: "First Name" },
  { value: "middleName", label: "Middle Name" },
  { value: "lastName", label: "Last Name" },
  { value: "personType", label: "Person Type" },
  { value: "qrCode", label: "QR Code" },
  { value: "rfid", label: "RFID" },
  { value: "referenceNumber", label: "Reference Number" },
  { value: "gradeLevel", label: "Grade Level" },
  { value: "program", label: "Program" },
  { value: "section", label: "Section" },
  { value: "designation", label: "Designation" },
  { value: "classAdvisory", label: "Class Advisory" },
  { value: "department", label: "Department" },
  { value: "notifLabel", label: "Notification Label" },
  { value: "birthDate", label: "Birth Date" },
  { value: "bloodType", label: "Blood Type" },
  { value: "schoolYearLabel", label: "School Year" },
  { value: "tinNumber", label: "TIN Number" },
  { value: "sssNumber", label: "SSS Number" },
  { value: "philhealthNumber", label: "PhilHealth Number" },
  { value: "pagIbigNumber", label: "Pag-IBIG Number" },
  { value: "escNumber", label: "ESC Number" },
  { value: "catCode1", label: "Category Code 1" },
  { value: "catCode2", label: "Category Code 2" },
  { value: "catCode3", label: "Category Code 3" },
  { value: "emergencyContactPerson", label: "Emergency Contact Person" },
  { value: "emergencyContactNumber", label: "Emergency Contact Number" },
  { value: "emergencyRelationship", label: "Emergency Relationship" },
  { value: "fullAddress", label: "Full Address" },
]

// Raw keys already represented by a curated/baseline entry — don't duplicate.
const COVERED = new Set(
  [...CURATED, ...BASELINE].map((f) => f.value.toLowerCase()).concat(["lrn", "gradelevelsection"])
)

const ACRONYMS = /\b(id|lrn|rfid|tin|sss|esc|qr|sy)\b/gi

function humanize(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .trim()
  const titled = spaced.charAt(0).toUpperCase() + spaced.slice(1)
  return titled.replace(ACRONYMS, (m) => m.toUpperCase())
}

// Returns the fields that can be placed on a template: curated + the full known
// schema (always present) + any extra fields the API returns (auto-discovered).
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

  // Any extra keys the API returns that aren't already covered (future fields).
  const extra: { value: string; label: string }[] = []
  const seen = new Set<string>()
  for (const p of persons ?? []) {
    for (const k of Object.keys(p as unknown as Record<string, unknown>)) {
      const lk = k.toLowerCase()
      if (EXCLUDE.has(lk) || COVERED.has(lk) || seen.has(lk)) continue
      seen.add(lk)
      extra.push({ value: k, label: humanize(k) })
    }
  }

  return NextResponse.json({ fields: [...CURATED, ...BASELINE, ...extra] })
}

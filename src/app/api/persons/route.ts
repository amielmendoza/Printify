import { NextRequest, NextResponse } from "next/server"
import { getExternalCreds } from "@/lib/auth"
import { getExternalPersons } from "@/lib/external-api"

export async function GET(request: NextRequest) {
  const creds = await getExternalCreds(request)
  if (!creds) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { extToken: token, schoolId } = creds
  if (!token || !schoolId) {
    return NextResponse.json({ error: "Not authenticated with external API" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")?.toLowerCase()
  const personType = searchParams.get("type")

  const externalPersons = await getExternalPersons(token, schoolId)
  if (!externalPersons) {
    return NextResponse.json({ error: "Failed to fetch persons" }, { status: 502 })
  }

  // Map to our format WITHOUT base64 photos (too large for list)
  // Use index suffix to guarantee unique IDs (some schoolPersonIDs are duplicated)
  let persons = externalPersons.map((ext, idx) => ({
    id: `${ext.schoolPersonID}-${idx}`,
    organization_id: String(ext.schoolID),
    first_name: ext.firstName.trim(),
    last_name: ext.lastName.trim(),
    middle_name: ext.middleName?.trim() || null,
    photo_path: null as string | null,
    photo_base64: null as string | null,
    has_photo: !!ext.picture,
    person_type: ext.personType.toLowerCase() as string,
    category: ext.gradeLevelSection || ext.department || null,
    id_number: ext.lrn || ext.referenceNumber || null,
    email: null as string | null,
    phone: null as string | null,
    metadata: {
      schoolPersonID: ext.schoolPersonID,
      qrCode: ext.qrCode,
      rfid: ext.rfid,
      gradeLevel: ext.gradeLevel,
      section: ext.section,
      designation: ext.designation,
      birthDate: ext.birthDate,
      department: ext.department,
      schoolYearLabel: ext.schoolYearLabel,
      emergencyContactPerson: ext.emergencyContactPerson,
      emergencyContactNumber: ext.emergencyContactNumber,
      emergencyRelationship: ext.emergencyRelationship,
      fullAddress: ext.fullAddress,
    },
    is_active: true,
    created_at: "",
    updated_at: "",
  }))

  // Apply filters
  if (personType && personType !== "all") {
    persons = persons.filter((p) => p.person_type === personType.toLowerCase())
  }

  if (search) {
    persons = persons.filter(
      (p) =>
        p.first_name.toLowerCase().includes(search) ||
        p.last_name.toLowerCase().includes(search) ||
        (p.id_number && p.id_number.toLowerCase().includes(search))
    )
  }

  // Sort by last name
  persons.sort((a, b) => a.last_name.localeCompare(b.last_name))

  // Collect distinct grade levels and sections for filter dropdowns
  const gradeLevels = [...new Set(externalPersons.map((p) => p.gradeLevel).filter(Boolean))].sort()
  const sections = [...new Set(externalPersons.map((p) => p.section).filter(Boolean))].sort()

  return NextResponse.json({ persons, total: persons.length, gradeLevels, sections })
}

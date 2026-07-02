const EXTERNAL_API_BASE = "https://evesms.com/qrscanner/api"

export interface ExternalPerson {
  schoolPersonID: number
  schoolID: number
  personID: number
  fullName1: string
  fullName2: string
  firstName: string
  middleName: string
  lastName: string
  personType: string
  qrCode: string
  rfid: string
  pictureID: number
  picture: string | null
  referenceNumber: string
  lrn: string
  gradeLevel: string
  section: string
  gradeLevelSection: string
  designation: string
  birthDate: string
  signatureID: number
  signature: string | null
  department: string
  schoolYearLabel: string
  parentUserID: number
  fullAddress: string
  emergencyContactPerson: string
  emergencyContactNumber: string
  emergencyRelationship: string
}

// In-memory cache of the whole roster (with photos) so we don't re-fetch it on
// every request. There is NO timed expiry — it's refreshed only on demand
// (force=true), i.e. when the user hits the app's Refresh button.
const cache = new Map<string, ExternalPerson[]>()

export async function getExternalPersons(
  token: string,
  schoolId: string,
  force = false
): Promise<ExternalPerson[] | null> {
  const cacheKey = `persons-${schoolId}`
  if (!force) {
    const cached = cache.get(cacheKey)
    if (cached) return cached
  }

  const res = await fetch(`${EXTERNAL_API_BASE}/Person/GetAll_V2/${schoolId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: "*/*",
    },
  })

  if (!res.ok) return null

  const data: ExternalPerson[] = await res.json()
  cache.set(cacheKey, data)
  return data
}

export function getExternalPersonById(
  token: string,
  schoolId: string,
  personId: string
): Promise<ExternalPerson | null> {
  return getExternalPersons(token, schoolId).then(
    (persons) => persons?.find((p) => String(p.schoolPersonID) === personId) ?? null
  )
}


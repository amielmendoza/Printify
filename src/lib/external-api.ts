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

// In-memory cache to avoid re-fetching 1200+ persons with photos repeatedly
const cache = new Map<string, { data: ExternalPerson[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getExternalPersons(
  token: string,
  schoolId: string
): Promise<ExternalPerson[] | null> {
  const cacheKey = `persons-${schoolId}`
  const cached = cache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const res = await fetch(`${EXTERNAL_API_BASE}/Person/GetAll_V2/${schoolId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: "*/*",
    },
  })

  if (!res.ok) return null

  const data: ExternalPerson[] = await res.json()
  cache.set(cacheKey, { data, timestamp: Date.now() })
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


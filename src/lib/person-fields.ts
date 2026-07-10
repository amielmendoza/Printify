import type { Person } from "@/lib/types"

// Resolves a template placeholder's data field to a person's display value.
// Shared by the canvas renderer (what's drawn on the card) and the sign-off
// report (which must show the same values the card will print).
export function getPersonFieldValue(
  person: Person,
  field: string | undefined,
  label: string
): string {
  const meta = person.metadata as Record<string, unknown> | null

  // Case-insensitive read of a metadata value, coerced to a display string.
  const metaStr = (key: string): string => {
    if (!meta) return ""
    let v = meta[key]
    if (v === undefined) {
      const lower = key.toLowerCase()
      const match = Object.keys(meta).find((k) => k.toLowerCase() === lower)
      if (match) v = meta[match]
    }
    return v == null ? "" : String(v)
  }

  if (field) {
    switch (field) {
      case "full_name":
        return `${person.first_name} ${person.last_name}`.trim()
      case "first_name":
        return person.first_name
      case "middle_name":
        return person.middle_name ?? ""
      case "last_name":
        return person.last_name
      case "id_number":
        return person.id_number ? `LRN: ${person.id_number}` : ""
      case "person_type":
        return person.person_type.charAt(0).toUpperCase() + person.person_type.slice(1)
      case "category":
        return person.category ?? ""
      case "grade_level":
        return metaStr("gradeLevel")
      case "section":
        return metaStr("section")
      case "grade_section":
        return metaStr("gradeLevelSection") || [metaStr("gradeLevel"), metaStr("section")].filter(Boolean).join(" ")
      case "department":
        return metaStr("department")
      case "designation":
        return metaStr("designation")
      case "birth_date":
        return metaStr("birthDate")
      case "school_year":
        return metaStr("schoolYearLabel")
      case "rfid":
        return metaStr("rfid")
      case "emergency_name":
        return metaStr("emergencyContactPerson")
      case "emergency_contact":
        return metaStr("emergencyContactNumber")
      case "emergency_relationship":
        return metaStr("emergencyRelationship")
      case "emergency_address":
        return metaStr("fullAddress")
      case "fullname1":
        return metaStr("fullName1")
      case "fullname2":
        return metaStr("fullName2")
      case "reference_number":
        return metaStr("referenceNumber")
      case "program":
        return metaStr("program")
      case "class_advisory":
        return metaStr("classAdvisory")
      case "blood_type":
        return metaStr("bloodType")
      case "tin":
        return metaStr("tinNumber")
      case "sss":
        return metaStr("sssNumber")
      case "philhealth":
        return metaStr("philhealthNumber")
      case "pagibig":
        return metaStr("pagIbigNumber")
      case "esc_number":
        return metaStr("escNumber")
      case "notif_label":
        return metaStr("notifLabel")
      case "cat_code1":
        return metaStr("catCode1")
      case "cat_code2":
        return metaStr("catCode2")
      case "cat_code3":
        return metaStr("catCode3")
      default:
        // Dynamic: any raw evesms field key (e.g. "gradeLevel", "tinNumber"),
        // so newly-added API fields work without code changes.
        return metaStr(field)
    }
  }

  // No field mapped — use the label as static text
  return label
}

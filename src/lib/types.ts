// Domain types — the stable shape the application (components, hooks, API
// responses) consumes. These intentionally mirror the previous Supabase-
// generated types so UI code did not have to change during the SQL Server
// migration: dates are ISO strings and the former jsonb columns are exposed
// parsed (placeholders as an array, metadata/render_state as objects).
//
// Prisma's raw row types differ (Date objects, JSON stored as string). The data
// layer in src/lib/db.ts maps Prisma rows to these domain types at the boundary.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type PersonType = "student" | "faculty" | "staff" | "visitor" | "other"

export interface PlaceholderStyle {
  fontSize?: number
  fontWeight?: string
  fontFamily?: string
  color?: string
  textAlign?: string
}

export interface Placeholder {
  id: string
  type: "photo" | "text" | "qrcode"
  label: string
  x: number
  y: number
  width: number
  height: number
  style?: PlaceholderStyle
  field?: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string | null
  full_name: string | null
  role: string
  created_at: string
  updated_at: string
}

export interface Template {
  id: string
  organization_id: string
  name: string
  description: string | null
  file_path: string
  file_type: string
  width_inches: number
  height_inches: number
  placeholders: Json
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Person = {
  id: string
  organization_id: string
  first_name: string
  last_name: string
  middle_name: string | null
  photo_path: string | null
  person_type: string
  category: string | null
  id_number: string | null
  email: string | null
  phone: string | null
  metadata: Json
  is_active: boolean
  created_at: string
  updated_at: string
  photo_base64?: string | null
}

export interface IdCard {
  id: string
  organization_id: string
  person_id: string
  template_id: string
  render_state: Json | null
  exported_pdf_path: string | null
  status: string
  valid_from: string | null
  valid_until: string | null
  created_at: string
  updated_at: string
}

export interface PrintLog {
  id: string
  organization_id: string | null
  person_external_id: string
  person_name: string
  template_id: string | null
  template_name: string | null
  action: string
  created_at: string
}

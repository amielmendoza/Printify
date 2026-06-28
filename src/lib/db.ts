import { PrismaClient } from "@prisma/client"
import type {
  Organization as PrismaOrganization,
  Profile as PrismaProfile,
  Template as PrismaTemplate,
  Person as PrismaPerson,
  IdCard as PrismaIdCard,
  PrintLog as PrismaPrintLog,
} from "@prisma/client"
import type {
  Organization,
  Profile,
  Template,
  Person,
  IdCard,
  PrintLog,
  Json,
} from "@/lib/types"

// Prisma client singleton — avoids exhausting connections during dev hot-reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

// ---------------------------------------------------------------------------
// Mappers: Prisma rows -> domain types (src/lib/types.ts).
// Prisma returns Date objects and stores former jsonb columns as JSON strings;
// the rest of the app expects ISO-string dates and parsed JSON. Convert here.
// ---------------------------------------------------------------------------

const iso = (d: Date | null | undefined): string =>
  d instanceof Date ? d.toISOString() : (d ?? "")

const isoOrNull = (d: Date | null | undefined): string | null =>
  d instanceof Date ? d.toISOString() : null

function parseJson(value: string | null | undefined, fallback: Json): Json {
  if (value == null) return fallback
  try {
    return JSON.parse(value) as Json
  } catch {
    return fallback
  }
}

export function mapOrganization(o: PrismaOrganization): Organization {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    logo_url: o.logo_url,
    created_at: iso(o.created_at),
    updated_at: iso(o.updated_at),
  }
}

export function mapProfile(p: PrismaProfile): Profile {
  return {
    id: p.id,
    organization_id: p.organization_id,
    full_name: p.full_name,
    role: p.role,
    created_at: iso(p.created_at),
    updated_at: iso(p.updated_at),
  }
}

export function mapTemplate(t: PrismaTemplate): Template {
  return {
    id: t.id,
    organization_id: t.organization_id,
    name: t.name,
    description: t.description,
    file_path: t.file_path,
    file_type: t.file_type,
    width_inches: t.width_inches,
    height_inches: t.height_inches,
    placeholders: parseJson(t.placeholders, []),
    is_active: t.is_active,
    created_at: iso(t.created_at),
    updated_at: iso(t.updated_at),
  }
}

export function mapPerson(p: PrismaPerson): Person {
  return {
    id: p.id,
    organization_id: p.organization_id,
    first_name: p.first_name,
    last_name: p.last_name,
    middle_name: p.middle_name,
    photo_path: p.photo_path,
    person_type: p.person_type,
    category: p.category,
    id_number: p.id_number,
    email: p.email,
    phone: p.phone,
    metadata: parseJson(p.metadata, {}),
    is_active: p.is_active,
    created_at: iso(p.created_at),
    updated_at: iso(p.updated_at),
  }
}

export function mapIdCard(c: PrismaIdCard): IdCard {
  return {
    id: c.id,
    organization_id: c.organization_id,
    person_id: c.person_id,
    template_id: c.template_id,
    render_state: c.render_state ? parseJson(c.render_state, null) : null,
    exported_pdf_path: c.exported_pdf_path,
    status: c.status,
    valid_from: isoOrNull(c.valid_from),
    valid_until: isoOrNull(c.valid_until),
    created_at: iso(c.created_at),
    updated_at: iso(c.updated_at),
  }
}

export function mapPrintLog(l: PrismaPrintLog): PrintLog {
  return {
    id: l.id,
    organization_id: l.organization_id,
    person_external_id: l.person_external_id,
    person_name: l.person_name,
    template_id: l.template_id,
    template_name: l.template_name,
    action: l.action,
    created_at: iso(l.created_at),
  }
}

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { prisma, mapIdCard, mapPerson, mapTemplate } from "@/lib/db"
import { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const personId = searchParams.get("personId")
  const templateId = searchParams.get("templateId")

  const where: Prisma.IdCardWhereInput = {}
  if (user.orgId) where.organization_id = user.orgId
  if (personId) where.person_id = personId
  if (templateId) where.template_id = templateId

  const cards = await prisma.idCard.findMany({
    where,
    orderBy: { created_at: "desc" },
    include: { person: true, template: true },
  })

  // Preserve the previous Supabase join shape (persons / templates keys).
  const result = cards.map((c) => ({
    ...mapIdCard(c),
    persons: mapPerson(c.person),
    templates: mapTemplate(c.template),
  }))

  return NextResponse.json(result)
}

const createSchema = z.object({
  person_id: z.string().min(1),
  template_id: z.string().min(1),
  render_state: z.unknown().optional(),
  exported_pdf_path: z.string().nullable().optional(),
  status: z.enum(["draft", "generated", "printed"]).optional(),
  valid_from: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
})

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!user.orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { render_state, valid_from, valid_until, ...rest } = parsed.data

  const created = await prisma.idCard.create({
    data: {
      ...rest,
      organization_id: user.orgId,
      render_state:
        render_state === undefined || render_state === null
          ? Prisma.DbNull
          : (render_state as Prisma.InputJsonValue),
      valid_from: valid_from ? new Date(valid_from) : null,
      valid_until: valid_until ? new Date(valid_until) : null,
    },
  })

  return NextResponse.json(mapIdCard(created), { status: 201 })
}

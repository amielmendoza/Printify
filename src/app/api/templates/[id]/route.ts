import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { prisma, mapTemplate } from "@/lib/db"

async function findOwned(id: string, orgId: string | null) {
  const template = await prisma.template.findUnique({ where: { id } })
  if (!template) return null
  if (orgId && template.organization_id !== orgId) return null
  return template
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const template = await findOwned(id, user.orgId)
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  return NextResponse.json(mapTemplate(template))
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  placeholders: z.array(z.unknown()).optional(),
  is_active: z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const existing = await findOwned(id, user.orgId)
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { placeholders, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (placeholders !== undefined) data.placeholders = placeholders

  const updated = await prisma.template.update({ where: { id }, data })
  return NextResponse.json(mapTemplate(updated))
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const existing = await findOwned(id, user.orgId)
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  await prisma.template.update({ where: { id }, data: { is_active: false } })
  return NextResponse.json({ success: true })
}

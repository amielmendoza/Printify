import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { prisma, mapPerson } from "@/lib/db"

const updateSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  middle_name: z.string().nullable().optional(),
  person_type: z.string().optional(),
  category: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  id_number: z.string().nullable().optional(),
  photo_path: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const person = await prisma.person.findUnique({ where: { id } })

  if (!person || (user.orgId && person.organization_id !== user.orgId)) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 })
  }

  return NextResponse.json(mapPerson(person))
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Defense-in-depth: verify org ownership before mutating.
  const existing = await prisma.person.findUnique({ where: { id } })
  if (!existing || (user.orgId && existing.organization_id !== user.orgId)) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 })
  }

  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { metadata, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (metadata !== undefined) data.metadata = metadata

  try {
    const updated = await prisma.person.update({ where: { id }, data })
    return NextResponse.json(mapPerson(updated))
  } catch {
    return NextResponse.json({ error: "Failed to update person" }, { status: 500 })
  }
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

  const existing = await prisma.person.findUnique({ where: { id } })
  if (!existing || (user.orgId && existing.organization_id !== user.orgId)) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 })
  }

  try {
    await prisma.person.update({ where: { id }, data: { is_active: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete person" }, { status: 500 })
  }
}

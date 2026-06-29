import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { prisma, mapTemplate } from "@/lib/db"
import type { Prisma } from "@prisma/client"

export async function GET() {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const where: Prisma.TemplateWhereInput = { is_active: true }
  if (user.orgId) where.organization_id = user.orgId

  const templates = await prisma.template.findMany({
    where,
    orderBy: { name: "asc" },
  })

  return NextResponse.json(templates.map(mapTemplate))
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  file_path: z.string().min(1),
  file_type: z.enum(["pdf", "image"]),
  width_inches: z.number().positive().optional(),
  height_inches: z.number().positive().optional(),
  placeholders: z.array(z.unknown()).optional(),
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

  const { placeholders, width_inches, height_inches, ...rest } = parsed.data

  const created = await prisma.template.create({
    data: {
      ...rest,
      organization_id: user.orgId,
      ...(width_inches !== undefined ? { width_inches } : {}),
      ...(height_inches !== undefined ? { height_inches } : {}),
      placeholders: (placeholders ?? []) as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json(mapTemplate(created), { status: 201 })
}

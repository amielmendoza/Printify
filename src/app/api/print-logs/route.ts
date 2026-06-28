import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { prisma, mapPrintLog } from "@/lib/db"

export async function GET() {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!user.orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 })
  }

  const [totalPrinted, totalExported, recent] = await Promise.all([
    prisma.printLog.count({
      where: { organization_id: user.orgId, action: "printed" },
    }),
    prisma.printLog.count({
      where: { organization_id: user.orgId, action: "exported" },
    }),
    prisma.printLog.findMany({
      where: { organization_id: user.orgId },
      orderBy: { created_at: "desc" },
      take: 20,
    }),
  ])

  return NextResponse.json({
    totalPrinted,
    totalExported,
    recent: recent.map(mapPrintLog),
  })
}

const entrySchema = z.object({
  person_external_id: z.string().min(1),
  person_name: z.string().min(1),
  template_id: z.string().nullable().optional(),
  template_name: z.string().nullable().optional(),
  action: z.enum(["printed", "exported"]),
})

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!user.orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 })
  }

  const body = await request.json()
  const parsed = z.array(entrySchema).safeParse(Array.isArray(body) ? body : [body])
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  await prisma.printLog.createMany({
    data: parsed.data.map((entry) => ({
      organization_id: user.orgId,
      person_external_id: entry.person_external_id,
      person_name: entry.person_name,
      template_id: entry.template_id ?? null,
      template_name: entry.template_name ?? null,
      action: entry.action,
    })),
  })

  return NextResponse.json({ success: true, count: parsed.data.length }, { status: 201 })
}

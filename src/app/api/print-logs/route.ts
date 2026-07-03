import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { prisma, mapPrintLog } from "@/lib/db"
import type { Prisma } from "@prisma/client"

const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  action: z.enum(["printed", "exported"]).optional(),
  templateId: z.uuid().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  format: z.enum(["csv"]).optional(),
})

const CSV_MAX_ROWS = 5000

function toCsv(rows: ReturnType<typeof mapPrintLog>[]): string {
  const escape = (value: string | null) => {
    const s = value ?? ""
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = "Person ID,Person Name,Template,Action,Date"
  const lines = rows.map((r) =>
    [r.person_external_id, r.person_name, r.template_name, r.action, r.created_at]
      .map(escape)
      .join(",")
  )
  return [header, ...lines].join("\n")
}

export async function GET(request: NextRequest) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!user.orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 })
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = querySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 })
  }
  const { q, action, templateId, from, to, page, pageSize, format } = parsed.data

  const where: Prisma.PrintLogWhereInput = {
    organization_id: user.orgId,
    ...(action ? { action } : {}),
    ...(templateId ? { template_id: templateId } : {}),
    ...(from || to
      ? {
          created_at: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { person_name: { contains: q, mode: "insensitive" } },
            { person_external_id: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  if (format === "csv") {
    const rows = await prisma.printLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: CSV_MAX_ROWS,
    })
    return new NextResponse(toCsv(rows.map(mapPrintLog)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="print-history.csv"',
      },
    })
  }

  const [logs, total, printedCount, exportedCount] = await Promise.all([
    prisma.printLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.printLog.count({ where }),
    prisma.printLog.count({ where: { ...where, action: "printed" } }),
    prisma.printLog.count({ where: { ...where, action: "exported" } }),
  ])

  return NextResponse.json({
    logs: logs.map(mapPrintLog),
    total,
    printedCount,
    exportedCount,
    page,
    pageSize,
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

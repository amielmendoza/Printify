import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

const schema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  orgName: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid registration details" }, { status: 400 })
  }

  const { fullName, email, password, orgName } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
  }

  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  const passwordHash = await bcrypt.hash(password, 10)

  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: orgName, slug: `${slug}-${crypto.randomUUID().slice(0, 8)}` },
      })
      const user = await tx.user.create({
        data: { email, password_hash: passwordHash },
      })
      await tx.profile.create({
        data: {
          id: user.id,
          organization_id: org.id,
          full_name: fullName,
          role: "owner",
        },
      })
    })
  } catch {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

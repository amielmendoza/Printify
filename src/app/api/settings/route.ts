import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { prisma, mapProfile, mapOrganization } from "@/lib/db"

export async function GET() {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const profile = await prisma.profile.findUnique({ where: { id: user.id } })
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  const organization = profile.organization_id
    ? await prisma.organization.findUnique({ where: { id: profile.organization_id } })
    : null

  return NextResponse.json({
    profile: mapProfile(profile),
    organization: organization ? mapOrganization(organization) : null,
  })
}

const patchSchema = z.object({
  fullName: z.string().min(1).optional(),
  orgName: z.string().min(1).optional(),
})

export async function PATCH(request: NextRequest) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = patchSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { fullName, orgName } = parsed.data

  if (fullName !== undefined) {
    await prisma.profile.update({
      where: { id: user.id },
      data: { full_name: fullName },
    })
  }

  if (orgName !== undefined) {
    // Only owners/admins may rename the organization.
    if (user.role === "member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (user.orgId) {
      await prisma.organization.update({
        where: { id: user.orgId },
        data: { name: orgName },
      })
    }
  }

  return NextResponse.json({ success: true })
}

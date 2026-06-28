import { redirect } from "next/navigation"
import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma, mapProfile, mapOrganization } from "@/lib/db"
import type { Profile, Organization } from "@/lib/types"

// For server components / dashboard layout: redirects to /login if not signed in.
export async function getCurrentUser(): Promise<{
  user: { id: string; email: string }
  profile: Profile
  organization: Organization | null
}> {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const profileRow = await prisma.profile.findUnique({
    where: { id: session.user.id },
  })
  if (!profileRow) {
    redirect("/login")
  }
  const profile = mapProfile(profileRow)

  let organization: Organization | null = null
  if (profile.organization_id) {
    const orgRow = await prisma.organization.findUnique({
      where: { id: profile.organization_id },
    })
    organization = orgRow ? mapOrganization(orgRow) : null
  }

  return {
    user: { id: session.user.id, email: session.user.email ?? "" },
    profile,
    organization,
  }
}

// For API routes: returns the signed-in user's identity, or null if unauthenticated.
export async function requireUser(): Promise<{
  id: string
  orgId: string | null
  role: string
} | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return {
    id: session.user.id,
    orgId: session.user.orgId ?? null,
    role: session.user.role ?? "member",
  }
}

// Reads the external (evesms) bearer token + schoolId from the raw JWT. These
// are kept out of the client-visible session, so server code reads them here.
export async function getExternalCreds(request: NextRequest): Promise<{
  userId: string
  orgId: string | null
  role: string
  extToken: string | null
  schoolId: string | null
} | null> {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  })
  if (!token?.id) return null
  return {
    userId: token.id,
    orgId: token.orgId ?? null,
    role: token.role ?? "member",
    extToken: token.extToken ?? null,
    schoolId: token.schoolId ?? null,
  }
}

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { authConfig } from "@/auth.config"
import { prisma } from "@/lib/db"

const EXTERNAL_API_URL = "https://evesms.com/qrscanner/api/Authenticate/app-login"

interface ExternalLogin {
  tokenDetails: { token: string; tokenExpiration: string }
  userID: number
  username: string
  schoolId: number
  schoolPersonId: number
  userFullname: string
  isAdmin: boolean
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = String(credentials?.username ?? "").trim()
        const password = String(credentials?.password ?? "")
        if (!username || !password) return null

        // 1) Local account (registered via /register): email + password_hash.
        const local = await prisma.user.findUnique({
          where: { email: username },
          include: { profile: true },
        })
        if (local?.password_hash) {
          const ok = await bcrypt.compare(password, local.password_hash)
          if (!ok) return null
          return {
            id: local.id,
            email: local.email,
            name: local.profile?.full_name ?? local.email,
            fullName: local.profile?.full_name ?? null,
            role: local.profile?.role ?? "member",
            orgId: local.profile?.organization_id ?? null,
            username: local.external_username ?? local.email,
            schoolId: null,
            extToken: null,
          }
        }

        // 2) External API login (evesms).
        const res = await fetch(EXTERNAL_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        })
        const text = await res.text()
        if (!res.ok || text === "Incorrect Credentials") return null

        let data: ExternalLogin
        try {
          data = JSON.parse(text)
        } catch {
          return null
        }

        const email = `${data.username}@printify.app`
        const orgSlug = `school-${data.schoolId}`

        // Upsert organization for the school.
        const org = await prisma.organization.upsert({
          where: { slug: orgSlug },
          update: {},
          create: {
            name: `${data.userFullname.split(" ")[0]} School`,
            slug: orgSlug,
          },
        })

        // Upsert the external user + their profile.
        const user = await prisma.user.upsert({
          where: { email },
          update: {
            external_user_id: String(data.userID),
            external_username: data.username,
          },
          create: {
            email,
            external_user_id: String(data.userID),
            external_username: data.username,
          },
        })

        const role = data.isAdmin ? "owner" : "member"
        await prisma.profile.upsert({
          where: { id: user.id },
          update: {
            organization_id: org.id,
            full_name: data.userFullname,
            role,
          },
          create: {
            id: user.id,
            organization_id: org.id,
            full_name: data.userFullname,
            role,
          },
        })

        return {
          id: user.id,
          email,
          name: data.userFullname,
          fullName: data.userFullname,
          role,
          orgId: org.id,
          username: data.username,
          schoolId: String(data.schoolId),
          extToken: data.tokenDetails.token,
        }
      },
    }),
  ],
})

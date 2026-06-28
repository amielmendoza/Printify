import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      orgId: string | null
      fullName: string | null
      username: string | null
    } & DefaultSession["user"]
  }

  // Returned by the Credentials authorize() callback.
  interface User {
    role?: string
    orgId?: string | null
    fullName?: string | null
    username?: string | null
    schoolId?: string | null
    extToken?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role?: string
    orgId?: string | null
    schoolId?: string | null
    extToken?: string | null
    username?: string | null
    fullName?: string | null
  }
}

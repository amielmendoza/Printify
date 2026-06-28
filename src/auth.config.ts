import type { NextAuthConfig } from "next-auth"

// Edge-safe Auth.js config (no DB / Node-only providers). Imported by both the
// middleware (edge) and the full server config in src/auth.ts. The Credentials
// provider, which needs Prisma + bcrypt, is added only in src/auth.ts.
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  // Match the external API token lifetime (4h) so the session and the
  // external bearer token expire together.
  session: { strategy: "jwt", maxAge: 60 * 60 * 4 },
  providers: [],
  callbacks: {
    // Route protection — replaces the old updateSession() middleware.
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      if (
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/auth") ||
        // API routes enforce auth themselves and must return JSON 401s,
        // not an HTML redirect to /login.
        pathname.startsWith("/api/")
      ) {
        return true
      }
      return !!auth?.user
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role ?? "member"
        token.orgId = user.orgId ?? null
        token.schoolId = user.schoolId ?? null
        token.extToken = user.extToken ?? null
        token.username = user.username ?? null
        token.fullName = user.fullName ?? null
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role ?? "member"
        session.user.orgId = token.orgId ?? null
        session.user.fullName = token.fullName ?? null
        session.user.username = token.username ?? null
        // Note: extToken and schoolId are intentionally NOT copied into the
        // client-visible session. Server code reads them from the raw JWT via
        // getToken() (see src/lib/auth.ts), preserving httpOnly-cookie semantics.
      }
      return session
    },
  },
} satisfies NextAuthConfig

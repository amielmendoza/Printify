import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

// Edge middleware: validates the JWT and applies the `authorized` callback for
// route protection. Uses the edge-safe config (no Prisma/Node providers).
export default NextAuth(authConfig).auth

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

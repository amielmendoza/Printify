"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader2 } from "lucide-react"

export function RegisterForm() {
  const router = useRouter()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [orgName, setOrgName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, orgName }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to create account")
        setLoading(false)
        return
      }

      // Sign in with the new credentials.
      const result = await signIn("credentials", {
        username: email,
        password,
        redirect: false,
      })
      if (!result || result.error) {
        setError("Account created, but sign-in failed. Please log in.")
        setLoading(false)
        return
      }

      router.push("/")
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-[13px] text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fullName" className="text-[13px]">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            required
            autoFocus
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="orgName" className="text-[13px]">Organization</Label>
          <Input
            id="orgName"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme School"
            required
            className="h-11"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[13px]">Work email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[13px]">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
          placeholder="At least 6 characters"
          className="h-11"
        />
      </div>
      <Button type="submit" className="h-11 w-full text-[14px]" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? "Creating workspace…" : "Create workspace"}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        By signing up you agree to our terms of service and privacy policy.
      </p>
    </form>
  )
}

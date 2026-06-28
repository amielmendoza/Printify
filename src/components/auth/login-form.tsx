"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader2 } from "lucide-react"

export function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      })

      if (!result || result.error) {
        setError("Invalid username or password")
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
      <div className="space-y-1.5">
        <Label htmlFor="username" className="text-[13px]">Username</Label>
        <Input
          id="username"
          type="text"
          placeholder="you@example.com"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          autoFocus
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-[13px]">Password</Label>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            Forgot?
          </a>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="h-11"
        />
      </div>
      <Button type="submit" className="h-11 w-full text-[14px]" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, User, Building2, ShieldCheck, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import type { Organization, Profile } from "@/lib/types"

export default function SettingsPage() {
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingOrg, setSavingOrg] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [orgName, setOrgName] = useState("")
  const [fullName, setFullName] = useState("")

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/settings")
      if (!res.ok) return
      const data = await res.json()
      const profileData = data.profile as Profile | null
      const orgData = data.organization as Organization | null

      if (profileData) {
        setProfile(profileData)
        setFullName(profileData.full_name ?? "")
      }
      if (orgData) {
        setOrg(orgData)
        setOrgName(orgData.name)
      }
    }
    load()
  }, [])

  async function handleSaveProfile() {
    if (!profile) return
    setSavingProfile(true)
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName }),
    })
    if (!res.ok) toast.error("Failed to update profile")
    else toast.success("Profile updated")
    setSavingProfile(false)
  }

  async function handleSaveOrg() {
    if (!org) return
    setSavingOrg(true)
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgName }),
    })
    if (!res.ok) toast.error("Failed to update organization")
    else toast.success("Organization updated")
    setSavingOrg(false)
  }

  const isMember = profile?.role === "member"

  return (
    <div className="flex h-full flex-col">
      <Header eyebrow="Account" title="Settings" description="Manage your profile and organization" />

      <div className="flex-1 overflow-auto scrollbar-thin">
        <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
          {/* Profile */}
          <SettingsSection
            icon={User}
            title="Profile"
            description="How your name appears across the workspace."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-[12px]">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Role</Label>
                <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/40 px-3 text-[13px]">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="capitalize">{profile?.role ?? "—"}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm" className="h-9">
                {savingProfile && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save profile
              </Button>
            </div>
          </SettingsSection>

          {/* Organization */}
          <SettingsSection
            icon={Building2}
            title="Organization"
            description="The workspace your data and templates belong to."
          >
            <div className="space-y-1.5">
              <Label htmlFor="orgName" className="text-[12px]">Organization name</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="h-10"
                disabled={isMember}
              />
            </div>
            {isMember && (
              <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-warning/20 bg-warning/5 p-3 text-[12px] text-warning-foreground">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  Only <span className="font-medium">admins</span> and <span className="font-medium">owners</span> can update organization settings.
                </span>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveOrg} disabled={savingOrg || isMember} size="sm" className="h-9">
                {savingOrg && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save organization
              </Button>
            </div>
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="grid gap-4 p-5 sm:grid-cols-[220px_1fr] sm:gap-8">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  )
}

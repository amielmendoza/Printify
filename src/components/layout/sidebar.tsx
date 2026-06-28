"use client"

import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { SidebarNav } from "./sidebar-nav"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreditCard, LogOut, Settings, ChevronsUpDown, HelpCircle } from "lucide-react"

interface SidebarProps {
  orgName: string | null
  userName: string | null
}

export function Sidebar({ orgName, userName }: SidebarProps) {
  const router = useRouter()

  async function handleSignOut() {
    await signOut({ redirect: false })
    router.push("/login")
    router.refresh()
  }

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U"

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
          <CreditCard className="h-[18px] w-[18px]" />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-sidebar" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold tracking-tight">Printify</h1>
          <p className="truncate text-[11px] text-muted-foreground">ID Card Studio</p>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-auto scrollbar-thin px-3 py-4">
        <SidebarNav />
      </div>

      {/* Help */}
      <div className="px-3 pb-3">
        <a
          href="https://github.com/anthropics/claude-code/issues"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Help &amp; support</span>
        </a>
      </div>

      {/* User menu */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition-all hover:border-sidebar-border hover:bg-sidebar-accent">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-[12px] font-semibold text-primary ring-1 ring-primary/10">
                  {initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-tight">{userName ?? "User"}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{orgName ?? "Personal"}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
              </button>
            }
          />
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{userName ?? "User"}</span>
                <span className="text-xs text-muted-foreground">{orgName ?? "Personal"}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

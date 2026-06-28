"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Users, CreditCard, BarChart3, Layout, Settings, Sparkles } from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Workspace",
    items: [
      { href: "/generator", label: "ID Generator", icon: Sparkles },
      { href: "/persons", label: "Persons", icon: Users },
      { href: "/templates", label: "Templates", icon: Layout },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
            {section.title}
          </p>
          {section.items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />
                )}
                <Icon className={cn("h-[17px] w-[17px] transition-colors", isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

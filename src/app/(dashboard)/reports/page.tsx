import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { Layout, FileCheck, Printer, Download, Activity, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

export default async function ReportsPage() {
  const { organization } = await getCurrentUser()
  const orgId = organization?.id

  const [templatesCount, printedCount, exportedCount, totalCards] = await Promise.all([
    prisma.template.count({ where: { is_active: true, ...(orgId ? { organization_id: orgId } : {}) } }),
    prisma.printLog.count({ where: { action: "printed", ...(orgId ? { organization_id: orgId } : {}) } }),
    prisma.printLog.count({ where: { action: "exported", ...(orgId ? { organization_id: orgId } : {}) } }),
    prisma.printLog.count({ where: orgId ? { organization_id: orgId } : {} }),
  ])

  const stats = [
    {
      label: "Total Cards",
      value: totalCards ?? 0,
      icon: FileCheck,
      tone: "primary" as const,
      caption: "Lifetime generated",
    },
    {
      label: "Cards Printed",
      value: printedCount ?? 0,
      icon: Printer,
      tone: "success" as const,
      caption: "Sent to printer",
    },
    {
      label: "Cards Exported",
      value: exportedCount ?? 0,
      icon: Download,
      tone: "info" as const,
      caption: "PDF downloads",
    },
    {
      label: "Active Templates",
      value: templatesCount ?? 0,
      icon: Layout,
      tone: "warning" as const,
      caption: "In your workspace",
    },
  ]

  interface PrintLog {
    id: string
    person_name: string
    template_name: string | null
    action: string
    created_at: string
  }
  const recentLogsRaw = await prisma.printLog.findMany({
    where: orgId ? { organization_id: orgId } : {},
    orderBy: { created_at: "desc" },
    take: 20,
  })
  const recentLogs: PrintLog[] = recentLogsRaw.map((l) => ({
    id: l.id,
    person_name: l.person_name,
    template_name: l.template_name,
    action: l.action,
    created_at: l.created_at.toISOString(),
  }))

  return (
    <div className="flex h-full flex-col">
      <Header eyebrow="Insights" title="Reports" description="Overview of your ID card activity" />

      <div className="flex-1 overflow-auto scrollbar-thin">
        <div className="mx-auto w-full max-w-6xl p-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl ring-1",
                        stat.tone === "primary" && "bg-primary/10 text-primary ring-primary/15",
                        stat.tone === "success" && "bg-success/10 text-success ring-success/20",
                        stat.tone === "info" && "bg-info/10 text-info ring-info/20",
                        stat.tone === "warning" && "bg-warning/10 text-warning ring-warning/20"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-[28px] font-semibold tracking-tight tabular-nums">
                    {stat.value.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{stat.caption}</p>
                </div>
              )
            })}
          </div>

          {/* Recent activity */}
          <div className="mt-8 overflow-hidden rounded-2xl border bg-card shadow-xs">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold tracking-tight">Recent activity</h3>
                  <p className="text-[12px] text-muted-foreground">Latest prints and exports</p>
                </div>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                {recentLogs.length}
              </span>
            </div>

            {recentLogs.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mt-3 text-[14px] font-semibold">No activity yet</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Cards you print or export will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {recentLogs.map((log) => {
                  const date = new Date(log.created_at)
                  const isPrint = log.action === "printed"
                  return (
                    <li
                      key={log.id}
                      className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
                          isPrint
                            ? "bg-success/10 text-success ring-success/20"
                            : "bg-info/10 text-info ring-info/20"
                        )}
                      >
                        {isPrint ? <Printer className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium leading-tight">
                          {log.person_name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          <span className="capitalize">{log.action}</span>
                          <span className="text-muted-foreground/40"> · </span>
                          {log.template_name ?? "Unknown template"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] tabular-nums text-muted-foreground">
                          {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </p>
                        <p className="text-[10px] tabular-nums text-muted-foreground/70">
                          {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

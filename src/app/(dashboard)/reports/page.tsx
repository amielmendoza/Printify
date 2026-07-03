import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { PrintHistory } from "@/components/reports/print-history"
import { Layout, FileCheck, Printer, Download } from "lucide-react"
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

          {/* Print history */}
          <PrintHistory />
        </div>
      </div>
    </div>
  )
}

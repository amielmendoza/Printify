import { getCurrentUser } from "@/lib/auth"
import { Sidebar } from "@/components/layout/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile, organization } = await getCurrentUser()

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-muted/40">
        <Sidebar
          orgName={organization?.name ?? null}
          userName={profile.full_name}
        />
        <main className="flex flex-1 flex-col overflow-hidden bg-background">
          {children}
        </main>
      </div>
      <Toaster />
    </TooltipProvider>
  )
}

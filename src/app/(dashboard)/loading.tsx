import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b px-6">
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="flex-1 p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  )
}

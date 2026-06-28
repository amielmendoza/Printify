import { Skeleton } from "@/components/ui/skeleton"

export function EditorSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 p-8">
      <Skeleton className="aspect-[3.375/2.125] w-full max-w-2xl rounded-lg" />
    </div>
  )
}

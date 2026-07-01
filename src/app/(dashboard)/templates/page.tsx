"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTemplates } from "@/hooks/use-templates"
import { Header } from "@/components/layout/header"
import { TemplateCard } from "@/components/templates/template-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, Layout, X } from "lucide-react"
import { toast } from "sonner"

export default function TemplatesPage() {
  const router = useRouter()
  const { templates, loading, refetch } = useTemplates()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search) return templates
    const q = search.toLowerCase()
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
    )
  }, [templates, search])

  async function handleDelete(id: string) {
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to delete template")
    } else {
      toast.success("Template deleted")
      refetch()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        eyebrow="Workspace"
        title="Templates"
        description={templates.length > 0 ? `${templates.length} active template${templates.length === 1 ? "" : "s"}` : "Upload ID card backgrounds"}
        actions={
          <Button onClick={() => router.push("/templates/new")} size="sm" className="h-9 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Upload template
          </Button>
        }
      />

      <div className="flex-1 overflow-auto scrollbar-thin">
        <div className="mx-auto w-full max-w-6xl p-6">
          {/* Search */}
          {templates.length > 0 && (
            <div className="mb-5 flex items-center gap-3">
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search templates…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9 pr-8 text-[13px]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground tabular-nums">
                {filtered.length} of {templates.length}
              </p>
            </div>
          )}

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[3.375/2.125] rounded-2xl" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <EmptyTemplates onUpload={() => router.push("/templates/new")} />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-[14px] font-semibold">No templates match &ldquo;{search}&rdquo;</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Try a different search term.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onEdit={(tpl) => router.push(`/templates/${tpl.id}/edit`)}
                  onDuplicate={(tpl) => router.push(`/templates/new?duplicate=${tpl.id}`)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

function EmptyTemplates({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed bg-card/40 px-6 py-16 text-center">
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow-sm ring-1 ring-border">
          <Layout className="h-7 w-7 text-muted-foreground/70" strokeWidth={1.5} />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow ring-2 ring-background">
          <Plus className="h-3.5 w-3.5" />
        </div>
      </div>
      <h3 className="mt-5 text-[16px] font-semibold tracking-tight">No templates yet</h3>
      <p className="mt-1.5 max-w-xs text-[13px] text-muted-foreground">
        Upload your first ID card template to start generating cards for your team.
      </p>
      <Button onClick={onUpload} className="mt-5 h-9 gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Upload template
      </Button>
      <div className="mt-5 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span>Supports PDF</span>
        <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
        <span>PNG, JPG</span>
        <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
        <span>CR-80 ready</span>
      </div>
    </div>
  )
}

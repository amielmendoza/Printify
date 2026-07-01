"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileImage, FilePlus, Loader2, X, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Template } from "@/lib/types"

export default function NewTemplatePage() {
  return (
    <Suspense fallback={null}>
      <NewTemplateForm />
    </Suspense>
  )
}

function NewTemplateForm() {
  const router = useRouter()
  const duplicateId = useSearchParams().get("duplicate")

  const [source, setSource] = useState<Template | null>(null)
  const [loadingSource, setLoadingSource] = useState(!!duplicateId)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  // In duplicate mode, fetch the source template and seed the fields.
  useEffect(() => {
    if (!duplicateId) return
    let active = true
    fetch(`/api/templates/${duplicateId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((t: Template | null) => {
        if (!active) return
        if (t) {
          setSource(t)
          setName(`${t.name} copy`)
          setDescription(t.description ?? "")
        } else {
          toast.error("Template to duplicate was not found")
        }
        setLoadingSource(false)
      })
      .catch(() => active && setLoadingSource(false))
    return () => {
      active = false
    }
  }, [duplicateId])

  const copiedPlaceholders = source ? (source.placeholders as unknown[]).length : 0
  const isPdf = file?.type === "application/pdf"
  const formattedSize = file ? formatBytes(file.size) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("bucket", "templates")
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error)

      const fileType = file.type === "application/pdf" ? "pdf" : "image"

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          file_path: uploadData.path,
          file_type: fileType,
          // Carry over the source template's layout when duplicating.
          placeholders: source ? source.placeholders : [],
          ...(source
            ? { width_inches: source.width_inches, height_inches: source.height_inches }
            : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      toast.success(source ? "Template duplicated" : "Template created", { description: name })
      router.push("/templates")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template")
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) setFile(f)
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        eyebrow="Templates"
        title={source ? "Duplicate template" : "New template"}
        description={source ? `Based on ${source.name}` : "Upload an ID card background"}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => router.push("/templates")}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        }
      />

      <div className="flex-1 overflow-auto scrollbar-thin">
        <div className="mx-auto w-full max-w-2xl p-6">
          <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border bg-card shadow-xs">
            <div className="space-y-5 p-6">
              {source && (
                <div className="rounded-lg bg-primary/5 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground ring-1 ring-primary/10">
                  Copying {copiedPlaceholders} placeholder{copiedPlaceholders === 1 ? "" : "s"} and the
                  card size from <span className="font-medium text-foreground">{source.name}</span>. Just
                  choose the new template image.
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="template-name" className="text-[12px]">Template name</Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Student ID — Front"
                  required
                  autoFocus
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="template-desc" className="text-[12px]">
                  Description
                  <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">Optional</span>
                </Label>
                <Input
                  id="template-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="School year 2025–2026"
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px]">Template file</Label>
                {file ? (
                  <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card ring-1 ring-border">
                      <FileImage className={cn("h-4 w-4", isPdf ? "text-destructive" : "text-info")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium leading-tight">{file.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        <span className="uppercase">{isPdf ? "PDF" : file.type.split("/")[1] ?? "image"}</span>
                        <span className="text-muted-foreground/40"> · </span>
                        <span className="tabular-nums">{formattedSize}</span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setFile(null)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                      dragOver
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-muted/30 hover:border-primary/30 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-card shadow-xs ring-1 ring-border">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-[13px] font-medium">
                      Drop your file here or <span className="text-primary">browse</span>
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">PDF or PNG/JPG · up to 10 MB</p>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t bg-muted/40 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => router.push("/templates")}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !file || loadingSource} className="gap-1.5">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus className="h-3.5 w-3.5" />}
                {loading ? "Saving…" : source ? "Create duplicate" : "Create template"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

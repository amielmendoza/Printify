"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { Upload, FileImage, FilePlus, Loader2, X, Layout } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Template } from "@/lib/types"

interface TemplateUploadFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  // When set, the form duplicates this template: name/size/placeholders are
  // copied and the user only picks a new image.
  duplicateFrom?: Template | null
}

export function TemplateUploadForm({ open, onOpenChange, onSaved, duplicateFrom }: TemplateUploadFormProps) {
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  // Seed fields each time the dialog opens: in duplicate mode prefill from the
  // source template; otherwise start blank. The image is always chosen fresh.
  useEffect(() => {
    if (!open) return
    setFile(null)
    setName(duplicateFrom ? `${duplicateFrom.name} copy` : "")
    setDescription(duplicateFrom?.description ?? "")
  }, [open, duplicateFrom])

  const copiedPlaceholders = duplicateFrom
    ? (duplicateFrom.placeholders as unknown[]).length
    : 0

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
          placeholders: duplicateFrom ? duplicateFrom.placeholders : [],
          ...(duplicateFrom
            ? { width_inches: duplicateFrom.width_inches, height_inches: duplicateFrom.height_inches }
            : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      toast.success(duplicateFrom ? "Template duplicated" : "Template uploaded", { description: name })
      onSaved()
      onOpenChange(false)
      setFile(null)
      setName("")
      setDescription("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload template")
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

  const isPdf = file?.type === "application/pdf"
  const formattedSize = file ? formatBytes(file.size) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Layout className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Templates</p>
            <h2 className="text-[15px] font-semibold tracking-tight">{duplicateFrom ? "Duplicate template" : "Upload template"}</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-5">
            {duplicateFrom && (
              <div className="rounded-lg bg-primary/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground ring-1 ring-primary/10">
                Copying {copiedPlaceholders} placeholder{copiedPlaceholders === 1 ? "" : "s"} and the card size from{" "}
                <span className="font-medium text-foreground">{duplicateFrom.name}</span>. Just choose the new template image.
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
                    "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
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
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    PDF or PNG/JPG · up to 10 MB
                  </p>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    required
                  />
                </label>
              )}
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !file} className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus className="h-3.5 w-3.5" />}
              {loading ? "Uploading…" : duplicateFrom ? "Create duplicate" : "Upload template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

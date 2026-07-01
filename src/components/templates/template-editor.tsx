"use client"

import { useCallback, useRef, useState } from "react"
import { useStorageUrl } from "@/hooks/use-storage-url"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Plus,
  Trash2,
  Save,
  Image as ImageIcon,
  Type,
  QrCode,
  ChevronDown,
  ChevronRight,
  Loader2,
  Layout,
  ArrowLeft,
  MoveHorizontal,
  MoveVertical,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Template, Placeholder } from "@/lib/types"

interface TemplateEditorProps {
  template: Template
  onCancel: () => void
  onSaved: () => void
}

const fieldOptions = [
  { value: "full_name", label: "Full Name" },
  { value: "id_number", label: "ID Number" },
  { value: "person_type", label: "Person Type" },
  { value: "category", label: "Category" },
  { value: "emergency_name", label: "Emergency Contact Name" },
  { value: "emergency_contact", label: "Emergency Contact No." },
  { value: "emergency_address", label: "Emergency Address" },
]

type PlaceholderKind = "photo" | "text" | "qrcode"

const typeMeta: Record<PlaceholderKind, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  tone: { ring: string; bg: string; text: string; dot: string; raw: string }
}> = {
  photo:  { label: "Photo",   icon: ImageIcon, tone: { ring: "ring-info/30",     bg: "bg-info/10",     text: "text-info",     dot: "bg-info",     raw: "var(--info)" } },
  text:   { label: "Text",    icon: Type,      tone: { ring: "ring-success/30",  bg: "bg-success/10",  text: "text-success",  dot: "bg-success",  raw: "var(--success)" } },
  qrcode: { label: "QR Code", icon: QrCode,    tone: { ring: "ring-chart-4/30", bg: "bg-chart-4/10",  text: "text-chart-4",  dot: "bg-chart-4",  raw: "var(--chart-4)" } },
}

type DragState = {
  index: number
  mode: "move" | "resize"
  startX: number
  startY: number
  origX: number
  origY: number
  origW: number
  origH: number
} | null

export function TemplateEditor({ template, onCancel, onSaved }: TemplateEditorProps) {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>(
    (template.placeholders as unknown as Placeholder[]) ?? []
  )
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))
  // The preview scales to fit the available area using the image's real aspect
  // ratio, so the whole card is visible without scrolling.
  const [imgAspect, setImgAspect] = useState<number | null>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState>(null)

  const templateUrl = useStorageUrl("templates", template.file_path)

  function addPlaceholder() {
    const newPh: Placeholder = {
      id: crypto.randomUUID(),
      type: "text",
      label: "New Field",
      x: 10,
      y: 10,
      width: 30,
      height: 10,
      field: "full_name",
    }
    setPlaceholders([...placeholders, newPh])
    setSelected(placeholders.length)
    setExpanded((prev) => new Set(prev).add(placeholders.length))
  }

  function updatePlaceholder(index: number, updates: Partial<Placeholder>) {
    setPlaceholders((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...updates } : p))
    )
  }

  function removePlaceholder(index: number) {
    setPlaceholders((prev) => prev.filter((_, i) => i !== index))
    if (selected === index) setSelected(null)
    else if (selected !== null && selected > index) setSelected(selected - 1)
  }

  function toggleExpanded(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const getContainerRect = useCallback(() => {
    return imageContainerRef.current?.getBoundingClientRect() ?? null
  }, [])

  function handlePointerDown(e: React.PointerEvent, index: number, mode: "move" | "resize") {
    e.preventDefault()
    e.stopPropagation()
    const ph = placeholders[index]
    dragRef.current = {
      index, mode,
      startX: e.clientX, startY: e.clientY,
      origX: ph.x, origY: ph.y,
      origW: ph.width, origH: ph.height,
    }
    setSelected(index)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const rect = getContainerRect()
    if (!rect) return

    const dx = ((e.clientX - drag.startX) / rect.width) * 100
    const dy = ((e.clientY - drag.startY) / rect.height) * 100

    if (drag.mode === "move") {
      const newX = Math.round(Math.max(0, Math.min(100 - drag.origW, drag.origX + dx)))
      const newY = Math.round(Math.max(0, Math.min(100 - drag.origH, drag.origY + dy)))
      updatePlaceholder(drag.index, { x: newX, y: newY })
    } else {
      const newW = Math.round(Math.max(5, Math.min(100 - drag.origX, drag.origW + dx)))
      const newH = Math.round(Math.max(3, Math.min(100 - drag.origY, drag.origH + dy)))
      updatePlaceholder(drag.index, { width: newW, height: newH })
    }
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeholders }),
      })
      if (!res.ok) throw new Error("Save failed")
      toast.success("Placeholders saved", { description: `${placeholders.length} placeholder${placeholders.length === 1 ? "" : "s"} on ${template.name}` })
      onSaved()
    } catch (err) {
      toast.error("Failed to save placeholders")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <Button variant="outline" size="icon-sm" onClick={onCancel} className="shrink-0">
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Layout className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Edit template</p>
          <h2 className="truncate text-[15px] font-semibold tracking-tight">{template.name}</h2>
        </div>
      </div>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_1fr] grid-rows-[minmax(0,1fr)]">
          {/* Left — preview */}
          <div className="flex min-h-0 flex-col overflow-hidden border-r bg-muted/40">
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto scrollbar-thin p-5">
              <div
                ref={imageContainerRef}
                className="relative mx-auto max-h-full max-w-full select-none overflow-hidden rounded-xl bg-card shadow-md ring-1 ring-border"
                style={
                  imgAspect
                    ? { aspectRatio: String(imgAspect), height: "100%", width: "auto" }
                    : { width: "100%" }
                }
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onClick={() => setSelected(null)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={templateUrl ?? undefined}
                  alt={template.name}
                  className="pointer-events-none block h-full w-full"
                  draggable={false}
                  onLoad={(e) =>
                    setImgAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)
                  }
                />
                {placeholders.map((ph, i) => {
                  const isSelected = selected === i
                  const meta = typeMeta[(ph.type as PlaceholderKind) ?? "text"]
                  return (
                    <div
                      key={ph.id}
                      className={cn(
                        "absolute flex items-start rounded p-0.5 transition-shadow",
                        isSelected ? "ring-2 ring-offset-1 ring-offset-background" : "ring-1"
                      )}
                      style={{
                        left: `${ph.x}%`,
                        top: `${ph.y}%`,
                        width: `${ph.width}%`,
                        height: `${ph.height}%`,
                        backgroundColor: `color-mix(in oklch, ${meta.tone.raw} 18%, transparent)`,
                        borderColor: `color-mix(in oklch, ${meta.tone.raw} 70%, transparent)`,
                        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${meta.tone.raw} 60%, transparent)`,
                        cursor: "grab",
                        touchAction: "none",
                        ["--tw-ring-color" as string]: meta.tone.raw,
                      }}
                      onClick={(e) => { e.stopPropagation(); setSelected(i) }}
                      onPointerDown={(e) => handlePointerDown(e, i, "move")}
                    >
                      <span
                        className="pointer-events-none w-full overflow-hidden truncate text-[10px] font-medium leading-tight"
                        style={{ color: `color-mix(in oklch, ${meta.tone.raw} 75%, black)` }}
                      >
                        {ph.label}
                      </span>
                      <div
                        className="absolute bottom-0 right-0 h-3 w-3 rounded-sm"
                        style={{
                          cursor: "nwse-resize",
                          backgroundColor: isSelected ? meta.tone.raw : "transparent",
                          opacity: isSelected ? 0.9 : 0,
                        }}
                        onPointerDown={(e) => handlePointerDown(e, i, "resize")}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="border-t bg-card px-5 py-2.5 text-center text-[11px] text-muted-foreground">
              Drag to position · drag the corner to resize
            </div>
          </div>

          {/* Right — placeholders panel */}
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-semibold tracking-tight">Placeholders</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {placeholders.length}
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={addPlaceholder} className="h-8 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 p-4">
                {placeholders.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-12 text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-[13px] font-medium">No placeholders yet</p>
                    <p className="mt-1 max-w-xs text-[11px] text-muted-foreground">
                      Add a placeholder to define where the photo, name, and other data appear on the card.
                    </p>
                    <Button size="sm" onClick={addPlaceholder} className="mt-4 h-8 gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Add placeholder
                    </Button>
                  </div>
                ) : (
                  placeholders.map((ph, i) => {
                    const meta = typeMeta[(ph.type as PlaceholderKind) ?? "text"]
                    const Icon = meta.icon
                    const isSelected = selected === i
                    const isOpen = expanded.has(i)
                    return (
                      <div
                        key={ph.id}
                        className={cn(
                          "overflow-hidden rounded-xl border bg-card transition-all",
                          isSelected
                            ? `${meta.tone.ring} ring-2 border-transparent`
                            : "hover:border-border"
                        )}
                        onClick={() => setSelected(i)}
                      >
                        {/* Row header */}
                        <div className="flex items-center gap-2 px-3 py-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleExpanded(i) }}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                          <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg ring-1", meta.tone.bg, meta.tone.text, meta.tone.ring.replace("ring-", "ring-").replace("/30", "/20"))}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium leading-tight">{ph.label || meta.label}</p>
                            <p className="text-[10px] text-muted-foreground">
                              <span className="capitalize">{ph.type}</span>
                              <span className="text-muted-foreground/40"> · </span>
                              <span className="tabular-nums">{ph.x}, {ph.y}</span>
                              <span className="text-muted-foreground/40"> · </span>
                              <span className="tabular-nums">{ph.width}×{ph.height}</span>
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => { e.stopPropagation(); removePlaceholder(i) }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Row details */}
                        {isOpen && (
                          <div className="space-y-3 border-t bg-muted/30 p-3">
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Type">
                                <Select
                                  value={ph.type}
                                  onValueChange={(v) => { if (v) updatePlaceholder(i, { type: v as PlaceholderKind }) }}
                                >
                                  <SelectTrigger className="h-8 text-[12px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="photo">Photo</SelectItem>
                                    <SelectItem value="text">Text</SelectItem>
                                    <SelectItem value="qrcode">QR Code</SelectItem>
                                  </SelectContent>
                                </Select>
                              </Field>
                              <Field label="Label">
                                <Input
                                  className="h-8 text-[12px]"
                                  value={ph.label}
                                  onChange={(e) => updatePlaceholder(i, { label: e.target.value })}
                                />
                              </Field>
                            </div>

                            {ph.type === "text" && (
                              <Field label="Data field" hint="Empty = static label">
                                <Select
                                  value={ph.field ?? "_none"}
                                  onValueChange={(v) => { updatePlaceholder(i, { field: !v || v === "_none" ? undefined : v }) }}
                                >
                                  <SelectTrigger className="h-8 text-[12px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="_none">None (use label text)</SelectItem>
                                    {fieldOptions.map((f) => (
                                      <SelectItem key={f.value} value={f.value}>
                                        {f.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </Field>
                            )}

                            {ph.type === "text" && !ph.field && (
                              <Field label="HTML content">
                                <textarea
                                  className="flex min-h-[64px] w-full resize-y rounded-md border bg-card px-3 py-2 font-mono text-[12px] shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  rows={2}
                                  placeholder="<b>Bold</b><br>Line 2"
                                  value={ph.label}
                                  onChange={(e) => updatePlaceholder(i, { label: e.target.value })}
                                />
                              </Field>
                            )}

                            <div>
                              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Position &amp; size
                              </p>
                              <div className="grid grid-cols-4 gap-2">
                                <NumberField label="X%" value={ph.x} onChange={(v) => updatePlaceholder(i, { x: v })} />
                                <NumberField label="Y%" value={ph.y} onChange={(v) => updatePlaceholder(i, { y: v })} />
                                <NumberField label="W%" value={ph.width} onChange={(v) => updatePlaceholder(i, { width: v })} />
                                <NumberField label="H%" value={ph.height} onChange={(v) => updatePlaceholder(i, { height: v })} />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 text-[11px]"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    updatePlaceholder(i, { x: Math.round((100 - ph.width) / 2) })
                                  }}
                                >
                                  <MoveHorizontal className="h-3 w-3" /> Center H
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 text-[11px]"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    updatePlaceholder(i, { y: Math.round((100 - ph.height) / 2) })
                                  }}
                                >
                                  <MoveVertical className="h-3 w-3" /> Center V
                                </Button>
                              </div>
                            </div>

                            {ph.type === "text" && (
                              <div>
                                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Typography
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                  <Field label="Font size">
                                    <Input
                                      className="h-8 text-[12px]"
                                      type="number"
                                      min={8}
                                      max={72}
                                      value={ph.style?.fontSize ?? 24}
                                      onChange={(e) =>
                                        updatePlaceholder(i, {
                                          style: { ...ph.style, fontSize: +e.target.value },
                                        })
                                      }
                                    />
                                  </Field>
                                  <Field label="Weight">
                                    <Select
                                      value={ph.style?.fontWeight ?? "normal"}
                                      onValueChange={(v) => {
                                        if (v) updatePlaceholder(i, { style: { ...ph.style, fontWeight: v } })
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-[12px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="bold">Bold</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </Field>
                                  <Field label="Align">
                                    <Select
                                      value={ph.style?.textAlign ?? "left"}
                                      onValueChange={(v) => {
                                        if (v) updatePlaceholder(i, { style: { ...ph.style, textAlign: v } })
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-[12px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="left">Left</SelectItem>
                                        <SelectItem value="center">Center</SelectItem>
                                        <SelectItem value="right">Right</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </Field>
                                  <Field label="Color">
                                    <div className="flex h-8 items-center gap-1.5 rounded-md border bg-card px-1.5 shadow-xs">
                                      <input
                                        type="color"
                                        value={ph.style?.color ?? "#000000"}
                                        onChange={(e) =>
                                          updatePlaceholder(i, {
                                            style: { ...ph.style, color: e.target.value },
                                          })
                                        }
                                        className="h-6 w-6 cursor-pointer rounded border bg-transparent"
                                      />
                                      <span className="font-mono text-[11px] uppercase text-muted-foreground">
                                        {ph.style?.color ?? "#000000"}
                                      </span>
                                    </div>
                                  </Field>
                                </div>
                                <Field className="mt-3" label="Font family">
                                  <Select
                                    value={ph.style?.fontFamily ?? "Arial"}
                                    onValueChange={(v) => {
                                      if (v) updatePlaceholder(i, { style: { ...ph.style, fontFamily: v } })
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-[12px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {["Arial","Helvetica","Times New Roman","Georgia","Verdana","Courier New","Impact","Comic Sans MS","Trebuchet MS","Tahoma"].map((f) => (
                                        <SelectItem key={f} value={f}>{f}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </Field>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t bg-card px-5 py-3">
          <p className="hidden text-[11px] text-muted-foreground sm:mr-auto sm:block">
            Tip: click a placeholder on the preview to focus it.
          </p>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {loading ? "Saving…" : "Save placeholders"}
          </Button>
        </div>
      </div>
  )
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline gap-1.5">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium tracking-wide text-muted-foreground">{label}</Label>
      <Input
        className="h-8 text-[12px] tabular-nums"
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
    </div>
  )
}

"use client"

import { useEditorStore } from "@/stores/editor-store"
import { useAppStore } from "@/stores/app-store"
import { useTemplates } from "@/hooks/use-templates"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Download,
  FileStack,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FlipHorizontal2,
  Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface EditorToolbarProps {
  onExportSingle: () => void
  onExportBatch: () => void
  onPrintSingle: () => void
  onPrintBatch: () => void
}

export function EditorToolbar({ onExportSingle, onExportBatch, onPrintSingle, onPrintBatch }: EditorToolbarProps) {
  const { templates } = useTemplates()
  const currentTemplate = useEditorStore((s) => s.currentTemplate)
  const setCurrentTemplate = useEditorStore((s) => s.setCurrentTemplate)
  const backTemplate = useEditorStore((s) => s.backTemplate)
  const setBackTemplate = useEditorStore((s) => s.setBackTemplate)
  const previewSide = useEditorStore((s) => s.previewSide)
  const setPreviewSide = useEditorStore((s) => s.setPreviewSide)
  const currentPerson = useEditorStore((s) => s.currentPerson)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const selectedPersonIds = useAppStore((s) => s.selectedPersonIds)
  const isGenerating = useEditorStore((s) => s.isGenerating)

  function handleTemplateChange(templateId: string | null) {
    if (!templateId) return
    const template = templates.find((t) => t.id === templateId) ?? null
    setCurrentTemplate(template)
  }

  function handleBackTemplateChange(templateId: string | null) {
    if (!templateId || templateId === "__none__") {
      setBackTemplate(null)
      if (previewSide === "back") setPreviewSide("front")
      return
    }
    const template = templates.find((t) => t.id === templateId) ?? null
    setBackTemplate(template)
  }

  const hasCard = !!currentTemplate && !!currentPerson
  const hasBatch = !!currentTemplate && selectedPersonIds.length > 0

  return (
    <div className="flex h-14 items-center gap-3 border-b bg-card px-4">
      {/* Template selectors */}
      <div className="flex items-center gap-2">
        <Select value={currentTemplate?.id ?? ""} onValueChange={handleTemplateChange}>
          <SelectTrigger className="h-9 w-[200px]">
            <Layers className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Choose template…" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={backTemplate?.id ?? "__none__"}
          onValueChange={handleBackTemplateChange}
        >
          <SelectTrigger className="h-9 w-[170px]">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Back</span>
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No back side</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {backTemplate && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={previewSide === "back" ? "secondary" : "outline"}
                  size="sm"
                  className="h-9 gap-1.5"
                  onClick={() => setPreviewSide(previewSide === "front" ? "back" : "front")}
                >
                  <FlipHorizontal2 className="h-3.5 w-3.5" />
                  <span className="text-[12px] font-medium capitalize">{previewSide}</span>
                </Button>
              }
            />
            <TooltipContent>Flip to {previewSide === "front" ? "back" : "front"} side</TooltipContent>
          </Tooltip>
        )}
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Zoom */}
      <div className="flex items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
                disabled={zoom <= 0.3}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>
        <button
          onClick={() => setZoom(1)}
          className="min-w-[44px] rounded-md px-1.5 text-center text-[12px] font-medium tabular-nums text-foreground hover:bg-card"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon-sm" onClick={() => setZoom(1)}>
                <Maximize2 className="h-3 w-3" />
              </Button>
            }
          />
          <TooltipContent>Fit to view</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1" />

      {/* Status badge */}
      {selectedPersonIds.length > 0 && (
        <div className="hidden items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {selectedPersonIds.length} selected
        </div>
      )}

      {/* Print actions */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={onPrintSingle}
                disabled={!hasCard || isGenerating}
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            }
          />
          <TooltipContent>Print current card</TooltipContent>
        </Tooltip>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 gap-1.5", hasBatch && "border-primary/30")}
          onClick={onPrintBatch}
          disabled={!hasBatch || isGenerating}
        >
          <Printer className="h-3.5 w-3.5" />
          Batch
          {selectedPersonIds.length > 0 && (
            <span className="ml-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
              {selectedPersonIds.length}
            </span>
          )}
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Export actions */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={onExportSingle}
                disabled={!hasCard || isGenerating}
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </Button>
            }
          />
          <TooltipContent>Export as PDF</TooltipContent>
        </Tooltip>
        <Button
          size="sm"
          className="h-9 gap-1.5"
          onClick={onExportBatch}
          disabled={!hasBatch || isGenerating}
        >
          <FileStack className="h-3.5 w-3.5" />
          Export
          {selectedPersonIds.length > 0 && (
            <span className="ml-0.5 rounded-md bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {selectedPersonIds.length}
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}

"use client"

import { useEffect } from "react"
import { useEditorStore } from "@/stores/editor-store"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Eraser, FileStack, X, Sparkles } from "lucide-react"

export function GenerationProgress() {
  const isGenerating = useEditorStore((s) => s.isGenerating)
  const progress = useEditorStore((s) => s.generationProgress)
  const cancelGeneration = useEditorStore((s) => s.cancelGeneration)
  const previewGenerating = useEditorStore((s) => s.previewGenerating)
  const previewProgress = useEditorStore((s) => s.previewProgress)
  const cancelPreview = useEditorStore((s) => s.cancelPreview)

  const isBatch = isGenerating && !!progress
  const active = isBatch || previewGenerating

  // While processing, warn before the tab is closed/refreshed/navigated away.
  useEffect(() => {
    if (!active) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [active])

  if (!active) return null

  // Batch print/export: two phases (bg removal 0–50%, rendering 50–100%).
  // Preview: single bg-removal phase (0–100%).
  let title: string
  let phaseLabel: string
  let phaseSuffix: string
  let current: number
  let total: number
  let overallPercent: number
  let isBgPhase: boolean
  let onCancel: () => void

  if (isBatch) {
    isBgPhase = progress!.current < 0
    current = Math.abs(progress!.current)
    total = progress!.total
    const percent = total ? Math.round((current / total) * 100) : 0
    overallPercent = isBgPhase ? Math.round(percent * 0.5) : Math.round(50 + percent * 0.5)
    title = "Generating ID cards"
    phaseLabel = isBgPhase ? "Removing backgrounds" : "Rendering cards"
    phaseSuffix = isBgPhase ? " · photos processed" : " · cards rendered to PDF"
    onCancel = cancelGeneration
  } else {
    isBgPhase = true
    current = previewProgress?.done ?? 0
    total = previewProgress?.total ?? 0
    overallPercent = total ? Math.round((current / total) * 100) : 0
    title = "Preparing selected cards"
    phaseLabel = "Removing backgrounds"
    phaseSuffix = " · photos processed"
    onCancel = cancelPreview
  }

  return (
    // Full-viewport blocking overlay (above the sidebar). Intentionally NOT
    // dismissable by clicking outside or Escape — only the Cancel button — so
    // users can't accidentally navigate away while images are still processing.
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-xl ring-1 ring-border">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Working</p>
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold tabular-nums text-foreground">
            {overallPercent}%
          </span>
        </div>

        <div className="space-y-4 px-5 py-5">
          <Progress value={overallPercent} className="h-2" />

          <div className="flex items-start gap-3 rounded-xl border bg-muted/30 px-3.5 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card ring-1 ring-border">
              {isBgPhase ? (
                <Eraser className="h-3.5 w-3.5 animate-pulse text-info" />
              ) : (
                <FileStack className="h-3.5 w-3.5 text-success" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-tight">{phaseLabel}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                <span className="tabular-nums">{current}</span>
                <span className="text-muted-foreground/40"> of </span>
                <span className="tabular-nums">{total}</span>
                {phaseSuffix}
              </p>
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Please keep this page open until it finishes.
          </p>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onCancel}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEditorStore } from "@/stores/editor-store"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Eraser, FileStack, X, Sparkles } from "lucide-react"

export function GenerationProgress() {
  const isGenerating = useEditorStore((s) => s.isGenerating)
  const progress = useEditorStore((s) => s.generationProgress)
  const cancelGeneration = useEditorStore((s) => s.cancelGeneration)

  if (!isGenerating || !progress) return null

  // Negative current = background removal phase
  const isBgPhase = progress.current < 0
  const current = Math.abs(progress.current)
  const percent = Math.round((current / progress.total) * 100)
  const overallPercent = isBgPhase ? Math.round(percent * 0.5) : Math.round(50 + percent * 0.5)

  return (
    <Dialog
      open={isGenerating}
      onOpenChange={(open) => { if (!open) cancelGeneration() }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-md" showCloseButton={false}>
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Working</p>
            <h2 className="text-[15px] font-semibold tracking-tight">Generating ID cards</h2>
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
              <p className="text-[13px] font-medium leading-tight">
                {isBgPhase ? "Removing backgrounds" : "Rendering cards"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                <span className="tabular-nums">{current}</span>
                <span className="text-muted-foreground/40"> of </span>
                <span className="tabular-nums">{progress.total}</span>
                {isBgPhase
                  ? " · photos processed"
                  : " · cards rendered to PDF"}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={cancelGeneration}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

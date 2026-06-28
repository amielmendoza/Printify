"use client"

import { useEffect, useRef, useState } from "react"
import { useEditorStore } from "@/stores/editor-store"
import { useAppStore } from "@/stores/app-store"
import { getStorageUrl } from "@/lib/storage-client"
import { createCanvas, renderPersonOnTemplate, exportCanvasToDataUrl, loadTemplateBackground } from "@/lib/canvas"
import { PersonPreviewCard } from "./person-preview-card"
import { SelectedPersonPreviews } from "./selected-person-previews"
import { Loader2, ImageDown, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Canvas } from "fabric"

export function CanvasEditor() {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 600 })

  const frontTemplate = useEditorStore((s) => s.currentTemplate)
  const backTemplate = useEditorStore((s) => s.backTemplate)
  const previewSide = useEditorStore((s) => s.previewSide)
  const template = previewSide === "back" && backTemplate ? backTemplate : frontTemplate
  const person = useEditorStore((s) => s.currentPerson)
  const zoom = useEditorStore((s) => s.zoom)
  const removeBgProcessing = useEditorStore((s) => s.removeBgProcessing)
  const setRemoveBgProcessing = useEditorStore((s) => s.setRemoveBgProcessing)
  const selectedPersonIds = useAppStore((s) => s.selectedPersonIds)

  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current) return
    fabricRef.current = createCanvas(canvasElRef.current, 400, 600)
    ;(window as unknown as Record<string, unknown>).__printifyCanvas = fabricRef
    return () => {
      fabricRef.current?.dispose()
      fabricRef.current = null
    }
  }, [])

  const renderAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    renderAbortRef.current?.abort()
    const abort = new AbortController()
    renderAbortRef.current = abort
    const signal = abort.signal

    if (!template) {
      canvas.clear()
      canvas.backgroundColor = "#ffffff"
      canvas.renderAll()
      setCanvasSize({ width: 400, height: 600 })
      return
    }

    const renderAndResize = async () => {
      const templateImageUrl = await getStorageUrl("templates", template.file_path)
      if (signal.aborted || !templateImageUrl) return

      if (!person) {
        canvas.clear()
        await loadTemplateBackground(canvas, templateImageUrl)
      } else {
        const hasPhoto = (person as Record<string, unknown>).has_photo as boolean
        const photoUrl = hasPhoto ? `/api/persons/${person.id}/photo` : await getStorageUrl("photos", person.photo_path)
        setRemoveBgProcessing(true)
        await renderPersonOnTemplate(canvas, template, person, templateImageUrl, photoUrl, { removeBg: true, signal })
        if (signal.aborted) return
        setRemoveBgProcessing(false)

        if (useAppStore.getState().selectedPersonIds.includes(person.id)) {
          const dataUrl = exportCanvasToDataUrl(canvas)
          window.dispatchEvent(
            new CustomEvent("previewCaptured", { detail: { personId: person.id, dataUrl } })
          )
        }
      }
      if (signal.aborted) return
      setCanvasSize({ width: canvas.getWidth(), height: canvas.getHeight() })
    }

    renderAndResize().catch((err) => {
      if (!signal.aborted) {
        console.error(err)
        setRemoveBgProcessing(false)
      }
    })

    return () => { abort.abort() }
  }, [template, person, previewSide, setRemoveBgProcessing])

  const hasTemplate = !!template
  const hasPerson = !!person

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center overflow-auto bg-canvas-checker p-8"
      >
        {/* Canvas is always mounted so Fabric can initialize on first render */}
        <div
          className={cn(
            "flex flex-col items-center gap-3 transition-opacity",
            hasTemplate ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          aria-hidden={!hasTemplate}
        >
          <div
            className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/[0.06]"
            style={{
              width: canvasSize.width,
              height: canvasSize.height,
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
              transition: "transform 0.18s ease, width 0.2s ease, height 0.2s ease",
            }}
          >
            <canvas ref={canvasElRef} />
          </div>
          {hasTemplate && !hasPerson && (
            <p className="rounded-full bg-card/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-border/60 backdrop-blur">
              Select a person from the right to preview
            </p>
          )}
        </div>

        {!hasTemplate && (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyCanvasState />
          </div>
        )}

        {removeBgProcessing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[3px]">
            <div className="flex items-center gap-3 rounded-2xl bg-card px-5 py-3.5 shadow-xl ring-1 ring-border">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div>
                <p className="text-[13px] font-medium">Processing photo</p>
                <p className="text-[11px] text-muted-foreground">Removing background &amp; compositing…</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t bg-card">
        <div className="p-3">
          {selectedPersonIds.length > 0 ? <SelectedPersonPreviews /> : <PersonPreviewCard />}
        </div>
      </div>
    </div>
  )
}

function EmptyCanvasState() {
  return (
    <div className="flex max-w-md flex-col items-center text-center">
      <div className="relative">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-card shadow-lg ring-1 ring-border">
          <CreditCard className="h-10 w-10 text-muted-foreground/60" strokeWidth={1.5} />
        </div>
        <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md ring-2 ring-background">
          <ImageDown className="h-4 w-4" />
        </div>
      </div>
      <h3 className="mt-6 text-[17px] font-semibold tracking-tight">Pick a template to begin</h3>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Choose a front (and optional back) template from the toolbar above. Then
        select people from the right rail to preview and print.
      </p>
    </div>
  )
}

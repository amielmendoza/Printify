"use client"

import { useCallback, useEffect, useRef } from "react"
import { useEditorStore } from "@/stores/editor-store"
import { useAppStore } from "@/stores/app-store"
import { usePersons } from "@/hooks/use-persons"
import { getStorageUrl } from "@/lib/storage-client"
import { EditorToolbar } from "@/components/editor/editor-toolbar"
import { EditorWrapper } from "@/components/editor/editor-wrapper"
import { PersonList } from "@/components/persons/person-list"
import { GenerationProgress } from "./generation-progress"
import { exportSingleCard, exportBatchCards, printSingleCard, printBatchCards } from "@/lib/export"
import { createCanvas, renderPersonOnTemplate, exportCanvasToDataUrl } from "@/lib/canvas"
import { generateSignOffReportPdf, signOffReportFilename } from "@/lib/report"
import { triggerDownload } from "@/lib/pdf"
import { toast } from "sonner"
import type { Canvas } from "fabric"
import type { Person, Template } from "@/lib/types"

export function GeneratorPageClient({ orgName = "" }: { orgName?: string }) {
  const template = useEditorStore((s) => s.currentTemplate)
  const backTemplate = useEditorStore((s) => s.backTemplate)
  const person = useEditorStore((s) => s.currentPerson)
  const setIsGenerating = useEditorStore((s) => s.setIsGenerating)
  const setGenerationProgress = useEditorStore((s) => s.setGenerationProgress)
  const selectedPersonIds = useAppStore((s) => s.selectedPersonIds)
  const { persons } = usePersons()

  // Dedicated offscreen canvas for all export/print rendering, so those
  // operations never disturb the visible preview canvas (which caused the
  // preview to get stuck on the back template after a batch run).
  const offscreenRef = useRef<{ canvas: Canvas; container: HTMLDivElement } | null>(null)
  const getOffscreenCanvas = useCallback((): Canvas => {
    if (offscreenRef.current) return offscreenRef.current.canvas
    const container = document.createElement("div")
    container.style.cssText =
      "position:fixed;top:-10000px;left:-10000px;width:0;height:0;overflow:hidden;pointer-events:none"
    document.body.appendChild(container)
    const el = document.createElement("canvas")
    container.appendChild(el)
    const canvas = createCanvas(el, 400, 600)
    offscreenRef.current = { canvas, container }
    return canvas
  }, [])

  useEffect(() => {
    return () => {
      offscreenRef.current?.canvas.dispose()
      if (offscreenRef.current?.container) {
        document.body.removeChild(offscreenRef.current.container)
      }
      offscreenRef.current = null
    }
  }, [])

  const recordCards = useCallback(
    async (printedPersons: Person[], templateUsed: Template, action: "printed" | "exported") => {
      try {
        const entries = printedPersons.map((p) => ({
          person_external_id: p.id,
          person_name: `${p.first_name} ${p.last_name}`,
          template_id: templateUsed.id,
          template_name: templateUsed.name,
          action,
        }))
        await fetch("/api/print-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entries),
        })
      } catch (err) {
        console.error("Failed to record print log:", err)
      }
    },
    []
  )

  const getTemplateImageUrl = useCallback(
    async (t: Template) => (await getStorageUrl("templates", t.file_path))!,
    []
  )

  const getPhotoUrl = useCallback(
    async (p: Person) =>
      (p as Record<string, unknown>).has_photo
        ? `/api/persons/${p.id}/photo`
        : await getStorageUrl("photos", p.photo_path),
    []
  )

  const handleExportSingle = useCallback(async () => {
    if (!person || !template) return
    try {
      const canvas = getOffscreenCanvas()
      const photoUrl = await getPhotoUrl(person)
      let backDataUrl: string | undefined
      if (backTemplate) {
        const backImgUrl = await getTemplateImageUrl(backTemplate)
        await renderPersonOnTemplate(canvas, backTemplate, person, backImgUrl, photoUrl, { removeBg: true })
        backDataUrl = exportCanvasToDataUrl(canvas, "png", 1.0, 2)
      }
      const frontImgUrl = await getTemplateImageUrl(template)
      await renderPersonOnTemplate(canvas, template, person, frontImgUrl, photoUrl, { removeBg: true })
      await exportSingleCard(canvas, `${person.first_name}-${person.last_name}`, backDataUrl, {
        cardWidthInches: template.width_inches,
        cardHeightInches: template.height_inches,
      })
      await recordCards([person], template, "exported")
      toast.success("ID card exported", { description: `${person.first_name} ${person.last_name}` })
    } catch (err) {
      toast.error("Export failed")
      console.error(err)
    }
  }, [getOffscreenCanvas, person, template, backTemplate, getPhotoUrl, getTemplateImageUrl, recordCards])

  const handleExportBatch = useCallback(async () => {
    if (!template) return
    const canvas = getOffscreenCanvas()

    const selected = persons.filter((p: Person) => selectedPersonIds.includes(p.id))
    if (selected.length === 0) {
      toast.error("No persons selected")
      return
    }

    setIsGenerating(true)
    const { generationAbort } = useEditorStore.getState()
    const signal = generationAbort?.signal

    const isDuplex = !!backTemplate
    // One card per page at the template's real size — the PDF matches the
    // print path's output exactly (no grid scaling, no stretching).
    const pdfOptions = {
      pageSize: "card" as const,
      cardWidthInches: template.width_inches,
      cardHeightInches: template.height_inches,
    }

    try {
      await exportBatchCards(
        canvas,
        template,
        selected,
        getPhotoUrl,
        getTemplateImageUrl,
        pdfOptions,
        (current, total) => setGenerationProgress({ current, total }),
        { removeBg: true, signal },
        backTemplate
      )
      if (!signal?.aborted) {
        await recordCards(selected, template, "exported")
        toast.success(`Exported ${selected.length} ID card${selected.length === 1 ? "" : "s"}`, {
          description: isDuplex ? "Duplex · 1 card per page · actual size" : "1 card per page · actual size",
        })
      }
    } catch (err) {
      if (!signal?.aborted) {
        toast.error("Batch export failed")
        console.error(err)
      }
    } finally {
      setIsGenerating(false)
      setGenerationProgress(null)
    }
  }, [getOffscreenCanvas, template, backTemplate, persons, selectedPersonIds, getPhotoUrl, getTemplateImageUrl, setIsGenerating, setGenerationProgress, recordCards])

  const handleReport = useCallback(async () => {
    const selected = persons.filter((p: Person) => selectedPersonIds.includes(p.id))
    if (selected.length === 0) {
      toast.error("No persons selected")
      return
    }

    setIsGenerating(true)
    const { generationAbort } = useEditorStore.getState()
    const signal = generationAbort?.signal

    try {
      const bytes = await generateSignOffReportPdf(selected, {
        orgName,
        getPhotoUrl,
        template,
        onProgress: (current, total) => setGenerationProgress({ current, total }),
        signal,
      })
      if (!signal?.aborted) {
        triggerDownload(bytes, signOffReportFilename(selected))
        toast.success("Sign-off report downloaded", {
          description: `${selected.length} ${selected.length === 1 ? "person" : "persons"}`,
        })
      }
    } catch (err) {
      if (!signal?.aborted) {
        toast.error("Report generation failed")
        console.error(err)
      }
    } finally {
      setIsGenerating(false)
      setGenerationProgress(null)
    }
  }, [persons, selectedPersonIds, orgName, template, getPhotoUrl, setIsGenerating, setGenerationProgress])

  const handlePrintSingle = useCallback(async () => {
    if (!person || !template) return
    try {
      const canvas = getOffscreenCanvas()
      const photoUrl = await getPhotoUrl(person)
      let backDataUrl: string | undefined
      if (backTemplate) {
        const backImgUrl = await getTemplateImageUrl(backTemplate)
        await renderPersonOnTemplate(canvas, backTemplate, person, backImgUrl, photoUrl, { removeBg: true })
        backDataUrl = exportCanvasToDataUrl(canvas, "png", 1.0, 1) // print: lighter raster
      }
      const frontImgUrl = await getTemplateImageUrl(template)
      await renderPersonOnTemplate(canvas, template, person, frontImgUrl, photoUrl, { removeBg: true })
      printSingleCard(canvas, backDataUrl)
      await recordCards([person], template, "printed")
      toast.success("Print dialog opened")
    } catch (err) {
      toast.error("Print failed")
      console.error(err)
    }
  }, [getOffscreenCanvas, person, template, backTemplate, getPhotoUrl, getTemplateImageUrl, recordCards])

  const handlePrintBatch = useCallback(async () => {
    if (!template) return
    const canvas = getOffscreenCanvas()

    const selected = persons.filter((p: Person) => selectedPersonIds.includes(p.id))
    if (selected.length === 0) {
      toast.error("No persons selected")
      return
    }

    setIsGenerating(true)
    const { generationAbort } = useEditorStore.getState()
    const signal = generationAbort?.signal

    try {
      await printBatchCards(
        canvas,
        template,
        selected,
        getPhotoUrl,
        getTemplateImageUrl,
        (current, total) => setGenerationProgress({ current, total }),
        { removeBg: true, signal },
        backTemplate
      )
      if (!signal?.aborted) {
        await recordCards(selected, template, "printed")
        toast.success("Print dialog opened", { description: `${selected.length} card${selected.length === 1 ? "" : "s"}` })
      }
    } catch (err) {
      if (!signal?.aborted) {
        toast.error("Print failed")
        console.error(err)
      }
    } finally {
      setIsGenerating(false)
      setGenerationProgress(null)
    }
  }, [getOffscreenCanvas, template, backTemplate, persons, selectedPersonIds, getPhotoUrl, getTemplateImageUrl, setIsGenerating, setGenerationProgress, recordCards])

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        <EditorToolbar
          onExportSingle={handleExportSingle}
          onExportBatch={handleExportBatch}
          onPrintSingle={handlePrintSingle}
          onPrintBatch={handlePrintBatch}
          onReport={handleReport}
        />
        <EditorWrapper />
      </div>
      <aside className="hidden w-[360px] shrink-0 flex-col border-l bg-card lg:flex">
        <PersonList showSelection compact requireGradeSection />
      </aside>
      <GenerationProgress />
    </div>
  )
}

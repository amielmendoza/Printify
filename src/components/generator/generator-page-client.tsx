"use client"

import { useCallback } from "react"
import { useEditorStore } from "@/stores/editor-store"
import { useAppStore } from "@/stores/app-store"
import { usePersons } from "@/hooks/use-persons"
import { getStorageUrl } from "@/lib/storage-client"
import { EditorToolbar } from "@/components/editor/editor-toolbar"
import { EditorWrapper } from "@/components/editor/editor-wrapper"
import { PersonList } from "@/components/persons/person-list"
import { GenerationProgress } from "./generation-progress"
import { exportSingleCard, exportBatchCards, printSingleCard, printBatchCards } from "@/lib/export"
import { toast } from "sonner"
import type { Canvas } from "fabric"
import type { Person, Template } from "@/lib/types"

export function GeneratorPageClient() {
  const template = useEditorStore((s) => s.currentTemplate)
  const backTemplate = useEditorStore((s) => s.backTemplate)
  const person = useEditorStore((s) => s.currentPerson)
  const setIsGenerating = useEditorStore((s) => s.setIsGenerating)
  const setGenerationProgress = useEditorStore((s) => s.setGenerationProgress)
  const selectedPersonIds = useAppStore((s) => s.selectedPersonIds)
  const { persons } = usePersons()

  const getCanvas = useCallback((): Canvas | null => {
    const ref = (window as unknown as Record<string, unknown>).__printifyCanvas as
      | React.RefObject<Canvas | null>
      | undefined
    return ref?.current ?? null
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
    const canvas = getCanvas()
    if (!canvas || !person || !template) return
    try {
      let backDataUrl: string | undefined
      if (backTemplate) {
        const { renderPersonOnTemplate, exportCanvasToDataUrl } = await import("@/lib/canvas")
        const backImgUrl = await getTemplateImageUrl(backTemplate)
        const photoUrl = await getPhotoUrl(person)
        await renderPersonOnTemplate(canvas, backTemplate, person, backImgUrl, photoUrl, { removeBg: true })
        backDataUrl = exportCanvasToDataUrl(canvas, "png", 1.0, 3)
        const frontImgUrl = await getTemplateImageUrl(template)
        await renderPersonOnTemplate(canvas, template, person, frontImgUrl, photoUrl, { removeBg: true })
      }
      await exportSingleCard(canvas, `${person.first_name}-${person.last_name}`, backDataUrl)
      await recordCards([person], template, "exported")
      toast.success("ID card exported", { description: `${person.first_name} ${person.last_name}` })
    } catch (err) {
      toast.error("Export failed")
      console.error(err)
    }
  }, [getCanvas, person, template, backTemplate, getPhotoUrl, getTemplateImageUrl, recordCards])

  const handleExportBatch = useCallback(async () => {
    const canvas = getCanvas()
    if (!canvas || !template) return

    const selected = persons.filter((p: Person) => selectedPersonIds.includes(p.id))
    if (selected.length === 0) {
      toast.error("No persons selected")
      return
    }

    setIsGenerating(true)
    const { generationAbort } = useEditorStore.getState()
    const signal = generationAbort?.signal

    const isDuplex = !!backTemplate
    const pdfOptions = isDuplex
      ? { pageSize: "card" as const }
      : { pageSize: "letter" as const, cardsPerRow: 2, cardsPerColumn: 4, margin: 36, spacing: 18, includeCutMarks: false }

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
          description: isDuplex ? "Duplex layout · 1 card per page" : "2 × 4 grid · letter size",
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
  }, [getCanvas, template, backTemplate, persons, selectedPersonIds, getPhotoUrl, getTemplateImageUrl, setIsGenerating, setGenerationProgress, recordCards])

  const handlePrintSingle = useCallback(async () => {
    const canvas = getCanvas()
    if (!canvas || !person || !template) return
    try {
      let backDataUrl: string | undefined
      if (backTemplate) {
        const { renderPersonOnTemplate, exportCanvasToDataUrl } = await import("@/lib/canvas")
        const backImgUrl = await getTemplateImageUrl(backTemplate)
        const photoUrl = await getPhotoUrl(person)
        await renderPersonOnTemplate(canvas, backTemplate, person, backImgUrl, photoUrl, { removeBg: true })
        backDataUrl = exportCanvasToDataUrl(canvas, "png", 1.0, 3)
        const frontImgUrl = await getTemplateImageUrl(template)
        await renderPersonOnTemplate(canvas, template, person, frontImgUrl, photoUrl, { removeBg: true })
      }
      printSingleCard(canvas, backDataUrl)
      await recordCards([person], template, "printed")
    } catch (err) {
      toast.error("Print failed")
      console.error(err)
    }
  }, [getCanvas, person, template, backTemplate, getPhotoUrl, getTemplateImageUrl, recordCards])

  const handlePrintBatch = useCallback(async () => {
    const canvas = getCanvas()
    if (!canvas || !template) return

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
        toast.success("Print dialog opened", { description: `${selected.length} card${selected.length === 1 ? "" : "s"} queued` })
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
  }, [getCanvas, template, backTemplate, persons, selectedPersonIds, getPhotoUrl, getTemplateImageUrl, setIsGenerating, setGenerationProgress, recordCards])

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        <EditorToolbar
          onExportSingle={handleExportSingle}
          onExportBatch={handleExportBatch}
          onPrintSingle={handlePrintSingle}
          onPrintBatch={handlePrintBatch}
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

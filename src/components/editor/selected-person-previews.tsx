"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useAppStore } from "@/stores/app-store"
import { useEditorStore } from "@/stores/editor-store"
import { usePersons } from "@/hooks/use-persons"
import { getStorageUrl } from "@/lib/storage-client"
import { createCanvas, renderPersonOnTemplate, exportCanvasToDataUrl } from "@/lib/canvas"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Loader2, ImageIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Canvas } from "fabric"

export function SelectedPersonPreviews() {
  const template = useEditorStore((s) => s.currentTemplate)
  const currentPerson = useEditorStore((s) => s.currentPerson)
  const setCurrentPerson = useEditorStore((s) => s.setCurrentPerson)
  const selectedPersonIds = useAppStore((s) => s.selectedPersonIds)
  const { persons } = usePersons()

  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [renderingId, setRenderingId] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)

  const offscreenRef = useRef<Canvas | null>(null)
  const offscreenContainerRef = useRef<HTMLDivElement | null>(null)
  const renderedSetRef = useRef<Set<string>>(new Set())
  const cancelledRef = useRef(false)
  const generationIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  // Refs for latest values in the async render loop
  const templateRef = useRef(template)
  templateRef.current = template
  const personsRef = useRef(persons)
  personsRef.current = persons

  const selectedPersons = persons.filter((p) => selectedPersonIds.includes(p.id))
  const renderedCount = selectedPersons.filter((p) => previews[p.id]).length
  const isGenerating = renderingId !== null && !cancelled

  // Create hidden container for offscreen Fabric.js canvas
  useEffect(() => {
    const container = document.createElement("div")
    container.style.cssText =
      "position:fixed;top:-10000px;left:-10000px;width:0;height:0;overflow:hidden;pointer-events:none"
    document.body.appendChild(container)
    offscreenContainerRef.current = container

    return () => {
      offscreenRef.current?.dispose()
      offscreenRef.current = null
      document.body.removeChild(container)
      offscreenContainerRef.current = null
    }
  }, [])

  // Listen for preview captured by the main canvas (avoids duplicate rendering)
  useEffect(() => {
    const handler = (e: Event) => {
      const { personId, dataUrl } = (e as CustomEvent).detail as { personId: string; dataUrl: string }
      if (useAppStore.getState().selectedPersonIds.includes(personId)) {
        renderedSetRef.current.add(personId)
        setPreviews((prev) => ({ ...prev, [personId]: dataUrl }))
      }
    }
    window.addEventListener("previewCaptured", handler)
    return () => window.removeEventListener("previewCaptured", handler)
  }, [])

  const handleCancel = useCallback(() => {
    cancelledRef.current = true
    abortRef.current?.abort()
    setCancelled(true)
  }, [])

  // Process render queue — uses refs so it always reads latest state
  const processQueue = useCallback(async () => {
    // Abort any previous generation
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort
    const signal = abort.signal

    const myGenId = ++generationIdRef.current
    cancelledRef.current = false
    setCancelled(false)

    const tpl = templateRef.current
    if (!tpl) return

    const templateImageUrl = await getStorageUrl("templates", tpl.file_path)
    if (signal.aborted || !templateImageUrl) return

    // Create offscreen canvas if needed
    if (!offscreenRef.current && offscreenContainerRef.current) {
      const el = document.createElement("canvas")
      offscreenContainerRef.current.appendChild(el)
      offscreenRef.current = createCanvas(el, 400, 600)
    }

    const canvas = offscreenRef.current
    if (!canvas) return

    // Wait a tick so the old loop's in-flight await can see the abort
    await new Promise((r) => setTimeout(r, 0))
    if (signal.aborted) return

    // Keep processing until no more unrendered selected persons
    while (!signal.aborted && !cancelledRef.current) {
      const currentSelected = useAppStore.getState().selectedPersonIds
      const currentPersonId = useEditorStore.getState().currentPerson?.id
      const allPersons = personsRef.current
      // Skip the current person — main canvas handles it and shares via previewCaptured event
      const next = allPersons.find(
        (p) =>
          currentSelected.includes(p.id) &&
          !renderedSetRef.current.has(p.id) &&
          p.id !== currentPersonId
      )

      if (!next) break

      setRenderingId(next.id)

      const hasPhoto = (next as Record<string, unknown>).has_photo as boolean
      const photoUrl = hasPhoto
        ? `/api/persons/${next.id}/photo`
        : await getStorageUrl("photos", next.photo_path)

      try {
        await renderPersonOnTemplate(canvas, tpl, next, templateImageUrl, photoUrl, {
          removeBg: true,
          signal,
        })

        if (signal.aborted || cancelledRef.current) break

        // Verify still selected after render completes
        if (useAppStore.getState().selectedPersonIds.includes(next.id)) {
          const dataUrl = exportCanvasToDataUrl(canvas)
          renderedSetRef.current.add(next.id)
          setPreviews((prev) => ({ ...prev, [next.id]: dataUrl }))
        }
      } catch (err) {
        if (signal.aborted || cancelledRef.current) break
        console.error("Preview render failed for", next.id, err)
      }
    }

    // Only clear state if this is still the active generation
    if (generationIdRef.current === myGenId) {
      setRenderingId(null)
    }
  }, [])

  // Trigger processing when selection or persons change
  useEffect(() => {
    if (selectedPersonIds.length > 0 && persons.length > 0 && template) {
      // Reset cancelled state when new persons are selected
      cancelledRef.current = false
      setCancelled(false)
      processQueue()
    }
  }, [selectedPersonIds, persons, template, processQueue])

  // Clean up previews for deselected persons
  useEffect(() => {
    const selectedSet = new Set(selectedPersonIds)

    for (const id of renderedSetRef.current) {
      if (!selectedSet.has(id)) renderedSetRef.current.delete(id)
    }

    setPreviews((prev) => {
      const next: Record<string, string> = {}
      for (const [id, url] of Object.entries(prev)) {
        if (selectedSet.has(id)) next[id] = url
      }
      return Object.keys(next).length === Object.keys(prev).length ? prev : next
    })
  }, [selectedPersonIds])

  // Reset all previews and restart renders when template changes
  useEffect(() => {
    renderedSetRef.current.clear()
    setPreviews({})
    setRenderingId(null)
    setCancelled(false)
    // processQueue will be triggered by the template dependency in the trigger effect below
  }, [template?.id])

  if (selectedPersons.length === 0) return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium text-muted-foreground">
          {cancelled
            ? `Generation stopped — ${renderedCount} of ${selectedPersons.length} generated`
            : renderedCount === selectedPersons.length
              ? `${selectedPersons.length} ID card${selectedPersons.length > 1 ? "s" : ""} generated`
              : `Generating ${renderedCount + 1} of ${selectedPersons.length}...`}
        </p>
        <div className="flex items-center gap-1.5">
          {isGenerating && (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                onClick={handleCancel}
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-2 pb-2">
          {selectedPersons.map((person) => {
            const preview = previews[person.id]
            const isActive = currentPerson?.id === person.id
            const isRendering = renderingId === person.id && !cancelled

            return (
              <button
                key={person.id}
                onClick={() => setCurrentPerson(person)}
                className={cn(
                  "group flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all",
                  isActive
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-transparent hover:border-muted-foreground/30"
                )}
              >
                <div className="relative w-24">
                  {preview ? (
                    <img
                      src={preview}
                      alt={`${person.first_name} ${person.last_name}`}
                      className="w-full h-auto block"
                    />
                  ) : (
                    <div className="aspect-[3/4.5] bg-muted flex flex-col items-center justify-center gap-1">
                      {isRendering ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                      )}
                      <span className="text-[8px] text-muted-foreground">
                        {isRendering ? "Rendering..." : cancelled ? "Stopped" : "Queued"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-1 py-0.5 bg-card text-center">
                  <p className="text-[9px] font-medium truncate max-w-[88px]">
                    {person.first_name} {person.last_name}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

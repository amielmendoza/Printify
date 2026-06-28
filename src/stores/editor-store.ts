import { create } from "zustand"
import type { Template, Person } from "@/lib/types"

type PreviewSide = "front" | "back"

interface EditorState {
  currentTemplate: Template | null
  backTemplate: Template | null
  previewSide: PreviewSide
  zoom: number
  isDirty: boolean
  isGenerating: boolean
  generationProgress: { current: number; total: number } | null
  generationAbort: AbortController | null
  removeBgProcessing: boolean
  currentPerson: Person | null

  setCurrentTemplate: (template: Template | null) => void
  setBackTemplate: (template: Template | null) => void
  setPreviewSide: (side: PreviewSide) => void
  setCurrentPerson: (person: Person | null) => void
  setZoom: (zoom: number) => void
  markDirty: () => void
  markClean: () => void
  setIsGenerating: (generating: boolean) => void
  setGenerationProgress: (progress: { current: number; total: number } | null) => void
  cancelGeneration: () => void
  setRemoveBgProcessing: (processing: boolean) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentTemplate: null,
  backTemplate: null,
  previewSide: "front" as PreviewSide,
  currentPerson: null,
  zoom: 1,
  isDirty: false,
  isGenerating: false,
  generationProgress: null,
  generationAbort: null,
  removeBgProcessing: false,

  setCurrentTemplate: (template) => set({ currentTemplate: template }),
  setBackTemplate: (template) => set({ backTemplate: template }),
  setPreviewSide: (side) => set({ previewSide: side }),
  setCurrentPerson: (person) => set({ currentPerson: person, isDirty: false }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(3, zoom)) }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
  setIsGenerating: (generating) => {
    if (generating) {
      const abort = new AbortController()
      set({ isGenerating: true, generationAbort: abort })
    } else {
      set({ isGenerating: false, generationAbort: null })
    }
  },
  setGenerationProgress: (progress) => set({ generationProgress: progress }),
  cancelGeneration: () => {
    const { generationAbort } = get()
    generationAbort?.abort()
    set({ isGenerating: false, generationProgress: null, generationAbort: null })
  },
  setRemoveBgProcessing: (processing) => set({ removeBgProcessing: processing }),
}))

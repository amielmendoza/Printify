import { create } from "zustand"
import type { Organization, Profile } from "@/lib/types"

interface AppState {
  currentOrganization: Organization | null
  currentProfile: Profile | null
  selectedPersonIds: string[]
  selectedTemplateId: string | null

  setOrganization: (org: Organization | null) => void
  setProfile: (profile: Profile | null) => void
  setSelectedTemplate: (id: string | null) => void
  togglePersonSelection: (id: string) => void
  selectPersons: (ids: string[]) => void
  clearPersonSelection: () => void
  selectAllPersons: (ids: string[]) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentOrganization: null,
  currentProfile: null,
  selectedPersonIds: [],
  selectedTemplateId: null,

  setOrganization: (org) => set({ currentOrganization: org }),
  setProfile: (profile) => set({ currentProfile: profile }),
  setSelectedTemplate: (id) => set({ selectedTemplateId: id }),

  togglePersonSelection: (id) =>
    set((state) => ({
      selectedPersonIds: state.selectedPersonIds.includes(id)
        ? state.selectedPersonIds.filter((pid) => pid !== id)
        : [...state.selectedPersonIds, id],
    })),

  selectPersons: (ids) => set({ selectedPersonIds: ids }),

  clearPersonSelection: () => set({ selectedPersonIds: [] }),

  selectAllPersons: (ids) => set({ selectedPersonIds: ids }),
}))

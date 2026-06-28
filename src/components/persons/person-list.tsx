"use client"

import { useState, useMemo } from "react"
import { usePersons } from "@/hooks/use-persons"
import { useAppStore } from "@/stores/app-store"
import { useEditorStore } from "@/stores/editor-store"
import { PersonCard } from "./person-card"
import { PersonFilters } from "./person-filters"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown, Loader2, Users, Lock, Filter } from "lucide-react"
import type { Person } from "@/lib/types"

const PAGE_SIZE = 50

interface PersonListProps {
  showSelection?: boolean
  compact?: boolean
  requireGradeSection?: boolean
}

export function PersonList({ showSelection = true, compact = false, requireGradeSection = false }: PersonListProps) {
  const [search, setSearch] = useState("")
  const [personType, setPersonType] = useState<string>("all")
  const [gradeLevel, setGradeLevel] = useState<string>("all")
  const [section, setSection] = useState<string>("all")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const { persons, loading, gradeLevels, sections } = usePersons({ search, personType, gradeLevel, section })

  const selectedPersonIds = useAppStore((s) => s.selectedPersonIds)
  const togglePersonSelection = useAppStore((s) => s.togglePersonSelection)
  const selectAllPersons = useAppStore((s) => s.selectAllPersons)
  const clearPersonSelection = useAppStore((s) => s.clearPersonSelection)
  const currentPerson = useEditorStore((s) => s.currentPerson)
  const setCurrentPerson = useEditorStore((s) => s.setCurrentPerson)
  const template = useEditorStore((s) => s.currentTemplate)
  const noTemplate = !template

  const visiblePersons = useMemo(
    () => persons.slice(0, visibleCount),
    [persons, visibleCount]
  )

  const selectPersons = useAppStore((s) => s.selectPersons)

  const allSelected = persons.length > 0 && persons.every((p) => selectedPersonIds.includes(p.id))
  const pageSelected = visiblePersons.length > 0 && visiblePersons.every((p) => selectedPersonIds.includes(p.id))

  function handleToggleAll() {
    if (allSelected) {
      clearPersonSelection()
    } else {
      selectAllPersons(persons.map((p) => p.id))
    }
  }

  function handleSelectPage() {
    if (pageSelected) {
      const pageIds = new Set(visiblePersons.map((p) => p.id))
      selectPersons(selectedPersonIds.filter((id) => !pageIds.has(id)))
    } else {
      const existing = new Set(selectedPersonIds)
      const merged = [...selectedPersonIds, ...visiblePersons.filter((p) => !existing.has(p.id)).map((p) => p.id)]
      selectPersons(merged)
    }
  }

  function handlePersonClick(person: Person) {
    setCurrentPerson(person)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    setVisibleCount(PAGE_SIZE)
  }

  function handleTypeChange(value: string) {
    setPersonType(value)
    setVisibleCount(PAGE_SIZE)
  }

  function handleGradeLevelChange(value: string) {
    setGradeLevel(value)
    setSection("all")
    setVisibleCount(PAGE_SIZE)
  }

  function handleSectionChange(value: string) {
    setSection(value)
    setVisibleCount(PAGE_SIZE)
  }

  const remaining = persons.length - visibleCount

  // Gate the list when we have student data and the user hasn't picked both
  // grade level and section yet. Employees aren't affected.
  const isStudentScope = personType === "all" || personType === "student"
  const hasGradeData = (gradeLevels?.length ?? 0) > 0
  const filtersIncomplete =
    !gradeLevel || gradeLevel === "all" || !section || section === "all"
  const isGated =
    requireGradeSection && isStudentScope && hasGradeData && filtersIncomplete

  return (
    <div className="relative flex h-full flex-col">
      {noTemplate && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 px-6 backdrop-blur-[3px]">
          <div className="flex flex-col items-center gap-2.5 rounded-2xl bg-card px-5 py-4 text-center shadow-lg ring-1 ring-border">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[13px] font-semibold">Select a template</p>
              <p className="text-[11px] text-muted-foreground">
                Pick a template above to start generating IDs.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[13px] font-semibold tracking-tight">Persons</h3>
            {persons.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                {persons.length}
              </span>
            )}
          </div>
          {selectedPersonIds.length > 0 && (
            <button
              onClick={clearPersonSelection}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <PersonFilters
          search={search}
          onSearchChange={handleSearchChange}
          personType={personType}
          onTypeChange={handleTypeChange}
          gradeLevel={gradeLevel}
          onGradeLevelChange={handleGradeLevelChange}
          gradeLevels={gradeLevels}
          section={section}
          onSectionChange={handleSectionChange}
          sections={sections}
        />
        {showSelection && !isGated && persons.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-2.5 py-1.5">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={allSelected} onCheckedChange={handleToggleAll} />
              <span className="text-[12px] text-muted-foreground">
                {allSelected ? "Deselect all" : "Select all"}
              </span>
            </label>
            {persons.length > visiblePersons.length && (
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
                <Checkbox checked={pageSelected} onCheckedChange={handleSelectPage} />
                Page ({visiblePersons.length})
              </label>
            )}
            {selectedPersonIds.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
                {selectedPersonIds.length}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin border-t">
        <div className={compact ? "space-y-0.5 p-2" : "space-y-1 p-3"}>
          {isGated ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Filter className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-[13px] font-semibold">Pick grade &amp; section</p>
              <p className="mt-1 max-w-[220px] text-[11px] text-muted-foreground">
                Choose a <span className="font-medium text-foreground">grade level</span>
                {" and "}
                <span className="font-medium text-foreground">section</span> above to load students.
              </p>
              {(gradeLevel === "all" || !gradeLevel) && hasGradeData && (
                <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  Grade level required
                </p>
              )}
              {gradeLevel && gradeLevel !== "all" && (!section || section === "all") && (
                <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  Section required
                </p>
              )}
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-[12px] text-muted-foreground">Loading persons…</p>
            </div>
          ) : visiblePersons.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-[13px] font-medium">No persons found</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Try a different filter or search term.
              </p>
            </div>
          ) : (
            <>
              {visiblePersons.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  isSelected={selectedPersonIds.includes(person.id)}
                  isActive={currentPerson?.id === person.id}
                  onToggleSelect={togglePersonSelection}
                  onClick={handlePersonClick}
                />
              ))}
              {remaining > 0 && (
                <Button
                  variant="ghost"
                  className="mt-1 w-full gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  Load {Math.min(PAGE_SIZE, remaining)} more · {remaining} remaining
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

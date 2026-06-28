"use client"

import { useState, useMemo } from "react"
import { usePersons } from "@/hooks/use-persons"
import { useAppStore } from "@/stores/app-store"
import { PersonFilters } from "@/components/persons/person-filters"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronLeft, ChevronRight, Users, Plus, Download } from "lucide-react"
import type { Person } from "@/lib/types"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 50

const typeStyles: Record<string, { dot: string }> = {
  student:  { dot: "bg-info" },
  employee: { dot: "bg-success" },
  faculty:  { dot: "bg-success" },
  staff:    { dot: "bg-chart-4" },
  visitor:  { dot: "bg-warning" },
  other:    { dot: "bg-muted-foreground/60" },
}

function PersonPhotoCell({ personId, hasPhoto, initials }: { personId: string; hasPhoto?: boolean; initials: string }) {
  const url = hasPhoto ? `/api/persons/${personId}/photo` : undefined
  return (
    <Avatar className="h-9 w-9 ring-1 ring-border/60">
      {url && <AvatarImage src={url} />}
      <AvatarFallback className="bg-gradient-to-br from-muted to-muted/60 text-[11px] font-semibold text-muted-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}

export default function PersonsPage() {
  const [search, setSearch] = useState("")
  const [personType, setPersonType] = useState<string>("all")
  const [gradeLevel, setGradeLevel] = useState<string>("all")
  const [section, setSection] = useState<string>("all")
  const [page, setPage] = useState(1)
  const { persons, loading, gradeLevels, sections } = usePersons({ search, personType, gradeLevel, section })

  const selectedPersonIds = useAppStore((s) => s.selectedPersonIds)
  const togglePersonSelection = useAppStore((s) => s.togglePersonSelection)
  const selectAllPersons = useAppStore((s) => s.selectAllPersons)
  const clearPersonSelection = useAppStore((s) => s.clearPersonSelection)

  const totalPages = Math.max(1, Math.ceil(persons.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const paginatedPersons = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return persons.slice(start, start + PAGE_SIZE)
  }, [persons, currentPage])

  const allPageSelected =
    paginatedPersons.length > 0 && paginatedPersons.every((p) => selectedPersonIds.includes(p.id))

  function handleToggleAllPage() {
    if (allPageSelected) {
      clearPersonSelection()
    } else {
      selectAllPersons(paginatedPersons.map((p) => p.id))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        eyebrow="Workspace"
        title="Persons"
        description={persons.length > 0 ? `${persons.length.toLocaleString()} people in your directory` : "Manage people for ID generation"}
        actions={
          <>
            {selectedPersonIds.length > 0 && (
              <div className="hidden items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary md:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {selectedPersonIds.length} selected
              </div>
            )}
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" className="h-9 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add person
            </Button>
          </>
        }
      />

      {/* Filter bar */}
      <div className="border-b bg-card px-6 py-3">
        <div className="mx-auto w-full max-w-5xl">
          <PersonFilters
            search={search}
            onSearchChange={(v) => { setSearch(v); setPage(1) }}
            personType={personType}
            onTypeChange={(v) => { setPersonType(v); setPage(1) }}
            gradeLevel={gradeLevel}
            onGradeLevelChange={(v) => { setGradeLevel(v); setSection("all"); setPage(1) }}
            gradeLevels={gradeLevels}
            section={section}
            onSectionChange={(v) => { setSection(v); setPage(1) }}
            sections={sections}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <div className="mx-auto w-full max-w-5xl p-6">
          <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-12 pl-4">
                    <Checkbox checked={allPageSelected} onCheckedChange={handleToggleAllPage} />
                  </TableHead>
                  <TableHead className="w-14"></TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">ID Number</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex flex-col items-center gap-3 py-16">
                        <div className="h-2 w-32 animate-pulse rounded-full bg-muted" />
                        <div className="h-2 w-24 animate-pulse rounded-full bg-muted" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedPersons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="mt-3 text-[14px] font-semibold">No persons found</p>
                        <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">
                          {search ? "Try clearing your search or filters." : "Add your first person to get started."}
                        </p>
                        {!search && (
                          <Button size="sm" className="mt-4 h-9 gap-1.5">
                            <Plus className="h-3.5 w-3.5" /> Add person
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPersons.map((person: Person) => {
                    const hasPhoto = (person as Record<string, unknown>).has_photo as boolean
                    const initials = `${person.first_name?.[0] ?? ""}${person.last_name?.[0] ?? ""}`.toUpperCase() || "??"
                    const style = typeStyles[person.person_type] ?? typeStyles.other
                    const isSelected = selectedPersonIds.includes(person.id)
                    return (
                      <TableRow
                        key={person.id}
                        className={cn("group transition-colors", isSelected && "bg-primary/[0.02]")}
                      >
                        <TableCell className="pl-4">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => togglePersonSelection(person.id)}
                          />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <PersonPhotoCell personId={person.id} hasPhoto={hasPhoto} initials={initials} />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="text-[13px] leading-tight">
                              {person.last_name}, {person.first_name}
                              {person.middle_name ? ` ${person.middle_name}` : ""}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-[12px] capitalize">
                            <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                            {person.person_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">
                          {person.category ?? "—"}
                        </TableCell>
                        <TableCell className="text-[12px] tabular-nums text-muted-foreground">
                          {person.id_number ?? "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {persons.length > 0 && (
            <div className="mt-4 flex items-center justify-between px-1">
              <p className="text-[12px] text-muted-foreground">
                Showing <span className="font-medium text-foreground tabular-nums">{((currentPage - 1) * PAGE_SIZE) + 1}</span>
                {"–"}
                <span className="font-medium text-foreground tabular-nums">{Math.min(currentPage * PAGE_SIZE, persons.length)}</span>
                {" of "}
                <span className="font-medium text-foreground tabular-nums">{persons.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <span className="rounded-md border bg-card px-2.5 py-1 text-[12px] tabular-nums text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

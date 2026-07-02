"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X } from "lucide-react"

interface PersonFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  personType: string
  onTypeChange: (type: string) => void
  gradeLevel?: string
  onGradeLevelChange?: (value: string) => void
  gradeLevels?: string[]
  section?: string
  onSectionChange?: (value: string) => void
  sections?: string[]
}

const types: { value: string; label: string }[] = [
  { value: "student", label: "Students" },
  { value: "employee", label: "Employees" },
]

export function PersonFilters({
  search,
  onSearchChange,
  personType,
  onTypeChange,
  gradeLevel,
  onGradeLevelChange,
  gradeLevels,
  section,
  onSectionChange,
  sections,
}: PersonFiltersProps) {
  // Grade/section filters only apply to students; employees have neither.
  const isStudents = personType === "student"
  const showGrade = isStudents && !!gradeLevels && gradeLevels.length > 0
  const showSection = isStudents && !!sections && sections.length > 0
  const gradeChosen = !!gradeLevel && gradeLevel !== "all"

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search persons…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-9 pr-8 text-[13px]"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <Tabs value={personType} onValueChange={(v) => onTypeChange(v as string)}>
        <TabsList className="w-full">
          {types.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-1 text-[11px]">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {(showGrade || showSection) && (
        <div className="flex gap-2">
          {showGrade && (
            <Select
              value={gradeChosen ? gradeLevel : null}
              onValueChange={(v) => onGradeLevelChange?.(v ?? "all")}
            >
              <SelectTrigger className="h-8 flex-1 text-[11px]">
                <SelectValue placeholder="Grade level" />
              </SelectTrigger>
              <SelectContent>
                {gradeLevels.map((gl) => (
                  <SelectItem key={gl} value={gl}>{gl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showSection && (
            <Select
              value={section && section !== "all" ? section : null}
              onValueChange={(v) => onSectionChange?.(v ?? "all")}
              disabled={showGrade && !gradeChosen}
            >
              <SelectTrigger className="h-8 flex-1 text-[11px]">
                <SelectValue placeholder={showGrade && !gradeChosen ? "Pick grade first" : "Section"} />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  )
}

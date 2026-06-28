"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { Person } from "@/lib/types"

interface PersonCardProps {
  person: Person
  isSelected: boolean
  isActive: boolean
  onToggleSelect: (id: string) => void
  onClick: (person: Person) => void
}

const typeStyles: Record<string, { dot: string; label: string }> = {
  student:  { dot: "bg-info",     label: "text-info" },
  employee: { dot: "bg-success",  label: "text-success" },
  faculty:  { dot: "bg-success",  label: "text-success" },
  staff:    { dot: "bg-chart-4",  label: "text-chart-4" },
  visitor:  { dot: "bg-warning",  label: "text-warning" },
  other:    { dot: "bg-muted-foreground/60", label: "text-muted-foreground" },
}

export function PersonCard({
  person,
  isSelected,
  isActive,
  onToggleSelect,
  onClick,
}: PersonCardProps) {
  const hasPhoto = (person as Record<string, unknown>).has_photo as boolean
  const photoUrl = hasPhoto ? `/api/persons/${person.id}/photo` : undefined
  const initials = `${person.first_name?.[0] ?? ""}${person.last_name?.[0] ?? ""}`.toUpperCase() || "??"
  const style = typeStyles[person.person_type] ?? typeStyles.other

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-all duration-150 cursor-pointer",
        isActive
          ? "border-primary/30 bg-primary/[0.04] shadow-sm shadow-primary/5"
          : isSelected
          ? "border-primary/15 bg-primary/[0.02] hover:border-primary/25"
          : "border-transparent hover:border-border hover:bg-accent/40"
      )}
      onClick={() => onClick(person)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick(person)
        }
      }}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggleSelect(person.id)}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0"
      />
      <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/60">
        {photoUrl && <AvatarImage src={photoUrl} alt={`${person.first_name} ${person.last_name}`} />}
        <AvatarFallback className="bg-gradient-to-br from-muted to-muted/60 text-[11px] font-semibold text-muted-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight">
          {person.last_name}, {person.first_name}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
            <span className="capitalize">{person.person_type}</span>
          </span>
          {person.id_number && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="truncate tabular-nums">{person.id_number}</span>
            </>
          )}
        </div>
      </div>
      {isActive && (
        <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-primary" />
      )}
    </div>
  )
}

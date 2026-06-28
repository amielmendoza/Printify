"use client"

import { useEditorStore } from "@/stores/editor-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { User } from "lucide-react"

export function PersonPreviewCard() {
  const person = useEditorStore((s) => s.currentPerson)
  const hasPhoto = person ? (person as Record<string, unknown>).has_photo as boolean : false
  const photoUrl = hasPhoto && person ? `/api/persons/${person.id}/photo` : null

  if (!person) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <User className="h-4 w-4" />
        Select a person from the list to preview
      </div>
    )
  }

  const initials = `${person.first_name[0]}${person.last_name[0]}`.toUpperCase()

  return (
    <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
      <Avatar className="h-11 w-11 ring-2 ring-background">
        <AvatarImage src={photoUrl ?? undefined} />
        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {person.first_name} {person.last_name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {person.person_type}
          </Badge>
          {person.id_number && (
            <span className="text-[11px] text-muted-foreground">ID: {person.id_number}</span>
          )}
        </div>
      </div>
    </div>
  )
}

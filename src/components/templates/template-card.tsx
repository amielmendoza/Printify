"use client"

import { Button } from "@/components/ui/button"
import { useStorageUrl } from "@/hooks/use-storage-url"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Pencil, Trash2, FileImage, MoreVertical, ExternalLink, Copy } from "lucide-react"
import type { Template } from "@/lib/types"

interface TemplateCardProps {
  template: Template
  onEdit: (template: Template) => void
  onDelete: (id: string) => void
}

export function TemplateCard({ template, onEdit, onDelete }: TemplateCardProps) {
  const fileUrl = useStorageUrl("templates", template.file_path)
  const placeholderCount = (template.placeholders as unknown[]).length
  const updatedAgo = template.updated_at
    ? formatRelative(new Date(template.updated_at))
    : null

  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
      <button
        onClick={() => onEdit(template)}
        className="block w-full text-left"
      >
        <div className="relative aspect-[3.375/2.125] overflow-hidden bg-gradient-to-br from-muted/40 to-muted/20">
          {fileUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={template.name}
              className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <FileImage className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
          )}
          <div className="absolute left-3 top-3 flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground shadow-xs ring-1 ring-border/60 backdrop-blur">
              {template.file_type}
            </span>
          </div>
        </div>
      </button>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[14px] font-semibold tracking-tight">{template.name}</h3>
            {template.description && (
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {template.description}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="-mr-1 shrink-0 opacity-0 group-hover:opacity-100 data-[expanded]:opacity-100"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onEdit(template)}>
                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileUrl && window.open(fileUrl, "_blank")}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" /> Open original
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(template.name)}>
                <Copy className="mr-2 h-3.5 w-3.5" /> Copy name
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(template.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <span className="font-medium text-foreground">{template.width_inches}&quot;</span>
            ×
            <span className="font-medium text-foreground">{template.height_inches}&quot;</span>
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>
            <span className="font-medium text-foreground tabular-nums">{placeholderCount}</span>{" "}
            placeholder{placeholderCount === 1 ? "" : "s"}
          </span>
          {updatedAgo && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>{updatedAgo}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function formatRelative(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

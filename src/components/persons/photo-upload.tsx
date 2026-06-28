"use client"

import { useCallback, useState } from "react"
import { Camera, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface PhotoUploadProps {
  currentUrl?: string | null
  onFileSelect: (file: File) => void
  onRemove?: () => void
}

export function PhotoUpload({ currentUrl, onFileSelect, onRemove }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return
      const url = URL.createObjectURL(file)
      setPreview(url)
      onFileSelect(file)
    },
    [onFileSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  return (
    <div
      className={cn(
        "relative flex h-40 w-32 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/30 transition-colors",
        isDragging && "border-primary/60 bg-primary/5",
        preview && "border-solid border-border bg-muted"
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Photo preview"
            className="h-full w-full object-cover"
          />
          {onRemove && (
            <button
              type="button"
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/80 text-background shadow-sm transition-colors hover:bg-destructive"
              onClick={() => {
                setPreview(null)
                onRemove()
              }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </>
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-2 px-2 text-center text-[12px] text-muted-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card shadow-xs ring-1 ring-border">
            <Camera className="h-4 w-4" />
          </div>
          <span className="text-[12px] font-medium leading-tight">Upload photo</span>
          <span className="text-[10px] text-muted-foreground/70">Drop or click</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </label>
      )}
    </div>
  )
}

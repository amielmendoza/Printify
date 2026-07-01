"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { TemplateEditor } from "@/components/templates/template-editor"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Template } from "@/lib/types"

export default function EditTemplatePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch(`/api/templates/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((t: Template | null) => {
        if (!active) return
        if (t) setTemplate(t)
        else toast.error("Template not found")
        setLoading(false)
      })
      .catch(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-[14px] font-semibold">Template not found</p>
        <Button onClick={() => router.push("/templates")}>Back to templates</Button>
      </div>
    )
  }

  return (
    <TemplateEditor
      template={template}
      onCancel={() => router.push("/templates")}
      onSaved={() => {
        router.push("/templates")
        router.refresh()
      }}
    />
  )
}

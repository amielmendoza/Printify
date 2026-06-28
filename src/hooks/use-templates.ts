"use client"

import { useCallback, useEffect, useState } from "react"
import type { Template } from "@/lib/types"

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/templates")
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to fetch templates")
      } else {
        setTemplates((data ?? []) as Template[])
      }
    } catch {
      setError("Network error fetching templates")
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return { templates, loading, error, refetch: fetchTemplates }
}

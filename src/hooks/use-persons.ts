"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Person } from "@/lib/types"

interface PersonFilters {
  search?: string
  personType?: string
  gradeLevel?: string
  section?: string
}

export function usePersons(filters?: PersonFilters) {
  const [persons, setPersons] = useState<Person[]>([])
  const [allPersons, setAllPersons] = useState<Person[]>([])
  const [gradeLevels, setGradeLevels] = useState<string[]>([])
  const [sections, setSections] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPersons = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (filters?.search) params.set("search", filters.search)
    if (filters?.personType && filters.personType !== "all") params.set("type", filters.personType)
    if (force) params.set("refresh", "1") // bypass the server cache (re-hit evesms)

    try {
      const res = await fetch(`/api/persons?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to fetch persons")
      } else {
        const fetched = (data.persons ?? []) as Person[]
        setAllPersons(fetched)
        if (data.gradeLevels) setGradeLevels(data.gradeLevels)
        if (data.sections) setSections(data.sections)
      }
    } catch {
      setError("Network error fetching persons")
    }
    setLoading(false)
  }, [filters?.search, filters?.personType])

  useEffect(() => {
    fetchPersons()
  }, [fetchPersons])

  // Client-side filtering for grade level and section
  useEffect(() => {
    let filtered = allPersons
    if (filters?.gradeLevel && filters.gradeLevel !== "all") {
      filtered = filtered.filter((p) => {
        const meta = p.metadata as Record<string, unknown> | null
        return meta?.gradeLevel === filters.gradeLevel
      })
    }
    if (filters?.section && filters.section !== "all") {
      filtered = filtered.filter((p) => {
        const meta = p.metadata as Record<string, unknown> | null
        return meta?.section === filters.section
      })
    }
    setPersons(filtered)
  }, [allPersons, filters?.gradeLevel, filters?.section])

  // Cascade: compute sections available for the selected grade level
  const filteredSections = useMemo(() => {
    if (!filters?.gradeLevel || filters.gradeLevel === "all") return sections
    const sectionSet = new Set<string>()
    for (const p of allPersons) {
      const meta = p.metadata as Record<string, unknown> | null
      if (meta?.gradeLevel === filters.gradeLevel && typeof meta?.section === "string" && meta.section) {
        sectionSet.add(meta.section)
      }
    }
    return [...sectionSet].sort()
  }, [allPersons, sections, filters?.gradeLevel])

  const refresh = useCallback(() => fetchPersons(true), [fetchPersons])

  return { persons, loading, error, refetch: fetchPersons, refresh, gradeLevels, sections: filteredSections }
}

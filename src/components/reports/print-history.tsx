"use client"

import { useCallback, useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useTemplates } from "@/hooks/use-templates"
import { cn } from "@/lib/utils"
import { Activity, ChevronLeft, ChevronRight, Download, Printer, Search, X } from "lucide-react"
import type { PrintLog } from "@/lib/types"

interface PrintLogResponse {
  logs: PrintLog[]
  total: number
  printedCount: number
  exportedCount: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

/** Convert the from/to date-input values (YYYY-MM-DD) into inclusive ISO
 * datetime bounds in the user's local timezone. */
function dateBounds(from: string, to: string) {
  return {
    fromIso: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    toIso: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  }
}

export function PrintHistory() {
  const { templates } = useTemplates()

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [action, setAction] = useState("all")
  const [templateId, setTemplateId] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)

  const [data, setData] = useState<PrintLogResponse | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const buildParams = useCallback(
    (extra?: Record<string, string>) => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set("q", debouncedSearch)
      if (action !== "all") params.set("action", action)
      if (templateId !== "all") params.set("templateId", templateId)
      const { fromIso, toIso } = dateBounds(from, to)
      if (fromIso) params.set("from", fromIso)
      if (toIso) params.set("to", toIso)
      for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v)
      return params
    },
    [debouncedSearch, action, templateId, from, to]
  )

  const queryString = String(buildParams({ page: String(page), pageSize: String(PAGE_SIZE) }))
  const loading = loadedKey !== queryString

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/print-logs?${queryString}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || "Failed to fetch print history")
        setData(body as PrintLogResponse)
        setError(null)
        setLoadedKey(queryString)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "Failed to fetch print history")
        setLoadedKey(queryString)
      })
    return () => controller.abort()
  }, [queryString])

  const hasFilters = !!(debouncedSearch || action !== "all" || templateId !== "all" || from || to)

  const clearFilters = () => {
    setSearch("")
    setAction("all")
    setTemplateId("all")
    setFrom("")
    setTo("")
    setPage(1)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border bg-card shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <Printer className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight">Print history</h3>
            <p className="text-[12px] text-muted-foreground">All printed and exported IDs</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-[12px]"
          disabled={total === 0}
          onClick={() => window.open(`/api/print-logs?${buildParams({ format: "csv" })}`, "_blank")}
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1) }}
            className="h-8 w-[140px] text-[12px]"
            aria-label="From date"
          />
          <span className="text-[12px] text-muted-foreground">to</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1) }}
            className="h-8 w-[140px] text-[12px]"
            aria-label="To date"
          />
        </div>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="h-8 pl-9 text-[12px]"
          />
        </div>
        <Select value={action} onValueChange={(v) => { setAction((v as string) ?? "all"); setPage(1) }}>
          <SelectTrigger className="h-8 w-[130px] text-[12px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="printed">Printed</SelectItem>
            <SelectItem value="exported">Exported</SelectItem>
          </SelectContent>
        </Select>
        <Select value={templateId} onValueChange={(v) => { setTemplateId((v as string) ?? "all"); setPage(1) }}>
          <SelectTrigger className="h-8 w-[160px] text-[12px]">
            <SelectValue placeholder="Template" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All templates</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-[12px]" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Range summary */}
      <div className="flex items-center gap-4 border-b px-5 py-2.5">
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-success/10 text-success ring-1 ring-success/20">
            <Printer className="h-3 w-3" />
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {(data?.printedCount ?? 0).toLocaleString()}
          </span>
          printed
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-info/10 text-info ring-1 ring-info/20">
            <Download className="h-3 w-3" />
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {(data?.exportedCount ?? 0).toLocaleString()}
          </span>
          exported
        </span>
        {(from || to) && (
          <span className="text-[11px] text-muted-foreground/70">
            {from && to ? `${from} – ${to}` : from ? `from ${from}` : `until ${to}`}
          </span>
        )}
      </div>

      {/* Rows */}
      {loading ? (
        <ul className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex items-center gap-4 px-5 py-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-3.5 w-16" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <p className="text-[14px] font-semibold">Could not load print history</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{error}</p>
        </div>
      ) : !data || data.logs.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-[14px] font-semibold">
            {hasFilters ? "No matching records" : "No activity yet"}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {hasFilters
              ? "Try adjusting or clearing the filters."
              : "Cards you print or export will appear here."}
          </p>
        </div>
      ) : (
        <ul className="divide-y">
          {data.logs.map((log) => {
            const date = new Date(log.created_at)
            const isPrint = log.action === "printed"
            return (
              <li
                key={log.id}
                className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
                    isPrint
                      ? "bg-success/10 text-success ring-success/20"
                      : "bg-info/10 text-info ring-info/20"
                  )}
                >
                  {isPrint ? <Printer className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium leading-tight">
                    {log.person_name}
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground/70">
                      {log.person_external_id}
                    </span>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    <span className="capitalize">{log.action}</span>
                    <span className="text-muted-foreground/40"> · </span>
                    {log.template_name ?? "Unknown template"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] tabular-nums text-muted-foreground">
                    {date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="text-[10px] tabular-nums text-muted-foreground/70">
                    {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between border-t px-5 py-3">
        <p className="text-[12px] tabular-nums text-muted-foreground">
          Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {total.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[12px]"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </Button>
          <span className="text-[12px] tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[12px]"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

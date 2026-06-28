"use client"

import { useEffect, useState } from "react"
import { getStorageUrl } from "@/lib/storage-client"

// Resolves a stored blob path to a short-lived SAS URL. Returns null until the
// URL has been fetched (callers already handle the null/loading case).
export function useStorageUrl(bucket: string, path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!path) {
      setUrl(null)
      return
    }
    getStorageUrl(bucket, path).then((resolved) => {
      if (active) setUrl(resolved)
    })
    return () => {
      active = false
    }
  }, [bucket, path])

  return url
}

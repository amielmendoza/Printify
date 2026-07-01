"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { EditorSkeleton } from "./editor-skeleton"

// CanvasEditor is browser-only (Fabric.js needs the DOM), loaded lazily so its
// chunk never runs on the server.
const CanvasEditor = dynamic(
  () => import("./canvas-editor").then((mod) => mod.CanvasEditor),
  { loading: () => <EditorSkeleton /> }
)

// Mount guard: the server and the first client render both return the skeleton
// (so hydration matches exactly), then the real editor mounts on the client.
// This avoids the hydration mismatch that `dynamic(..., { ssr: false })` was
// producing inside the dashboard <main>.
export function EditorWrapper() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <EditorSkeleton />
  return <CanvasEditor />
}

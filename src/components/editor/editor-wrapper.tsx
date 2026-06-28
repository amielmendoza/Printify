"use client"

import dynamic from "next/dynamic"
import { EditorSkeleton } from "./editor-skeleton"

export const EditorWrapper = dynamic(
  () => import("./canvas-editor").then((mod) => mod.CanvasEditor),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  }
)

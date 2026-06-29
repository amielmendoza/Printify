import type { Canvas } from "fabric"
import type { Template, Person } from "@/lib/types"
import { renderPersonOnTemplate, exportCanvasToDataUrl } from "./canvas"
import { generateSingleCardPdf, generateBatchPdf, triggerDownload, type PdfExportOptions } from "./pdf"
import { preloadBackgroundRemoval } from "./background-removal"

export async function exportSingleCard(
  canvas: Canvas,
  personName: string,
  backDataUrl?: string
) {
  const dataUrl = exportCanvasToDataUrl(canvas, "png", 1.0, 2)
  const pdfBytes = await generateSingleCardPdf(dataUrl, backDataUrl)
  triggerDownload(pdfBytes, `${personName}-id-card.pdf`)
}

// Print rasters are kept lighter than PDF exports: the 1200px canvas at 1x is
// ~355 DPI on a CR-80 card (card printers are 300 DPI) — sharp enough, but small
// enough that the PDF stays lightweight to open and print.
const PRINT_MULTIPLIER = 1

// Open a print-ready PDF in a new browser tab instead of calling window.print()
// directly. window.print() is synchronous and blocks the tab until the OS print
// dialog resolves; if the default printer (e.g. a Magicard Enduro) is offline,
// that dialog stalls and the whole app appears frozen. Opening a PDF decouples us
// from printer state — the user prints from the PDF viewer whenever the printer
// is ready, and the app never hangs.
function openPdfInNewTab(pdfBytes: Uint8Array, filename: string) {
  const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, "_blank")
  if (!win) {
    // Popup blocked — fall back to a download so the file isn't lost.
    triggerDownload(pdfBytes, filename)
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function printSingleCard(canvas: Canvas, backDataUrl?: string) {
  const dataUrl = exportCanvasToDataUrl(canvas, "png", 1.0, PRINT_MULTIPLIER)
  const pdfBytes = await generateSingleCardPdf(dataUrl, backDataUrl)
  openPdfInNewTab(pdfBytes, "id-card-print.pdf")
}

export async function printBatchCards(
  canvas: Canvas,
  template: Template,
  persons: Person[],
  getPhotoUrl: (person: Person) => Promise<string | null> | string | null,
  getTemplateImageUrl: (t: Template) => Promise<string> | string,
  onProgress?: (current: number, total: number) => void,
  options?: { removeBg?: boolean; signal?: AbortSignal },
  backTemplate?: Template | null
): Promise<void> {
  // Pre-process all backgrounds in parallel before rendering
  if (options?.removeBg) {
    const resolved = await Promise.all(persons.map((p) => getPhotoUrl(p)))
    const photoUrls = resolved.filter((u): u is string => !!u)
    await preloadBackgroundRemoval(photoUrls, (done, total) => {
      onProgress?.(-done, total) // negative = bg removal phase
    }, options.signal)
    if (options.signal?.aborted) return
  }

  const frontDataUrls: string[] = []
  const backDataUrls: string[] = []
  const templateImageUrl = await getTemplateImageUrl(template)
  const backTemplateImageUrl = backTemplate ? await getTemplateImageUrl(backTemplate) : null

  for (let i = 0; i < persons.length; i++) {
    if (options?.signal?.aborted) return
    const person = persons[i]
    const photoUrl = await getPhotoUrl(person)
    onProgress?.(i + 1, persons.length)

    // Render front
    await renderPersonOnTemplate(canvas, template, person, templateImageUrl, photoUrl, { removeBg: options?.removeBg })
    await new Promise((r) => setTimeout(r, 50))
    frontDataUrls.push(exportCanvasToDataUrl(canvas, "png", 1.0, PRINT_MULTIPLIER))

    // Render back (if duplex)
    if (backTemplate && backTemplateImageUrl) {
      await renderPersonOnTemplate(canvas, backTemplate, person, backTemplateImageUrl, photoUrl, { removeBg: options?.removeBg })
      await new Promise((r) => setTimeout(r, 50))
      backDataUrls.push(exportCanvasToDataUrl(canvas, "png", 1.0, PRINT_MULTIPLIER))
    }
  }

  if (!options?.signal?.aborted) {
    // One card per page at exact CR-80 size (duplex interleaves front/back) —
    // the right layout for a card printer like the Enduro.
    const pdfBytes = await generateBatchPdf(
      frontDataUrls,
      { pageSize: "card" },
      backDataUrls.length > 0 ? backDataUrls : undefined
    )
    openPdfInNewTab(pdfBytes, "id-cards-print.pdf")
  }
}

export async function exportBatchCards(
  canvas: Canvas,
  template: Template,
  persons: Person[],
  getPhotoUrl: (person: Person) => Promise<string | null> | string | null,
  getTemplateImageUrl: (t: Template) => Promise<string> | string,
  options: Partial<PdfExportOptions> = {},
  onProgress?: (current: number, total: number) => void,
  renderOptions?: { removeBg?: boolean; signal?: AbortSignal },
  backTemplate?: Template | null
): Promise<void> {
  // Pre-process all backgrounds in parallel before rendering
  if (renderOptions?.removeBg) {
    const resolved = await Promise.all(persons.map((p) => getPhotoUrl(p)))
    const photoUrls = resolved.filter((u): u is string => !!u)
    await preloadBackgroundRemoval(photoUrls, (done, total) => {
      onProgress?.(-done, total) // negative = bg removal phase
    }, renderOptions.signal)
    if (renderOptions.signal?.aborted) return
  }

  const frontDataUrls: string[] = []
  const backDataUrls: string[] = []
  const templateImageUrl = await getTemplateImageUrl(template)
  const backTemplateImageUrl = backTemplate ? await getTemplateImageUrl(backTemplate) : null

  for (let i = 0; i < persons.length; i++) {
    if (renderOptions?.signal?.aborted) return
    const person = persons[i]
    const photoUrl = await getPhotoUrl(person)

    onProgress?.(i + 1, persons.length)

    // Render front
    await renderPersonOnTemplate(canvas, template, person, templateImageUrl, photoUrl, { removeBg: renderOptions?.removeBg })
    await new Promise((r) => setTimeout(r, 50))
    frontDataUrls.push(exportCanvasToDataUrl(canvas, "png", 1.0, 2))

    // Render back (if duplex)
    if (backTemplate && backTemplateImageUrl) {
      await renderPersonOnTemplate(canvas, backTemplate, person, backTemplateImageUrl, photoUrl, { removeBg: renderOptions?.removeBg })
      await new Promise((r) => setTimeout(r, 50))
      backDataUrls.push(exportCanvasToDataUrl(canvas, "png", 1.0, 2))
    }
  }

  if (renderOptions?.signal?.aborted) return
  const pdfBytes = await generateBatchPdf(
    frontDataUrls,
    options,
    backDataUrls.length > 0 ? backDataUrls : undefined
  )
  const timestamp = new Date().toISOString().slice(0, 10)
  triggerDownload(pdfBytes, `id-cards-batch-${timestamp}.pdf`)
}

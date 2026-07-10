import type { Canvas } from "fabric"
import type { Template, Person } from "@/lib/types"
import { renderPersonOnTemplate, exportCanvasToDataUrl } from "./canvas"
import { generateSingleCardPdf, generateBatchPdf, triggerDownload, type PdfExportOptions } from "./pdf"
import { preloadBackgroundRemoval } from "./background-removal"

export async function exportSingleCard(
  canvas: Canvas,
  personName: string,
  backDataUrl?: string,
  cardSize?: Pick<PdfExportOptions, "cardWidthInches" | "cardHeightInches">
) {
  const dataUrl = exportCanvasToDataUrl(canvas, "png", 1.0, 2)
  const pdfBytes = await generateSingleCardPdf(dataUrl, backDataUrl, cardSize)
  triggerDownload(pdfBytes, `${personName}-id-card.pdf`)
}

// Print raster is kept lighter than PDF exports: the 1200px canvas at 1x is
// ~355 DPI on a CR-80 card (card printers are 300 DPI) — sharp enough, light enough.
const PRINT_MULTIPLIER = 1

// Show the browser's print dialog directly: render the card image(s) into a
// hidden iframe (one CR-80 page each, duplex interleaved) and call print(). This
// opens the print preview immediately on click — no download, no new tab —
// regardless of the browser's "download PDFs" setting. (If the dialog itself then
// hangs, that's the printer driver, e.g. a stuck Magicard Enduro — not this code.)
function printCardImages(frontDataUrls: string[], backDataUrls?: string[]) {
  const duplex = !!backDataUrls && backDataUrls.length > 0

  const iframe = document.createElement("iframe")
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    return
  }

  const pages: string[] = []
  for (let i = 0; i < frontDataUrls.length; i++) {
    pages.push(`<div class="page"><img src="${frontDataUrls[i]}" /></div>`)
    if (duplex && i < backDataUrls!.length) {
      pages.push(`<div class="page"><img src="${backDataUrls![i]}" /></div>`)
    }
  }

  doc.open()
  doc.write(`<!DOCTYPE html><html><head><style>
    @page { size: 2.125in 3.375in; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .page { page-break-after: always; width: 2.125in; height: 3.375in; overflow: hidden; }
    .page:last-child { page-break-after: auto; }
    .page img { width: 100%; height: 100%; object-fit: fill; display: block; }
  </style></head><body>${pages.join("")}</body></html>`)
  doc.close()

  const imgs = Array.from(doc.querySelectorAll("img"))
  let loaded = 0
  const fire = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => iframe.remove(), 60_000)
  }
  if (imgs.length === 0) return fire()
  imgs.forEach((img) => {
    const done = () => { if (++loaded === imgs.length) fire() }
    if (img.complete) done()
    else { img.onload = done; img.onerror = done }
  })
}

export function printSingleCard(canvas: Canvas, backDataUrl?: string) {
  const dataUrl = exportCanvasToDataUrl(canvas, "png", 1.0, PRINT_MULTIPLIER)
  printCardImages([dataUrl], backDataUrl ? [backDataUrl] : undefined)
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
    // One CR-80 card per page (duplex interleaves front/back) — opens the print
    // dialog directly.
    printCardImages(frontDataUrls, backDataUrls.length > 0 ? backDataUrls : undefined)
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

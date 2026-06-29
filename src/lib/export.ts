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

export function printSingleCard(canvas: Canvas, backDataUrl?: string, mode: "card" | "sheet" = "card") {
  const dataUrl = exportCanvasToDataUrl(canvas, "png", 1.0, 2)
  printImages([dataUrl], backDataUrl ? [backDataUrl] : undefined, mode)
}

export async function printBatchCards(
  canvas: Canvas,
  template: Template,
  persons: Person[],
  getPhotoUrl: (person: Person) => Promise<string | null> | string | null,
  getTemplateImageUrl: (t: Template) => Promise<string> | string,
  onProgress?: (current: number, total: number) => void,
  options?: { removeBg?: boolean; signal?: AbortSignal },
  backTemplate?: Template | null,
  mode: "card" | "sheet" = "card"
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
    frontDataUrls.push(exportCanvasToDataUrl(canvas, "png", 1.0, 2))

    // Render back (if duplex)
    if (backTemplate && backTemplateImageUrl) {
      await renderPersonOnTemplate(canvas, backTemplate, person, backTemplateImageUrl, photoUrl, { removeBg: options?.removeBg })
      await new Promise((r) => setTimeout(r, 50))
      backDataUrls.push(exportCanvasToDataUrl(canvas, "png", 1.0, 2))
    }
  }

  if (!options?.signal?.aborted) {
    printImages(frontDataUrls, backDataUrls.length > 0 ? backDataUrls : undefined, mode)
  }
}

// Print mode: "card" = one card per page for CR-80 card printers (e.g. Magicard Enduro 3E)
//             "sheet" = grid layout on Letter paper with cut marks
// For duplex card mode: front page then back page per card, interleaved
// For duplex sheet mode: front sheet then back sheet (mirrored columns for flip alignment)
function printImages(frontDataUrls: string[], backDataUrls?: string[], mode: "card" | "sheet" = "card") {
  const duplex = backDataUrls && backDataUrls.length > 0

  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.top = "-10000px"
  iframe.style.left = "-10000px"
  iframe.style.width = "0"
  iframe.style.height = "0"
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document
  if (!doc) return

  const pages: string[] = []

  if (mode === "card") {
    // One card per page — interleave front/back for duplex
    for (let i = 0; i < frontDataUrls.length; i++) {
      pages.push(`<div class="page"><img src="${frontDataUrls[i]}" /></div>`)
      if (duplex && i < backDataUrls.length) {
        pages.push(`<div class="page"><img src="${backDataUrls[i]}" /></div>`)
      }
    }
  } else {
    // Grid layout for letter paper
    const COLS = 2
    const ROWS = 4
    const CARDS_PER_PAGE = COLS * ROWS
    for (let i = 0; i < frontDataUrls.length; i += CARDS_PER_PAGE) {
      const frontBatch = frontDataUrls.slice(i, i + CARDS_PER_PAGE)
      const frontCards = frontBatch.map((url) => `<div class="card"><img src="${url}" /></div>`).join("")
      pages.push(`<div class="page"><div class="grid">${frontCards}</div></div>`)

      if (duplex) {
        const backBatch = backDataUrls.slice(i, i + CARDS_PER_PAGE)
        const backGrid: string[] = []
        for (let j = 0; j < CARDS_PER_PAGE; j++) {
          const row = Math.floor(j / COLS)
          const col = j % COLS
          const mirroredCol = (COLS - 1) - col
          const srcIdx = row * COLS + mirroredCol
          if (srcIdx < backBatch.length) {
            backGrid[j] = `<div class="card"><img src="${backBatch[srcIdx]}" /></div>`
          } else {
            backGrid[j] = `<div class="card"></div>`
          }
        }
        pages.push(`<div class="page"><div class="grid">${backGrid.join("")}</div></div>`)
      }
    }
  }

  const CARD_W = "3.375in"
  const CARD_H = "2.125in"

  const cardStyles = `
  @page {
    size: 2.125in 3.375in;
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white; }
  .page {
    page-break-after: always;
    width: 2.125in;
    height: 3.375in;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }
  .page img {
    width: 100%;
    height: 100%;
    object-fit: fill;
    display: block;
  }`

  const sheetStyles = `
  @page {
    size: letter;
    margin: 0.5in 0.375in;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white; }
  .page {
    page-break-after: always;
    width: 100%;
    display: flex;
    justify-content: center;
  }
  .page:last-child { page-break-after: auto; }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, ${CARD_W});
    grid-template-rows: repeat(4, ${CARD_H});
    gap: 0.25in;
  }
  .card {
    width: ${CARD_W};
    height: ${CARD_H};
    position: relative;
    overflow: hidden;
  }
  .card img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .card::before, .card::after {
    content: '';
    position: absolute;
    border: 0;
  }
  .card::before {
    top: -4px; left: -4px;
    width: 8px; height: 8px;
    border-top: 0.5px solid #999;
    border-left: 0.5px solid #999;
  }
  .card::after {
    top: -4px; right: -4px;
    width: 8px; height: 8px;
    border-top: 0.5px solid #999;
    border-right: 0.5px solid #999;
  }`

  doc.open()
  doc.write(`<!DOCTYPE html>
<html>
<head>
<style>${mode === "card" ? cardStyles : sheetStyles}</style>
</head>
<body>${pages.join("")}</body>
</html>`)
  doc.close()

  // Wait for images to load then print
  const imgs = doc.querySelectorAll("img")
  let loaded = 0
  const total = imgs.length
  const onAllLoaded = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }

  if (total === 0) {
    onAllLoaded()
    return
  }

  imgs.forEach((img) => {
    if (img.complete) {
      loaded++
      if (loaded === total) onAllLoaded()
    } else {
      img.onload = () => { loaded++; if (loaded === total) onAllLoaded() }
      img.onerror = () => { loaded++; if (loaded === total) onAllLoaded() }
    }
  })
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

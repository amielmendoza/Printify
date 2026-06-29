import { PDFDocument, PDFPage } from "pdf-lib"

// CR-80 card reference (1 inch = 72 points)
const CR80_WIDTH_PT = 3.375 * 72  // 243 points
const CR80_HEIGHT_PT = 2.125 * 72 // 153 points

export interface PdfExportOptions {
  pageSize: "card" | "letter" | "a4"
  cardsPerRow: number
  cardsPerColumn: number
  margin: number
  spacing: number
  includeCutMarks: boolean
}

const defaultOptions: PdfExportOptions = {
  pageSize: "card",
  cardsPerRow: 1,
  cardsPerColumn: 1,
  margin: 0,
  spacing: 0,
  includeCutMarks: false,
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Embed a data-URL image, picking JPEG vs PNG by its MIME type. JPEG keeps the
// PDF small (important for the print path — large PDFs make the browser's PDF
// print pipeline hang); PNG is used where lossless/transparency is needed.
function embedImage(doc: PDFDocument, dataUrl: string) {
  const bytes = dataUrlToBytes(dataUrl)
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")
    ? doc.embedJpg(bytes)
    : doc.embedPng(bytes)
}

/**
 * Compute card dimensions in points from the image's actual aspect ratio.
 * The longer side is scaled to CR-80's longer dimension (3.375").
 */
function cardDimensionsFromImage(imgWidth: number, imgHeight: number) {
  const aspect = imgWidth / imgHeight
  if (aspect >= 1) {
    // Landscape or square
    return { cardW: CR80_WIDTH_PT, cardH: CR80_WIDTH_PT / aspect }
  } else {
    // Portrait
    return { cardW: CR80_WIDTH_PT * aspect, cardH: CR80_WIDTH_PT }
  }
}

function drawCutMarks(page: PDFPage, x: number, y: number, cardW: number, cardH: number) {
  const markLen = 9
  const lx = x
  const rx = x + cardW
  const ty = y + cardH
  const by = y

  page.drawLine({ start: { x: lx - markLen, y: ty }, end: { x: lx, y: ty }, thickness: 0.5 })
  page.drawLine({ start: { x: lx, y: ty }, end: { x: lx, y: ty + markLen }, thickness: 0.5 })
  page.drawLine({ start: { x: rx, y: ty }, end: { x: rx + markLen, y: ty }, thickness: 0.5 })
  page.drawLine({ start: { x: rx, y: ty }, end: { x: rx, y: ty + markLen }, thickness: 0.5 })
  page.drawLine({ start: { x: lx - markLen, y: by }, end: { x: lx, y: by }, thickness: 0.5 })
  page.drawLine({ start: { x: lx, y: by - markLen }, end: { x: lx, y: by }, thickness: 0.5 })
  page.drawLine({ start: { x: rx, y: by }, end: { x: rx + markLen, y: by }, thickness: 0.5 })
  page.drawLine({ start: { x: rx, y: by - markLen }, end: { x: rx, y: by }, thickness: 0.5 })
}

export async function generateSingleCardPdf(
  canvasDataUrl: string,
  backDataUrl?: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const image = await embedImage(doc, canvasDataUrl)

  // Always use exact CR-80 page size (3.375" x 2.125") for PVC card printing
  const page = doc.addPage([CR80_WIDTH_PT, CR80_HEIGHT_PT])
  page.drawImage(image, { x: 0, y: 0, width: CR80_WIDTH_PT, height: CR80_HEIGHT_PT })

  // Duplex: add back side as second page
  if (backDataUrl) {
    const backImage = await embedImage(doc, backDataUrl)
    const backPage = doc.addPage([CR80_WIDTH_PT, CR80_HEIGHT_PT])
    backPage.drawImage(backImage, { x: 0, y: 0, width: CR80_WIDTH_PT, height: CR80_HEIGHT_PT })
  }

  return doc.save()
}

/**
 * Generate a batch PDF. For duplex printing (e.g. Magicard Enduro 3E),
 * pass backDataUrls — each entry corresponds to the back side of the
 * same-index front card. The PDF will interleave front/back pages so
 * the printer driver can duplex correctly.
 *
 * pageSize "card": front page, back page, front page, back page …
 * pageSize "letter"/"a4": sheet of fronts, sheet of backs (matched positions), repeat.
 */
export async function generateBatchPdf(
  canvasDataUrls: string[],
  options: Partial<PdfExportOptions> = {},
  backDataUrls?: string[]
): Promise<Uint8Array> {
  const opts = { ...defaultOptions, ...options }
  const doc = await PDFDocument.create()
  const duplex = backDataUrls && backDataUrls.length > 0

  // Embed first image to determine card dimensions from actual aspect ratio
  const firstImage = await embedImage(doc, canvasDataUrls[0])
  const { cardW, cardH } = cardDimensionsFromImage(firstImage.width, firstImage.height)

  if (opts.pageSize === "card") {
    // One card per page at exact CR-80 size — for duplex: front, back, front, back …
    for (let i = 0; i < canvasDataUrls.length; i++) {
      // Front page
      const frontImage = i === 0 ? firstImage : await embedImage(doc, canvasDataUrls[i])
      const fp = doc.addPage([CR80_WIDTH_PT, CR80_HEIGHT_PT])
      fp.drawImage(frontImage, { x: 0, y: 0, width: CR80_WIDTH_PT, height: CR80_HEIGHT_PT })

      // Back page (if duplex)
      if (duplex && backDataUrls[i]) {
        const backImage = await embedImage(doc, backDataUrls[i])
        const bp = doc.addPage([CR80_WIDTH_PT, CR80_HEIGHT_PT])
        bp.drawImage(backImage, { x: 0, y: 0, width: CR80_WIDTH_PT, height: CR80_HEIGHT_PT })
      }
    }
  } else {
    const pageWidth = opts.pageSize === "letter" ? 612 : 595.28
    const pageHeight = opts.pageSize === "letter" ? 792 : 841.89

    const cols = opts.cardsPerRow || 2
    const rows = opts.cardsPerColumn || 4
    const cardsPerPage = cols * rows

    // Scale cards down if they don't fit on the page
    const availW = pageWidth - opts.margin * 2
    const availH = pageHeight - opts.margin * 2
    const neededW = cols * cardW + (cols - 1) * opts.spacing
    const neededH = rows * cardH + (rows - 1) * opts.spacing
    const scale = Math.min(1, availW / neededW, availH / neededH)

    const finalCardW = cardW * scale
    const finalCardH = cardH * scale
    const finalSpacing = opts.spacing * scale

    // Center the grid on the page
    const gridW = cols * finalCardW + (cols - 1) * finalSpacing
    const gridH = rows * finalCardH + (rows - 1) * finalSpacing
    const startX = (pageWidth - gridW) / 2
    const startY = pageHeight - (pageHeight - gridH) / 2

    for (let i = 0; i < canvasDataUrls.length; i += cardsPerPage) {
      const frontBatch = canvasDataUrls.slice(i, i + cardsPerPage)

      // --- Front side sheet ---
      const frontPage = doc.addPage([pageWidth, pageHeight])
      for (let j = 0; j < frontBatch.length; j++) {
        const col = j % cols
        const row = Math.floor(j / cols)
        const x = startX + col * (finalCardW + finalSpacing)
        const y = startY - (row + 1) * finalCardH - row * finalSpacing

        const image = i === 0 && j === 0 ? firstImage : await embedImage(doc, frontBatch[j])
        frontPage.drawImage(image, { x, y, width: finalCardW, height: finalCardH })

        if (opts.includeCutMarks) {
          drawCutMarks(frontPage, x, y, finalCardW, finalCardH)
        }
      }

      // --- Back side sheet (if duplex) ---
      // Cards are mirrored horizontally so they align when flipped on long edge
      if (duplex) {
        const backBatch = backDataUrls.slice(i, i + cardsPerPage)
        const backPage = doc.addPage([pageWidth, pageHeight])
        for (let j = 0; j < backBatch.length; j++) {
          const col = j % cols
          const row = Math.floor(j / cols)
          // Mirror column order for back side (flip on long edge)
          const mirroredCol = (cols - 1) - col
          const x = startX + mirroredCol * (finalCardW + finalSpacing)
          const y = startY - (row + 1) * finalCardH - row * finalSpacing

          const image = await embedImage(doc, backBatch[j])
          backPage.drawImage(image, { x, y, width: finalCardW, height: finalCardH })

          if (opts.includeCutMarks) {
            drawCutMarks(backPage, x, y, finalCardW, finalCardH)
          }
        }
      }
    }
  }

  return doc.save()
}

export function triggerDownload(data: Uint8Array, filename: string) {
  const blob = new Blob([data as BlobPart], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function pdfPageToDataUrl(pdfBytes: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist")
  pdfjsLib.GlobalWorkerOptions.workerSrc = ""

  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2 })

  const canvas = document.createElement("canvas")
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext("2d")!
  await page.render({
    canvasContext: ctx,
    viewport,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).promise

  return canvas.toDataURL("image/png")
}

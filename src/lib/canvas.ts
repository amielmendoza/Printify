import { Canvas, FabricImage, FabricText, Rect } from "fabric"
import QRCode from "qrcode"
import type { Template, Person, Placeholder } from "@/lib/types"
import { removeImageBackground } from "@/lib/background-removal"

// Max canvas dimension (longer side) — actual size is determined by template aspect ratio
export const MAX_CANVAS_DIM = 1200

export function createCanvas(
  canvasEl: HTMLCanvasElement,
  width: number = 400,
  height: number = 600
): Canvas {
  const canvas = new Canvas(canvasEl, {
    width,
    height,
    backgroundColor: "#ffffff",
    selection: false,          // no multi-select box
    preserveObjectStacking: true,
  })
  // Prefer quality when scaling raster images (photos) up/down on the canvas.
  const ctx = canvas.getContext()
  if (ctx) ctx.imageSmoothingQuality = "high"
  return canvas
}

export async function loadTemplateBackground(
  canvas: Canvas,
  imageUrl: string
): Promise<void> {
  const img = await FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" })
  const imgW = img.width ?? 1
  const imgH = img.height ?? 1

  // Resize canvas to match image aspect ratio at a good resolution
  const maxDim = MAX_CANVAS_DIM
  let canvasW: number, canvasH: number
  if (imgW >= imgH) {
    canvasW = maxDim
    canvasH = Math.round(maxDim * (imgH / imgW))
  } else {
    canvasH = maxDim
    canvasW = Math.round(maxDim * (imgW / imgH))
  }

  canvas.setDimensions({ width: canvasW, height: canvasH })
  img.scaleToWidth(canvasW)
  img.scaleToHeight(canvasH)
  canvas.backgroundImage = img
  canvas.renderAll()
}

// Fits a photo inside the placeholder rectangle (contain: whole photo shown, no
// crop) and clips it to that box. Called on first placement and again after a
// progressive swap in case the replacement image has different dimensions.
function fitPhotoToPlaceholder(
  img: FabricImage,
  px: number,
  py: number,
  pw: number,
  ph: number
): void {
  const scale = Math.min(pw / (img.width ?? 1), ph / (img.height ?? 1))
  const scaledW = (img.width ?? 1) * scale
  const scaledH = (img.height ?? 1) * scale
  img.set({
    left: px - (scaledW - pw) / 2,
    top: py - (scaledH - ph) / 2,
    scaleX: scale,
    scaleY: scale,
    selectable: false,
    evented: false,
  })
  img.clipPath = new Rect({ left: px, top: py, width: pw, height: ph, absolutePositioned: true })
}

// Adds a person photo to the placeholder.
// - progressive (preview): places the ORIGINAL photo immediately for an instant
//   preview, then swaps in the background-removed version when it's ready. The
//   returned `settled` resolves once that swap (if any) completes.
// - non-progressive (export/print): awaits background removal first so the
//   captured output already has the transparent background.
export async function addPersonPhoto(
  canvas: Canvas,
  photoUrl: string,
  placeholder: Placeholder,
  options?: { removeBg?: boolean; progressive?: boolean; signal?: AbortSignal }
): Promise<{ image: FabricImage; settled: Promise<void> } | null> {
  const { removeBg = false, progressive = false, signal } = options ?? {}
  const canvasW = canvas.getWidth()
  const canvasH = canvas.getHeight()
  const px = (placeholder.x / 100) * canvasW
  const py = (placeholder.y / 100) * canvasH
  const pw = (placeholder.width / 100) * canvasW
  const ph = (placeholder.height / 100) * canvasH

  // Export path: resolve the final (background-removed) image before placing.
  if (removeBg && !progressive) {
    let finalUrl = photoUrl
    try {
      finalUrl = await removeImageBackground(photoUrl)
    } catch (e) {
      console.warn("Background removal failed, using original photo:", e)
    }
    if (signal?.aborted) return null
    const img = await FabricImage.fromURL(finalUrl, { crossOrigin: "anonymous" })
    if (signal?.aborted) return null
    fitPhotoToPlaceholder(img, px, py, pw, ph)
    canvas.add(img)
    canvas.renderAll()
    return { image: img, settled: Promise.resolve() }
  }

  // Preview path: place the original immediately.
  const img = await FabricImage.fromURL(photoUrl, { crossOrigin: "anonymous" })
  if (signal?.aborted) return null
  fitPhotoToPlaceholder(img, px, py, pw, ph)
  canvas.add(img)
  canvas.renderAll()

  // Then swap in the background-removed version when ready (preview only).
  let settled = Promise.resolve()
  if (removeBg && progressive) {
    settled = removeImageBackground(photoUrl)
      .then(async (removedUrl) => {
        if (signal?.aborted || !canvas.getObjects().includes(img)) return
        await img.setSrc(removedUrl, { crossOrigin: "anonymous" })
        if (signal?.aborted || !canvas.getObjects().includes(img)) return
        fitPhotoToPlaceholder(img, px, py, pw, ph) // re-fit in case dims changed
        canvas.requestRenderAll()
      })
      .catch(() => {
        /* background removal failed — keep the original photo */
      })
  }

  return { image: img, settled }
}

export function addTextField(
  canvas: Canvas,
  text: string,
  placeholder: Placeholder
): FabricText {
  const canvasW = canvas.getWidth()
  const canvasH = canvas.getHeight()
  const px = (placeholder.x / 100) * canvasW
  const py = (placeholder.y / 100) * canvasH
  const pw = (placeholder.width / 100) * canvasW
  const ph = (placeholder.height / 100) * canvasH

  const style = placeholder.style ?? {}
  let fontSize = style.fontSize ?? Math.round(canvasH * 0.028)

  const align = style.textAlign ?? "left"

  const textObj = new FabricText(text, {
    left: px,
    top: py,
    fontSize,
    fontFamily: style.fontFamily ?? "Arial",
    fontWeight: style.fontWeight ?? "normal",
    fill: style.color ?? "#000000",
    selectable: false,
    evented: false,
  })

  // Auto-shrink text to fit within the placeholder width
  while ((textObj.width ?? 0) > pw && fontSize > 8) {
    fontSize -= 1
    textObj.set({ fontSize })
  }

  // Horizontal alignment within placeholder
  const textW = textObj.width ?? 0
  if (align === "center") {
    textObj.set({ left: px + (pw - textW) / 2 })
  } else if (align === "right") {
    textObj.set({ left: px + pw - textW })
  }

  // Vertically center within placeholder height
  const textHeight = textObj.height ?? fontSize
  if (textHeight < ph) {
    textObj.set({ top: py + (ph - textHeight) / 2 })
  }

  canvas.add(textObj)
  canvas.renderAll()
  return textObj
}

function containsHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text)
}

// Allow only safe formatting tags, strip everything else
function sanitizeHtml(html: string): string {
  // Strip <script>, <iframe>, <object>, <embed>, event handlers, etc.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<link[\s\S]*?>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bon\w+\s*=\s*\S+/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:/gi, "")
}

export async function addHtmlLabel(
  canvas: Canvas,
  html: string,
  placeholder: Placeholder
): Promise<FabricImage> {
  const canvasW = canvas.getWidth()
  const canvasH = canvas.getHeight()
  const px = (placeholder.x / 100) * canvasW
  const py = (placeholder.y / 100) * canvasH
  const pw = (placeholder.width / 100) * canvasW
  const ph = (placeholder.height / 100) * canvasH

  const style = placeholder.style ?? {}
  const fontSize = style.fontSize ?? Math.round(canvasH * 0.028)
  const fontFamily = style.fontFamily ?? "Arial"
  const fontWeight = style.fontWeight ?? "normal"
  const color = style.color ?? "#000000"
  const textAlign = style.textAlign ?? "left"

  // Render at 2x for sharpness
  const scale = 2
  const renderW = pw * scale
  const renderH = ph * scale

  const svgHtml = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${renderW}" height="${renderH}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="
          width: ${renderW}px;
          height: ${renderH}px;
          font-size: ${fontSize * scale}px;
          font-family: ${fontFamily}, sans-serif;
          font-weight: ${fontWeight};
          color: ${color};
          text-align: ${textAlign};
          display: flex;
          align-items: center;
          justify-content: ${textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start"};
          overflow: hidden;
          line-height: 1.3;
        ">${sanitizeHtml(html)}</div>
      </foreignObject>
    </svg>
  `

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const svgBlob = new Blob([svgHtml], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const offscreen = document.createElement("canvas")
      offscreen.width = renderW
      offscreen.height = renderH
      const ctx = offscreen.getContext("2d")!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      resolve(offscreen.toDataURL("image/png"))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to render HTML label"))
    }
    img.src = url
  })

  const fabricImg = await FabricImage.fromURL(dataUrl)
  const imgScale = pw / (fabricImg.width ?? 1)

  fabricImg.set({
    left: px,
    top: py,
    scaleX: imgScale,
    scaleY: imgScale,
    selectable: false,
    evented: false,
  })

  canvas.add(fabricImg)
  canvas.renderAll()
  return fabricImg
}

export async function addQrCode(
  canvas: Canvas,
  value: string,
  placeholder: Placeholder
): Promise<FabricImage> {
  const canvasW = canvas.getWidth()
  const canvasH = canvas.getHeight()
  const px = (placeholder.x / 100) * canvasW
  const py = (placeholder.y / 100) * canvasH
  const pw = (placeholder.width / 100) * canvasW
  const ph = (placeholder.height / 100) * canvasH

  // Generate QR code as data URL
  const size = Math.max(pw, ph) * 2 // render at 2x for sharpness
  const qrDataUrl = await QRCode.toDataURL(value, {
    width: size,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  })

  const img = await FabricImage.fromURL(qrDataUrl)
  const dim = Math.min(pw, ph) // keep it square within the placeholder
  const scale = dim / (img.width ?? 1)

  // Center within placeholder
  const offsetX = (pw - dim) / 2
  const offsetY = (ph - dim) / 2

  img.set({
    left: px + offsetX,
    top: py + offsetY,
    scaleX: scale,
    scaleY: scale,
    selectable: false,
    evented: false,
  })

  canvas.add(img)
  canvas.renderAll()
  return img
}

function getPersonQrValue(person: Person): string {
  const meta = person.metadata as Record<string, unknown> | null
  if (meta?.qrCode && typeof meta.qrCode === "string") return meta.qrCode
  // Fallback: use id_number or full name
  return person.id_number ?? `${person.first_name} ${person.last_name}`
}

function getPersonFieldValue(
  person: Person,
  field: string | undefined,
  label: string
): string {
  const meta = person.metadata as Record<string, unknown> | null

  // Case-insensitive read of a metadata value, coerced to a display string.
  const metaStr = (key: string): string => {
    if (!meta) return ""
    let v = meta[key]
    if (v === undefined) {
      const lower = key.toLowerCase()
      const match = Object.keys(meta).find((k) => k.toLowerCase() === lower)
      if (match) v = meta[match]
    }
    return v == null ? "" : String(v)
  }

  if (field) {
    switch (field) {
      case "full_name":
        return `${person.first_name} ${person.last_name}`.trim()
      case "first_name":
        return person.first_name
      case "middle_name":
        return person.middle_name ?? ""
      case "last_name":
        return person.last_name
      case "id_number":
        return person.id_number ? `LRN: ${person.id_number}` : ""
      case "person_type":
        return person.person_type.charAt(0).toUpperCase() + person.person_type.slice(1)
      case "category":
        return person.category ?? ""
      case "grade_level":
        return metaStr("gradeLevel")
      case "section":
        return metaStr("section")
      case "grade_section":
        return metaStr("gradeLevelSection") || [metaStr("gradeLevel"), metaStr("section")].filter(Boolean).join(" ")
      case "department":
        return metaStr("department")
      case "designation":
        return metaStr("designation")
      case "birth_date":
        return metaStr("birthDate")
      case "school_year":
        return metaStr("schoolYearLabel")
      case "rfid":
        return metaStr("rfid")
      case "emergency_name":
        return metaStr("emergencyContactPerson")
      case "emergency_contact":
        return metaStr("emergencyContactNumber")
      case "emergency_relationship":
        return metaStr("emergencyRelationship")
      case "emergency_address":
        return metaStr("fullAddress")
      case "fullname1":
        return metaStr("fullName1")
      case "fullname2":
        return metaStr("fullName2")
      case "reference_number":
        return metaStr("referenceNumber")
      case "program":
        return metaStr("program")
      case "class_advisory":
        return metaStr("classAdvisory")
      case "blood_type":
        return metaStr("bloodType")
      case "tin":
        return metaStr("tinNumber")
      case "sss":
        return metaStr("sssNumber")
      case "philhealth":
        return metaStr("philhealthNumber")
      case "pagibig":
        return metaStr("pagIbigNumber")
      case "esc_number":
        return metaStr("escNumber")
      case "notif_label":
        return metaStr("notifLabel")
      case "cat_code1":
        return metaStr("catCode1")
      case "cat_code2":
        return metaStr("catCode2")
      case "cat_code3":
        return metaStr("catCode3")
      default:
        // Dynamic: any raw evesms field key (e.g. "gradeLevel", "tinNumber"),
        // so newly-added API fields work without code changes.
        return metaStr(field)
    }
  }

  // No field mapped — use the label as static text
  return label
}

// Removes all overlay objects (photo, text, QR) but keeps the template
// backgroundImage — so switching people doesn't require reloading the template.
export function clearOverlays(canvas: Canvas): void {
  canvas.remove(...canvas.getObjects())
}

// Renders just the person's overlays onto an already-loaded template background.
// Assumes the background + canvas dimensions are already set.
export async function renderPersonOverlays(
  canvas: Canvas,
  template: Template,
  person: Person,
  photoUrl: string | null,
  options?: { removeBg?: boolean; progressive?: boolean; signal?: AbortSignal }
): Promise<{ settled: Promise<void> }> {
  clearOverlays(canvas)
  if (options?.signal?.aborted) return { settled: Promise.resolve() }

  const placeholders = template.placeholders as unknown as Placeholder[]
  let settled = Promise.resolve()

  for (const ph of placeholders) {
    if (options?.signal?.aborted) break

    if (ph.type === "photo" && photoUrl) {
      const res = await addPersonPhoto(canvas, photoUrl, ph, {
        removeBg: options?.removeBg,
        progressive: options?.progressive,
        signal: options?.signal,
      })
      if (res) settled = res.settled
    } else if (ph.type === "text") {
      const text = getPersonFieldValue(person, ph.field, ph.label)
      if (text) {
        if (containsHtml(text)) {
          await addHtmlLabel(canvas, text, ph)
        } else {
          addTextField(canvas, text, ph)
        }
      }
    } else if (ph.type === "qrcode") {
      const qrValue = getPersonQrValue(person)
      if (qrValue) await addQrCode(canvas, qrValue, ph)
    }
  }

  if (!options?.signal?.aborted) canvas.renderAll()
  return { settled }
}

// Full render: load the template background then the person overlays. Used by
// the batch/export paths where the canvas is reused across many templates.
export async function renderPersonOnTemplate(
  canvas: Canvas,
  template: Template,
  person: Person,
  templateImageUrl: string,
  photoUrl: string | null,
  options?: { removeBg?: boolean; signal?: AbortSignal }
): Promise<void> {
  canvas.clear()
  await loadTemplateBackground(canvas, templateImageUrl)
  if (options?.signal?.aborted) return
  await renderPersonOverlays(canvas, template, person, photoUrl, options)
}

export function exportCanvasToDataUrl(
  canvas: Canvas,
  format: string = "png",
  quality: number = 1.0,
  multiplier: number = 1
): string {
  return canvas.toDataURL({
    format: format as "png" | "jpeg",
    quality,
    multiplier,
  })
}

export function serializeCanvas(canvas: Canvas): string {
  return JSON.stringify(canvas.toJSON())
}

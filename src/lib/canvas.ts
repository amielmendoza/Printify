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

export async function addPersonPhoto(
  canvas: Canvas,
  photoUrl: string,
  placeholder: Placeholder,
  removeBg: boolean = false,
  signal?: AbortSignal
): Promise<FabricImage | null> {
  const canvasW = canvas.getWidth()
  const canvasH = canvas.getHeight()
  const px = (placeholder.x / 100) * canvasW
  const py = (placeholder.y / 100) * canvasH
  const pw = (placeholder.width / 100) * canvasW
  const ph = (placeholder.height / 100) * canvasH

  let finalUrl = photoUrl
  if (removeBg) {
    try {
      finalUrl = await removeImageBackground(photoUrl)
    } catch (e) {
      console.warn("Background removal failed, using original photo:", e)
    }
  }

  if (signal?.aborted) return null

  const img = await FabricImage.fromURL(finalUrl, { crossOrigin: "anonymous" })

  if (signal?.aborted) return null

  // Scale to cover the placeholder area
  const scaleX = pw / (img.width ?? 1)
  const scaleY = ph / (img.height ?? 1)
  const scale = Math.max(scaleX, scaleY)

  // Center the image within the placeholder
  const scaledW = (img.width ?? 1) * scale
  const scaledH = (img.height ?? 1) * scale
  const offsetX = (scaledW - pw) / 2
  const offsetY = (scaledH - ph) / 2

  img.set({
    left: px - offsetX,
    top: py - offsetY,
    scaleX: scale,
    scaleY: scale,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockRotation: true,
    hoverCursor: "grab",
    moveCursor: "grabbing",
  })

  // Clip the photo to the placeholder rectangle so it always occupies exactly
  // that box (fill + center-crop), regardless of the source photo's aspect
  // ratio. Without this, cover-scaling lets larger/differently-shaped photos
  // overflow the placeholder by varying amounts. absolutePositioned keeps the
  // clip window fixed in canvas coordinates, so dragging the image repositions
  // the face within a stable frame.
  img.clipPath = new Rect({
    left: px,
    top: py,
    width: pw,
    height: ph,
    absolutePositioned: true,
  })

  canvas.add(img)
  canvas.renderAll()
  return img
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
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockRotation: true,
    hoverCursor: "grab",
    moveCursor: "grabbing",
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
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockRotation: true,
    hoverCursor: "grab",
    moveCursor: "grabbing",
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
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockRotation: true,
    hoverCursor: "grab",
    moveCursor: "grabbing",
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

  if (field) {
    switch (field) {
      case "full_name":
        return `${person.first_name} ${person.last_name}`
      case "id_number":
        return person.id_number ? `LRN: ${person.id_number}` : ""
      case "person_type":
        return person.person_type.charAt(0).toUpperCase() + person.person_type.slice(1)
      case "category":
        return person.category ?? ""
      case "emergency_name":
        return (meta?.emergencyContactPerson as string) ?? ""
      case "emergency_contact":
        return (meta?.emergencyContactNumber as string) ?? ""
      case "emergency_address":
        return (meta?.fullAddress as string) ?? ""
      default:
        return ""
    }
  }

  // No field mapped — use the label as static text
  return label
}

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

  const placeholders = template.placeholders as unknown as Placeholder[]

  for (const ph of placeholders) {
    if (options?.signal?.aborted) return

    if (ph.type === "photo" && photoUrl) {
      await addPersonPhoto(canvas, photoUrl, ph, options?.removeBg, options?.signal)
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

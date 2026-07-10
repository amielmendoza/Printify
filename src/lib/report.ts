import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib"
import { getPersonFieldValue } from "@/lib/person-fields"
import type { Person, Placeholder, Template } from "@/lib/types"

// Sign-off report: a roster of the selected people (photo + details) that the
// school reviews and signs before the IDs are printed. Letter landscape,
// pdf-lib only — independent of the Fabric canvas pipeline.

const PAGE_W = 792
const PAGE_H = 612
const MARGIN = 36
const CONTENT_W = PAGE_W - MARGIN * 2

const HEADER_H = 64
const FOOTER_H = 26
const TABLE_HEADER_H = 20
const PHOTO_BOX = 48
const CELL_PAD = 5
const BODY_SIZE = 8
const LINE_H = 10

const INK = rgb(0.1, 0.12, 0.16)
const MUTED = rgb(0.45, 0.47, 0.52)
const RULE = rgb(0.85, 0.86, 0.88)
const HEADER_BG = rgb(0.95, 0.955, 0.965)

interface Column {
  label: string
  width: number
  value: (p: Person) => string
}

export interface SignOffReportOptions {
  orgName: string
  getPhotoUrl: (p: Person) => Promise<string | null> | string | null
  /** When set, table columns mirror the templates' text fields (front and
   * back combined) so the school reviews exactly the data that will be
   * printed on the card. */
  template?: Template | null
  backTemplate?: Template | null
  onProgress?: (current: number, total: number) => void
  signal?: AbortSignal
}

function metaValue(person: Person, key: string): string | null {
  const meta = person.metadata
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null
  const record = meta as Record<string, unknown>
  const lower = key.toLowerCase()
  for (const k of Object.keys(record)) {
    if (k.toLowerCase() === lower) {
      const v = record[k]
      if (v == null) return null
      const s = String(v).trim()
      return s || null
    }
  }
  return null
}

function fullName(p: Person): string {
  const middle = p.middle_name ? ` ${p.middle_name}` : ""
  return `${p.last_name}, ${p.first_name}${middle}`
}

function contactNumber(p: Person): string {
  return p.phone || metaValue(p, "emergencyContactNumber") || "—"
}

function address(p: Person): string {
  return metaValue(p, "fullAddress") || "—"
}

function gradeSection(p: Person): string {
  const combined = metaValue(p, "gradeLevelSection")
  if (combined) return combined
  const grade = metaValue(p, "gradeLevel")
  const section = metaValue(p, "section")
  return [grade, section].filter(Boolean).join(" ") || "—"
}

const STUDENT_COLUMNS: Column[] = [
  { label: "#", width: 22, value: () => "" },
  { label: "Photo", width: 54, value: () => "" },
  { label: "Student Name", width: 122, value: fullName },
  { label: "LRN", width: 78, value: (p) => metaValue(p, "lrn") || p.id_number || "—" },
  { label: "Grade & Section", width: 84, value: gradeSection },
  { label: "Parent/Guardian", width: 108, value: (p) => metaValue(p, "emergencyContactPerson") || "—" },
  { label: "Contact No.", width: 76, value: contactNumber },
  { label: "Address", width: 176, value: address },
]

const EMPLOYEE_COLUMNS: Column[] = [
  { label: "#", width: 22, value: () => "" },
  { label: "Photo", width: 54, value: () => "" },
  { label: "Employee Name", width: 122, value: fullName },
  { label: "ID No.", width: 78, value: (p) => p.id_number || metaValue(p, "referenceNumber") || "—" },
  { label: "Designation", width: 106, value: (p) => metaValue(p, "designation") || "—" },
  { label: "Department", width: 106, value: (p) => metaValue(p, "department") || "—" },
  { label: "Contact No.", width: 76, value: contactNumber },
  { label: "Address", width: 156, value: address },
]

// Name variants are always shown in the dedicated Name column, so template
// placeholders for them would only duplicate it.
const NAME_FIELDS = new Set([
  "full_name",
  "first_name",
  "middle_name",
  "last_name",
  "fullname1",
  "fullname2",
])

// Build columns from the templates' text placeholders (front and back
// combined, deduped by field): one column per mapped data field, labeled like
// the placeholder, valued exactly as the card renders it. Returns null when
// no template has usable text fields.
function templateColumns(templates: (Template | null | undefined)[]): Column[] | null {
  const placeholders = templates.flatMap((t) =>
    Array.isArray(t?.placeholders) ? (t.placeholders as unknown as Placeholder[]) : []
  )

  const seen = new Set<string>()
  const fieldPlaceholders = placeholders.filter((ph) => {
    if (ph?.type !== "text" || !ph.field) return false
    const key = ph.field.toLowerCase()
    if (NAME_FIELDS.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (fieldPlaceholders.length === 0) return null

  const fixed = [
    { label: "#", width: 22, value: () => "" },
    { label: "Photo", width: 54, value: () => "" },
    { label: "Name", width: 122, value: fullName },
  ]
  const fieldWidth = (CONTENT_W - fixed.reduce((s, c) => s + c.width, 0)) / fieldPlaceholders.length
  return [
    ...fixed,
    ...fieldPlaceholders.map((ph) => ({
      label: ph.label || ph.field!,
      width: fieldWidth,
      value: (p: Person) => getPersonFieldValue(p, ph.field, "") || "—",
    })),
  ]
}

// Helvetica only supports WinAnsi; replace anything outside it so drawText
// never throws on exotic characters in synced data.
function sanitize(text: string): string {
  return text.replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D]/g, "?")
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (let word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    while (font.widthOfTextAtSize(word, size) > maxWidth) {
      let i = 1
      while (i < word.length && font.widthOfTextAtSize(word.slice(0, i + 1), size) <= maxWidth) i++
      lines.push(word.slice(0, i))
      word = word.slice(i)
    }
    line = word
  }
  if (line) lines.push(line)
  return lines.length ? lines : ["—"]
}

async function embedPhoto(
  doc: PDFDocument,
  url: string | null,
  signal?: AbortSignal
): Promise<PDFImage | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.length < 4) return null
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await doc.embedJpg(bytes)
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await doc.embedPng(bytes)
    return null
  } catch (err) {
    if (signal?.aborted) throw err
    return null
  }
}

export async function generateSignOffReportPdf(
  persons: Person[],
  opts: SignOffReportOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const byName = (a: Person, b: Person) => fullName(a).localeCompare(fullName(b))
  const students = persons.filter((p) => p.person_type === "student").sort(byName)
  const employees = persons.filter((p) => p.person_type !== "student").sort(byName)

  // Template-driven columns show every field the selected templates print
  // (front + back); without a template (or none with text fields) fall back
  // to the fixed student/employee layouts.
  const fromTemplate = templateColumns([opts.template, opts.backTemplate])
  const groups = fromTemplate
    ? [{ title: "", columns: fromTemplate, persons: [...persons].sort(byName) }]
    : [
        { title: "Students", columns: STUDENT_COLUMNS, persons: students },
        { title: "Employees", columns: EMPLOYEE_COLUMNS, persons: employees },
      ].filter((g) => g.persons.length > 0)

  const sections = new Set(students.map(gradeSection))
  const cohort =
    students.length && employees.length
      ? "Students & Employees"
      : students.length
        ? (sections.size === 1 ? [...sections][0] : "Multiple sections")
        : "Employees"
  const generatedOn = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  let page: PDFPage = null as unknown as PDFPage
  let y = 0

  const text = (
    str: string,
    x: number,
    yPos: number,
    opts2: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}
  ) => {
    page.drawText(sanitize(str), {
      x,
      y: yPos,
      font: opts2.font ?? font,
      size: opts2.size ?? BODY_SIZE,
      color: opts2.color ?? INK,
    })
  }

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H])
    const top = PAGE_H - MARGIN
    text(opts.orgName || "Printify", MARGIN, top - 12, { font: bold, size: 13 })
    text("ID Printing Sign-off Report", MARGIN, top - 27, { size: 10, color: MUTED })
    text(`${cohort}  ·  ${persons.length} ${persons.length === 1 ? "person" : "persons"}`, MARGIN, top - 40, {
      size: 9,
      color: MUTED,
    })
    const dateLabel = `Generated ${generatedOn}`
    text(dateLabel, PAGE_W - MARGIN - font.widthOfTextAtSize(dateLabel, 9), top - 12, {
      size: 9,
      color: MUTED,
    })
    page.drawLine({
      start: { x: MARGIN, y: top - HEADER_H + 14 },
      end: { x: PAGE_W - MARGIN, y: top - HEADER_H + 14 },
      thickness: 0.8,
      color: RULE,
    })
    y = top - HEADER_H
  }

  const drawTableHeader = (columns: Column[]) => {
    page.drawRectangle({
      x: MARGIN,
      y: y - TABLE_HEADER_H,
      width: CONTENT_W,
      height: TABLE_HEADER_H,
      color: HEADER_BG,
    })
    let x = MARGIN
    for (const col of columns) {
      text(col.label, x + CELL_PAD, y - TABLE_HEADER_H + 7, { font: bold, size: 7.5, color: MUTED })
      x += col.width
    }
    y -= TABLE_HEADER_H
  }

  const ensureSpace = (needed: number, columns?: Column[]) => {
    if (y - needed < MARGIN + FOOTER_H) {
      newPage()
      if (columns) drawTableHeader(columns)
    }
  }

  newPage()

  let processed = 0
  opts.onProgress?.(0, persons.length)

  for (const group of groups) {
    ensureSpace(TABLE_HEADER_H + PHOTO_BOX + 40, undefined)
    if (groups.length > 1) {
      y -= 16
      text(group.title, MARGIN, y + 4, { font: bold, size: 10 })
      y -= 4
    }
    drawTableHeader(group.columns)

    for (let i = 0; i < group.persons.length; i++) {
      if (opts.signal?.aborted) throw new Error("Report generation aborted")
      const person = group.persons[i]

      // Resolve wrapped lines for every text column to size the row.
      const cellLines = group.columns.map((col, ci) => {
        if (ci <= 1) return [] as string[]
        return wrapText(col.value(person) || "—", font, BODY_SIZE, col.width - CELL_PAD * 2)
      })
      const maxLines = Math.max(...cellLines.map((l) => l.length), 1)
      const rowH = Math.max(PHOTO_BOX + CELL_PAD * 2, maxLines * LINE_H + CELL_PAD * 2)

      ensureSpace(rowH, group.columns)

      const photoUrl = await Promise.resolve(opts.getPhotoUrl(person))
      const photo = await embedPhoto(doc, photoUrl, opts.signal)

      let x = MARGIN
      const rowTop = y
      group.columns.forEach((col, ci) => {
        if (ci === 0) {
          text(String(processed + 1), x + CELL_PAD, rowTop - CELL_PAD - BODY_SIZE, { color: MUTED })
        } else if (ci === 1) {
          const boxX = x + CELL_PAD
          const boxY = rowTop - CELL_PAD - PHOTO_BOX
          if (photo) {
            // Fit the photo inside the box, preserving aspect ratio.
            const scale = Math.min(PHOTO_BOX / photo.width, PHOTO_BOX / photo.height)
            const w = photo.width * scale
            const h = photo.height * scale
            page.drawImage(photo, {
              x: boxX + (PHOTO_BOX - w) / 2,
              y: boxY + (PHOTO_BOX - h) / 2,
              width: w,
              height: h,
            })
          } else {
            page.drawRectangle({
              x: boxX,
              y: boxY,
              width: PHOTO_BOX,
              height: PHOTO_BOX,
              color: HEADER_BG,
              borderColor: RULE,
              borderWidth: 0.5,
            })
            const initials =
              `${person.first_name?.[0] ?? ""}${person.last_name?.[0] ?? ""}`.toUpperCase() || "?"
            const iw = bold.widthOfTextAtSize(initials, 14)
            text(initials, boxX + (PHOTO_BOX - iw) / 2, boxY + PHOTO_BOX / 2 - 5, {
              font: bold,
              size: 14,
              color: MUTED,
            })
          }
        } else {
          const nameCol = ci === 2
          cellLines[ci].forEach((line, li) => {
            text(line, x + CELL_PAD, rowTop - CELL_PAD - BODY_SIZE - li * LINE_H, {
              font: nameCol ? bold : font,
            })
          })
        }
        x += col.width
      })

      y -= rowH
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_W - MARGIN, y },
        thickness: 0.4,
        color: RULE,
      })

      processed++
      opts.onProgress?.(processed, persons.length)
    }
  }

  // Sign-off block: the whole point of the report.
  const SIGN_H = 92
  ensureSpace(SIGN_H + 16)
  y -= 28
  const signers = ["Prepared by:", "Checked by:", "Approved by:"]
  const colW = CONTENT_W / 3
  signers.forEach((label, i) => {
    const x = MARGIN + i * colW
    text(label, x, y, { size: 9, color: MUTED })
    page.drawLine({
      start: { x, y: y - 38 },
      end: { x: x + colW - 40, y: y - 38 },
      thickness: 0.8,
      color: INK,
    })
    text("Signature over printed name", x, y - 48, { size: 7.5, color: MUTED })
    text("Date: ____________________", x, y - 60, { size: 7.5, color: MUTED })
  })

  // Page numbers (drawn last so the total is known).
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    const label = `Page ${i + 1} of ${pages.length}`
    p.drawText(label, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(label, 8),
      y: MARGIN - 14,
      font,
      size: 8,
      color: MUTED,
    })
  })

  return doc.save()
}

export function signOffReportFilename(persons: Person[]): string {
  const students = persons.filter((p) => p.person_type === "student")
  const sections = new Set(students.map(gradeSection))
  const label =
    students.length === persons.length && sections.size === 1 && ![...sections][0].startsWith("—")
      ? [...sections][0]
      : students.length === 0
        ? "employees"
        : new Date().toISOString().slice(0, 10)
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report"
  return `sign-off-report-${slug}.pdf`
}

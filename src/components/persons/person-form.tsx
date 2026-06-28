"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { PhotoUpload } from "./photo-upload"
import { toast } from "sonner"
import { Loader2, UserPlus, User } from "lucide-react"
import type { Person, PersonType } from "@/lib/types"

interface PersonFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  person?: Person | null
  onSaved: () => void
}

export function PersonForm({ open, onOpenChange, person, onSaved }: PersonFormProps) {
  const [loading, setLoading] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    first_name: person?.first_name ?? "",
    last_name: person?.last_name ?? "",
    middle_name: person?.middle_name ?? "",
    person_type: (person?.person_type ?? "student") as PersonType,
    category: person?.category ?? "",
    id_number: person?.id_number ?? "",
    email: person?.email ?? "",
    phone: person?.phone ?? "",
  })

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      let photoPath = person?.photo_path ?? null

      if (photoFile) {
        const fd = new FormData()
        fd.append("file", photoFile)
        fd.append("bucket", "photos")
        const res = await fetch("/api/upload", { method: "POST", body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        photoPath = data.path
      }

      const payload = {
        ...formData,
        photo_path: photoPath,
        middle_name: formData.middle_name || null,
        category: formData.category || null,
        id_number: formData.id_number || null,
        email: formData.email || null,
        phone: formData.phone || null,
      }

      if (person) {
        const res = await fetch(`/api/persons/${person.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error)
        }
        toast.success("Person updated", { description: `${formData.first_name} ${formData.last_name}` })
      } else {
        const res = await fetch("/api/persons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error)
        }
        toast.success("Person added", { description: `${formData.first_name} ${formData.last_name}` })
      }

      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save person")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 p-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <User className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Persons</p>
            <h2 className="text-[15px] font-semibold tracking-tight">
              {person ? "Edit person" : "Add person"}
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 p-5">
            {/* Photo + name row */}
            <div className="flex gap-4">
              <PhotoUpload
                currentUrl={person?.photo_path ? undefined : undefined}
                onFileSelect={setPhotoFile}
              />
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name" className="text-[12px]">First name</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => updateField("first_name", e.target.value)}
                      required
                      autoFocus
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name" className="text-[12px]">Last name</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => updateField("last_name", e.target.value)}
                      required
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="middle_name" className="text-[12px]">
                    Middle name
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">Optional</span>
                  </Label>
                  <Input
                    id="middle_name"
                    value={formData.middle_name}
                    onChange={(e) => updateField("middle_name", e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* Classification */}
            <FormSection title="Classification">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Type</Label>
                  <Select
                    value={formData.person_type}
                    onValueChange={(v) => { if (v) updateField("person_type", v) }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="faculty">Faculty</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="visitor">Visitor</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-[12px]">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    placeholder="Grade 10 · IT Dept"
                    className="h-9"
                  />
                </div>
              </div>
            </FormSection>

            {/* Identifiers */}
            <FormSection title="Identifiers">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="id_number" className="text-[12px]">ID number</Label>
                  <Input
                    id="id_number"
                    value={formData.id_number}
                    onChange={(e) => updateField("id_number", e.target.value)}
                    placeholder="2024-00123"
                    className="h-9 tabular-nums"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[12px]">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="name@school.edu"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-[12px]">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="+1 555 0100"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            </FormSection>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              {loading ? "Saving…" : person ? "Save changes" : "Add person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

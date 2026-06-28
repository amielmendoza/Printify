/**
 * One-time data migration: Supabase (Postgres + Storage) -> SQL Server (Prisma)
 * + Azure Blob Storage.
 *
 * Prerequisites:
 *   1. The Supabase project must be RUNNING (unpause it in the dashboard).
 *   2. Temporarily install the Supabase client:  npm i -D @supabase/supabase-js
 *   3. Set the SQL Server schema first:           npx prisma db push
 *   4. Provide env vars (see below), then:        node scripts/migrate-from-supabase.mjs
 *
 * Required env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (source)
 *   DATABASE_URL                              (SQL Server target, used by Prisma)
 *   AZURE_STORAGE_CONNECTION_STRING           (target blob store)
 *
 * Notes:
 *   - Users: Supabase auth.users are NOT exported here (passwords are hashed and
 *     unrecoverable). External-API users are recreated on first login; local
 *     users must re-register or be seeded separately.
 *   - jsonb columns are stringified into NVARCHAR(MAX).
 *   - Blobs are copied templates/photos buckets -> same-named Azure containers.
 */

import { createClient } from "@supabase/supabase-js"
import { PrismaClient } from "@prisma/client"
import { BlobServiceClient } from "@azure/storage-blob"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)
const prisma = new PrismaClient()
const blobService = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
)

const j = (v) => (v == null ? null : JSON.stringify(v))

async function migrateTable(name, fetchFn, writeFn) {
  const rows = await fetchFn()
  console.log(`${name}: ${rows.length} rows`)
  for (const row of rows) await writeFn(row)
}

async function copyBucket(bucket) {
  const container = blobService.getContainerClient(bucket)
  await container.createIfNotExists()
  // List recursively. Supabase Storage stores objects under "<org>/<file>".
  const { data: top } = await supabase.storage.from(bucket).list("", { limit: 1000 })
  for (const folder of top ?? []) {
    const { data: files } = await supabase.storage.from(bucket).list(folder.name, { limit: 1000 })
    for (const file of files ?? []) {
      const path = `${folder.name}/${file.name}`
      const { data: blob } = await supabase.storage.from(bucket).download(path)
      if (!blob) continue
      const buffer = Buffer.from(await blob.arrayBuffer())
      await container.getBlockBlobClient(path).uploadData(buffer)
      console.log(`  ${bucket}/${path}`)
    }
  }
}

async function main() {
  // Organizations
  await migrateTable(
    "organizations",
    async () => (await supabase.from("organizations").select("*")).data ?? [],
    (o) =>
      prisma.organization.upsert({
        where: { id: o.id },
        update: {},
        create: {
          id: o.id, name: o.name, slug: o.slug, logo_url: o.logo_url,
          created_at: new Date(o.created_at), updated_at: new Date(o.updated_at),
        },
      })
  )

  // Templates
  await migrateTable(
    "templates",
    async () => (await supabase.from("templates").select("*")).data ?? [],
    (t) =>
      prisma.template.create({
        data: {
          id: t.id, organization_id: t.organization_id, name: t.name,
          description: t.description, file_path: t.file_path, file_type: t.file_type,
          width_inches: t.width_inches, height_inches: t.height_inches,
          placeholders: j(t.placeholders) ?? "[]", is_active: t.is_active,
          created_at: new Date(t.created_at), updated_at: new Date(t.updated_at),
        },
      })
  )

  // Persons
  await migrateTable(
    "persons",
    async () => (await supabase.from("persons").select("*")).data ?? [],
    (p) =>
      prisma.person.create({
        data: {
          id: p.id, organization_id: p.organization_id, first_name: p.first_name,
          last_name: p.last_name, middle_name: p.middle_name, photo_path: p.photo_path,
          person_type: p.person_type, category: p.category, id_number: p.id_number,
          email: p.email, phone: p.phone, metadata: j(p.metadata) ?? "{}",
          is_active: p.is_active,
          created_at: new Date(p.created_at), updated_at: new Date(p.updated_at),
        },
      })
  )

  // ID cards
  await migrateTable(
    "id_cards",
    async () => (await supabase.from("id_cards").select("*")).data ?? [],
    (c) =>
      prisma.idCard.create({
        data: {
          id: c.id, organization_id: c.organization_id, person_id: c.person_id,
          template_id: c.template_id, render_state: j(c.render_state),
          exported_pdf_path: c.exported_pdf_path, status: c.status,
          valid_from: c.valid_from ? new Date(c.valid_from) : null,
          valid_until: c.valid_until ? new Date(c.valid_until) : null,
          created_at: new Date(c.created_at), updated_at: new Date(c.updated_at),
        },
      })
  )

  // Print logs
  await migrateTable(
    "print_logs",
    async () => (await supabase.from("print_logs").select("*")).data ?? [],
    (l) =>
      prisma.printLog.create({
        data: {
          id: l.id, organization_id: l.organization_id,
          person_external_id: l.person_external_id, person_name: l.person_name,
          template_id: l.template_id, template_name: l.template_name,
          action: l.action, created_at: new Date(l.created_at),
        },
      })
  )

  // Storage buckets
  await copyBucket("templates")
  await copyBucket("photos")

  await prisma.$disconnect()
  console.log("Migration complete.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

// Read-only backup of organizations + templates to scripts/backup-data.json.
// Run: node --env-file=.env.local scripts/backup-data.mjs
import { writeFileSync } from "node:fs"
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` }

async function all(table) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=*`, { headers })
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

const data = {
  exported_at: new Date().toISOString(),
  organizations: await all("organizations"),
  templates: await all("templates"),
  profiles: await all("profiles"),
}
writeFileSync("scripts/backup-data.json", JSON.stringify(data, null, 2))
console.log(
  `Backed up: ${data.organizations.length} orgs, ${data.templates.length} templates, ${data.profiles.length} profiles -> scripts/backup-data.json`
)

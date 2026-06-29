// Provisions the private Supabase Storage buckets the app needs.
// Run with env loaded, e.g.:
//   node --env-file=.env.local scripts/setup-supabase-storage.mjs
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

for (const name of ["templates", "photos"]) {
  const { error } = await supabase.storage.createBucket(name, { public: false })
  if (error && !/already exists/i.test(error.message)) {
    console.error(`createBucket ${name}: ${error.message}`)
    process.exit(1)
  }
  console.log(`${name}: ${error ? "already exists" : "created"}`)
}
console.log("Storage buckets ready.")

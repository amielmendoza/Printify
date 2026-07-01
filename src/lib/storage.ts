// Supabase Storage — replaces Azure Blob. Buckets are private; read access is
// granted via short-lived signed URLs minted server-side (see getSignedUrl).
//
// Uses the Storage REST API directly via fetch rather than @supabase/supabase-js:
// supabase-js eagerly initializes a realtime client whose `createClient` throws
// on Node < 22 ("Node.js 20 detected without native WebSocket support"). The
// REST endpoints have no such dependency and work on any Node version.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export const BUCKETS = {
  templates: "templates",
  photos: "photos",
} as const

export type BucketName = keyof typeof BUCKETS

function storageBase(): string {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured"
    )
  }
  return `${SUPABASE_URL}/storage/v1`
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY as string }
}

// Uploads a file and returns its storage path in the form "<bucket>/<blob>",
// matching the path convention used throughout the app.
export async function uploadFile(
  bucket: BucketName,
  blobName: string,
  data: Buffer | ArrayBuffer | Uint8Array,
  contentType: string,
  upsert = false
): Promise<string> {
  const body = data instanceof Buffer ? data : Buffer.from(data as ArrayBuffer)
  const res = await fetch(`${storageBase()}/object/${BUCKETS[bucket]}/${blobName}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": contentType, "x-upsert": String(upsert) },
    body: new Uint8Array(body),
  })
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${await res.text()}`)
  }
  return `${bucket}/${blobName}`
}

// Downloads a stored object's bytes, or null if it doesn't exist (used for the
// background-removal cache). Server-only.
export async function downloadFile(
  bucket: BucketName,
  blobName: string
): Promise<ArrayBuffer | null> {
  const res = await fetch(
    `${storageBase()}/object/authenticated/${BUCKETS[bucket]}/${blobName}`,
    { headers: authHeaders() }
  )
  if (!res.ok) return null
  return res.arrayBuffer()
}

// Mints a short-lived read-only signed URL for a stored path ("<bucket>/<blob>"
// or "<blob>" defaulting to the photos bucket). Default lifetime: 1 hour.
export async function getSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { bucket, blobName } = splitPath(storagePath)
  const res = await fetch(
    `${storageBase()}/object/sign/${BUCKETS[bucket]}/${blobName}`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    }
  )
  if (!res.ok) {
    throw new Error(`Failed to create signed URL: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { signedURL: string }
  // signedURL is relative to /storage/v1, e.g. "/object/sign/<bucket>/<blob>?token=..."
  return `${storageBase()}${data.signedURL}`
}

// Accepts either "<bucket>/<blob...>" or a bare blob name (defaults to photos).
function splitPath(storagePath: string): { bucket: BucketName; blobName: string } {
  const slash = storagePath.indexOf("/")
  if (slash !== -1) {
    const maybeBucket = storagePath.slice(0, slash)
    if (maybeBucket === "templates" || maybeBucket === "photos") {
      return { bucket: maybeBucket, blobName: storagePath.slice(slash + 1) }
    }
  }
  return { bucket: "photos", blobName: storagePath }
}

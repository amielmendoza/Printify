// Client-side helper to resolve a stored blob path to a short-lived signed URL
// via the /api/storage/url endpoint.
//
// Results are cached in-memory keyed by bucket/path. This avoids a round-trip to
// /api/storage/url on every render AND keeps the URL stable, so the browser can
// HTTP-cache the underlying image (e.g. the template background) instead of
// re-downloading it each time a different query string is minted.

const TTL_MS = 50 * 60 * 1000 // signed URLs live ~1h; refresh a little early
const cache = new Map<string, { url: string; expires: number }>()

export async function getStorageUrl(
  bucket: string,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null

  const key = `${bucket}/${path}`
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.url

  try {
    const res = await fetch(
      `/api/storage/url?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`
    )
    if (!res.ok) return null
    const data = await res.json()
    const url = (data.url as string) ?? null
    if (url) cache.set(key, { url, expires: Date.now() + TTL_MS })
    return url
  } catch {
    return null
  }
}

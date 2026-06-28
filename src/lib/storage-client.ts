// Client-side helper to resolve a stored blob path to a short-lived SAS URL via
// the /api/storage/url endpoint. Replaces Supabase's synchronous getPublicUrl.

export async function getStorageUrl(
  bucket: string,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null
  try {
    const res = await fetch(
      `/api/storage/url?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`
    )
    if (!res.ok) return null
    const data = await res.json()
    return (data.url as string) ?? null
  } catch {
    return null
  }
}

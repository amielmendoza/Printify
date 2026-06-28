/**
 * Background removal via BRIA RMBG-2.0 (server-side, proxied through /api/remove-bg).
 * State-of-the-art model for hair/edge quality, built on BiRefNet architecture.
 * Results are cached in memory by URL to avoid reprocessing.
 *
 * Cache and inflight maps are stored on globalThis so they are shared across
 * code-split chunks (dynamic imports can create separate module instances with
 * Turbopack/webpack, each with its own module-level variables).
 */

interface BgRemovalGlobals {
  __bgRemovalCache?: Map<string, string>
  __bgRemovalInflight?: Map<string, Promise<string>>
}

function getCache(): Map<string, string> {
  const g = globalThis as unknown as BgRemovalGlobals
  if (!g.__bgRemovalCache) g.__bgRemovalCache = new Map()
  return g.__bgRemovalCache
}

function getInflight(): Map<string, Promise<string>> {
  const g = globalThis as unknown as BgRemovalGlobals
  if (!g.__bgRemovalInflight) g.__bgRemovalInflight = new Map()
  return g.__bgRemovalInflight
}

/**
 * Remove background from an image URL.
 * Sends the image to /api/remove-bg (PiAPI RMBG-2.0).
 * Returns a blob URL of the transparent PNG result.
 * Concurrent calls for the same URL are deduplicated automatically.
 */
export async function removeImageBackground(imageUrl: string): Promise<string> {
  const cache = getCache()
  const inflight = getInflight()

  const cached = cache.get(imageUrl)
  if (cached) return cached

  // If already in-flight, wait for the existing request
  const pending = inflight.get(imageUrl)
  if (pending) return pending

  const MAX_RETRIES = 2

  const promise = (async () => {
    // Fetch the original image as blob (once, reuse across retries)
    const imgRes = await fetch(imageUrl)
    const imgBlob = await imgRes.blob()

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch("/api/remove-bg", {
        method: "POST",
        headers: { "Content-Type": imgBlob.type || "image/jpeg" },
        body: imgBlob,
      })

      if (res.ok) {
        const resultBlob = await res.blob()
        const resultUrl = URL.createObjectURL(resultBlob)
        getCache().set(imageUrl, resultUrl)
        return resultUrl
      }

      // Last attempt — throw
      if (attempt === MAX_RETRIES) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error || `Background removal failed (${res.status})`)
      }

      // Wait before retry
      await new Promise((r) => setTimeout(r, 1500))
    }

    throw new Error("Background removal failed after retries")
  })()

  inflight.set(imageUrl, promise)
  promise.finally(() => getInflight().delete(imageUrl))

  return promise
}

/**
 * Pre-process background removal for multiple photo URLs in parallel.
 * Processes in batches to avoid overwhelming the server.
 * Skips already-cached URLs. Calls onProgress after each completes.
 */
export async function preloadBackgroundRemoval(
  photoUrls: string[],
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const cache = getCache()
  const uncached = photoUrls.filter((url) => !cache.has(url))
  if (uncached.length === 0) {
    onProgress?.(photoUrls.length, photoUrls.length)
    return
  }

  const CONCURRENCY = 3
  let completed = photoUrls.length - uncached.length

  // Process in parallel with concurrency limit
  const queue = [...uncached]
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      if (signal?.aborted) return
      const url = queue.shift()!
      try {
        await removeImageBackground(url)
      } catch (e) {
        console.warn("Background removal preload failed for:", url, e)
      }
      completed++
      onProgress?.(completed, photoUrls.length)
    }
  })

  await Promise.all(workers)
}

export function isBackgroundCached(imageUrl: string): boolean {
  return getCache().has(imageUrl)
}

export function clearBackgroundCache() {
  const cache = getCache()
  for (const url of cache.values()) {
    URL.revokeObjectURL(url)
  }
  cache.clear()
}

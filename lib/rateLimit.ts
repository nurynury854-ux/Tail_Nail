type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()

// Prune expired entries to prevent unbounded memory growth.
// Called on each check — only scans if enough time has passed.
let lastPruneAt = 0
function maybePrune() {
  const now = Date.now()
  if (now - lastPruneAt < 60_000) return
  lastPruneAt = now
  store.forEach((entry, key) => {
    if (now > entry.resetAt) store.delete(key)
  })
}

/**
 * Returns true if the request is within the allowed rate.
 * Returns false (blocked) if the limit has been exceeded.
 */
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  maybePrune()
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) return false

  entry.count++
  return true
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

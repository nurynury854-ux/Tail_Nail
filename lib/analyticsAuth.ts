import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

// Read-only analytics API for the owner's external AI tools (e.g. a ChatGPT
// Custom GPT). Authenticated by a single Bearer key, ANALYTICS_API_KEY, kept
// separate from every other secret so it can be rotated on its own.
// If the key is unset the API is disabled.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Returns an error response when the request may not proceed, else null. */
export function checkAnalyticsAuth(request: NextRequest): NextResponse | null {
  const key = process.env.ANALYTICS_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'ANALYTICS_API_KEY not configured' }, { status: 503 })
  }
  if (!checkRateLimit(`analytics:${getClientIp(request)}`, 30, 60_000)) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }
  const auth = request.headers.get('authorization') || ''
  if (!timingSafeEqual(auth, `Bearer ${key}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

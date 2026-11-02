import type { NextRequest } from 'next/server'

const SESSION_COOKIE_NAME = 'ttail_admin_session'
const SESSION_TTL_MS = 60 * 60 * 12 * 1000 // 12 hours, same as the cookie

// The session is `<expiry>.<HMAC(expiry)>`, keyed by a server secret plus the
// admin credentials: it can't be forged without them, it stops working when it
// expires (not only when the browser drops the cookie), and changing
// ADMIN_PASSWORD logs every existing admin session out.
// Web Crypto API — works in both Edge Runtime (middleware) and Node.js 18+.
function signingKey(): string | null {
  const user = process.env.ADMIN_USERNAME
  const pass = process.env.ADMIN_PASSWORD
  if (!user || !pass) return null
  const secret = process.env.CHECKOUT_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return `${secret}:${user}:${pass}:ttail-admin-v3`
}

async function hmacHex(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function getAdminSessionCookieName(): string {
  return SESSION_COOKIE_NAME
}

export function isValidAdminCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME
  const expectedPass = process.env.ADMIN_PASSWORD
  if (!expectedUser || !expectedPass) return false
  return timingSafeEqual(username, expectedUser) && timingSafeEqual(password, expectedPass)
}

export async function createAdminSessionToken(): Promise<string | null> {
  const key = signingKey()
  if (!key) return null
  const exp = String(Date.now() + SESSION_TTL_MS)
  return `${exp}.${await hmacHex(key, exp)}`
}

export async function isValidAdminSessionToken(token?: string): Promise<boolean> {
  const key = signingKey()
  if (!token || !key) return false
  const dot = token.indexOf('.')
  if (dot < 0) return false
  const exp = token.slice(0, dot)
  if (!/^\d+$/.test(exp) || Date.now() > Number(exp)) return false
  return timingSafeEqual(token.slice(dot + 1), await hmacHex(key, exp))
}

export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  return isValidAdminSessionToken(token)
}

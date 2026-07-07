import type { NextRequest } from 'next/server'
import type { CheckoutOrder, CheckoutRole, CheckoutSession } from './checkoutTypes'

// Session cookie is distinct from the admin cookie so both systems coexist.
const SESSION_COOKIE_NAME = 'ttail_checkout_session'
const SESSION_TTL_MS = 60 * 60 * 12 * 1000 // 12 hours
const PBKDF2_ITERATIONS = 100_000

function getSecret(): string {
  return process.env.CHECKOUT_SESSION_SECRET || 'ttail-checkout-dev-secret-v1'
}

export function getCheckoutSessionCookieName(): string {
  return SESSION_COOKIE_NAME
}

// ---------------------------------------------------------------------
// Password hashing — PBKDF2-SHA256 via Web Crypto (works in Edge + Node)
// ---------------------------------------------------------------------
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function randomSaltHex(): string {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  return bytesToHex(salt)
}

async function derive(password: string, saltHex: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex) as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )
  return bytesToHex(new Uint8Array(bits))
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomSaltHex()
  const hash = await derive(password, salt)
  return { hash, salt }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  if (!hash || !salt) return false
  const candidate = await derive(password, salt)
  return timingSafeEqual(candidate, hash)
}

// ---------------------------------------------------------------------
// Signed stateless session token: base64url(payload).hmacHex
// ---------------------------------------------------------------------
function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return bytesToHex(new Uint8Array(sig))
}

interface TokenPayload {
  accountId: string
  role: CheckoutRole
  branchId: string | null
  stylistId: string | null
  displayName: string
  username: string
  exp: number
}

export async function createSessionToken(
  session: Omit<CheckoutSession, never>,
): Promise<string> {
  const payload: TokenPayload = {
    accountId: session.accountId,
    role: session.role,
    branchId: session.branchId,
    stylistId: session.stylistId,
    displayName: session.displayName,
    username: session.username,
    exp: Date.now() + SESSION_TTL_MS,
  }
  const encoded = base64UrlEncode(JSON.stringify(payload))
  const sig = await sign(encoded)
  return `${encoded}.${sig}`
}

export async function verifySessionToken(token?: string): Promise<CheckoutSession | null> {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  const encoded = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expectedSig = await sign(encoded)
  if (!timingSafeEqual(sig, expectedSig)) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as TokenPayload
    if (!payload.exp || Date.now() > payload.exp) return null
    return {
      accountId: payload.accountId,
      role: payload.role,
      branchId: payload.branchId,
      stylistId: payload.stylistId,
      displayName: payload.displayName,
      username: payload.username,
    }
  } catch {
    return null
  }
}

export async function getCheckoutSession(request: NextRequest): Promise<CheckoutSession | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const session = await verifySessionToken(token)
  if (!session) return null

  // The env-bootstrap owner has no DB row — trust the token as-is.
  if (session.accountId === 'owner-bootstrap') return session

  // Re-read role/branch/stylist/active from the DB so account changes
  // (type switch, branch transfer, deactivation, deletion) take effect
  // immediately, with no need to log out and back in. Dynamic import keeps
  // Supabase out of the Edge middleware bundle.
  try {
    const { createAdminClient } = await import('./supabase')
    const admin = createAdminClient()
    if (!admin) return session
    const { data: account } = await admin
      .from('accounts')
      .select('role, branch_id, stylist_id, display_name, is_active')
      .eq('id', session.accountId)
      .maybeSingle()
    if (!account || !account.is_active) return null // deleted or deactivated → logged out
    return {
      accountId: session.accountId,
      username: session.username,
      role: account.role,
      branchId: account.branch_id ?? null,
      stylistId: account.stylist_id ?? null,
      displayName: account.display_name ?? session.displayName,
    }
  } catch {
    return session
  }
}

export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000

// ---------------------------------------------------------------------
// Authorization helpers
// ---------------------------------------------------------------------
export function requireRole(session: CheckoutSession | null, roles: CheckoutRole[]): boolean {
  return Boolean(session && roles.includes(session.role))
}

export function canViewBranch(session: CheckoutSession | null, branchId: string): boolean {
  if (!session) return false
  if (session.role === 'owner') return true
  return session.branchId === branchId
}

export function canViewStylist(session: CheckoutSession | null, stylistId: string | null): boolean {
  if (!session) return false
  if (session.role === 'owner' || session.role === 'manager') return true
  return Boolean(stylistId && session.stylistId === stylistId)
}

function ownsOrder(session: CheckoutSession, order: CheckoutOrder): boolean {
  return (
    (order.account_id_snapshot != null && order.account_id_snapshot === session.accountId) ||
    (order.stylist_id_snapshot != null && order.stylist_id_snapshot === session.stylistId)
  )
}

/**
 * The edit-permission matrix:
 *  - confirmed orders: only the owner.
 *  - submitted orders: owner or the order's branch manager (NOT the stylist).
 *  - draft orders: owner, the order's branch manager, or the owning stylist.
 */
export function canEditOrder(session: CheckoutSession | null, order: CheckoutOrder): boolean {
  if (!session) return false
  if (session.role === 'owner') return true
  if (order.status === 'confirmed') return false

  if (session.role === 'manager') {
    return session.branchId === order.branch_id_snapshot
  }

  // stylist
  return order.status === 'draft' && ownsOrder(session, order)
}

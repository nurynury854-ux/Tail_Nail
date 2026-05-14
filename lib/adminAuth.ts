import { createHash, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE_NAME = 'ttail_admin_session'

// SHA-256 hash of credentials — not reversible to the original password.
function buildSessionToken(username: string, password: string): string {
  return createHash('sha256').update(`${username}:${password}:ttail-admin-v2`).digest('hex')
}

export function getAdminSessionCookieName(): string {
  return SESSION_COOKIE_NAME
}

export function isValidAdminCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME
  const expectedPass = process.env.ADMIN_PASSWORD

  if (!expectedUser || !expectedPass) return false
  return username === expectedUser && password === expectedPass
}

export function getExpectedAdminSessionToken(): string | null {
  const expectedUser = process.env.ADMIN_USERNAME
  const expectedPass = process.env.ADMIN_PASSWORD
  if (!expectedUser || !expectedPass) return null
  return buildSessionToken(expectedUser, expectedPass)
}

export function isValidAdminSessionToken(token?: string): boolean {
  if (!token) return false
  const expected = getExpectedAdminSessionToken()
  if (!expected) return false
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}

export function isAdminRequest(request: NextRequest): boolean {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  return isValidAdminSessionToken(token)
}

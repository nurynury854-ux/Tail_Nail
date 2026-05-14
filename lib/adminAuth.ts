import type { NextRequest } from 'next/server'

const SESSION_COOKIE_NAME = 'ttail_admin_session'

// Web Crypto API — works in both Edge Runtime and Node.js 18+.
// Returns a SHA-256 hex digest that cannot be reversed to the original password.
async function buildSessionToken(username: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${username}:${password}:ttail-admin-v2`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
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

export async function getExpectedAdminSessionToken(): Promise<string | null> {
  const expectedUser = process.env.ADMIN_USERNAME
  const expectedPass = process.env.ADMIN_PASSWORD
  if (!expectedUser || !expectedPass) return null
  return buildSessionToken(expectedUser, expectedPass)
}

export async function isValidAdminSessionToken(token?: string): Promise<boolean> {
  if (!token) return false
  const expected = await getExpectedAdminSessionToken()
  return Boolean(expected && token === expected)
}

export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  return isValidAdminSessionToken(token)
}

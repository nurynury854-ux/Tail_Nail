const SESSION_COOKIE_NAME = 'ttail_admin_session'

function buildSessionToken(username: string, password: string): string {
  const raw = `${username}:${password}:ttail-admin`
  return encodeURIComponent(raw)
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
  return Boolean(expected && token === expected)
}

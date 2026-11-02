import { createAdminClient } from './supabase'

// Failed-login throttle shared by every server instance. lib/rateLimit.ts is
// per-instance memory, so on Vercel an attacker spreading guesses across
// instances got far more than 5 tries per window. Counting failures in the
// database caps guesses per IP *and* per username (so rotating IPs doesn't
// help against one account) no matter which instance answers.
//
// Fails open: if the login_failures table is missing or the query errors, the
// in-memory limiter in the login routes still applies.

const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES_PER_IP = 20
const MAX_FAILURES_PER_USERNAME = 10

function keysFor(scope: string, ip: string, username: string) {
  return { ipKey: `${scope}:ip:${ip}`, userKey: `${scope}:user:${username.toLowerCase()}` }
}

export async function isLoginThrottled(scope: string, ip: string, username: string): Promise<boolean> {
  const db = createAdminClient()
  if (!db) return false
  const { ipKey, userKey } = keysFor(scope, ip, username)
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const [byIp, byUser] = await Promise.all([
    db.from('login_failures').select('id', { count: 'exact', head: true }).eq('key', ipKey).gte('created_at', since),
    db.from('login_failures').select('id', { count: 'exact', head: true }).eq('key', userKey).gte('created_at', since),
  ])
  if (byIp.error || byUser.error) return false
  return (byIp.count ?? 0) >= MAX_FAILURES_PER_IP || (byUser.count ?? 0) >= MAX_FAILURES_PER_USERNAME
}

export async function recordLoginFailure(scope: string, ip: string, username: string): Promise<void> {
  const db = createAdminClient()
  if (!db) return
  const { ipKey, userKey } = keysFor(scope, ip, username)
  await db.from('login_failures').insert([{ key: ipKey }, { key: userKey }])
  // Keep the table small; anything older than a day is irrelevant.
  await db.from('login_failures').delete().lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
}

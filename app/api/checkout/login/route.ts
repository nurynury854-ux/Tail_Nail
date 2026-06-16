import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { isValidAdminCredentials } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import {
  createSessionToken,
  getCheckoutSessionCookieName,
  SESSION_MAX_AGE_SECONDS,
  verifyPassword,
} from '@/lib/checkoutAuth'
import type { CheckoutSession } from '@/lib/checkoutTypes'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!checkRateLimit(`checkout-login:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: '嘗試次數過多，請稍後再試' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!username || !password) {
    return NextResponse.json({ error: '請輸入帳號與密碼' }, { status: 400 })
  }

  let session: CheckoutSession | null = null

  // 1) Try the accounts table.
  const admin = createAdminClient()
  if (admin) {
    const { data: account } = await admin
      .from('accounts')
      .select('*')
      .eq('username', username)
      .maybeSingle()

    if (account && account.is_active) {
      const ok = await verifyPassword(password, account.password_hash, account.password_salt)
      if (ok) {
        session = {
          accountId: account.id,
          role: account.role,
          branchId: account.branch_id ?? null,
          stylistId: account.stylist_id ?? null,
          displayName: account.display_name,
          username: account.username,
        }
      }
    }
  }

  // 2) Owner bootstrap — reuses the admin credentials (ADMIN_USERNAME / ADMIN_PASSWORD).
  // Kenny is the top admin in both systems, so there's no separate owner password.
  // This works even before any DB account exists.
  if (!session && isValidAdminCredentials(username, password)) {
    session = {
      accountId: 'owner-bootstrap',
      role: 'owner',
      branchId: null,
      stylistId: null,
      displayName: 'Owner',
      username,
    }
  }

  if (!session) {
    return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
  }

  const token = await createSessionToken(session)
  const response = NextResponse.json({
    success: true,
    role: session.role,
    displayName: session.displayName,
  })
  response.cookies.set({
    name: getCheckoutSessionCookieName(),
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
  return response
}

import { NextRequest, NextResponse } from 'next/server'
import {
  getAdminSessionCookieName,
  createAdminSessionToken,
  isValidAdminCredentials,
} from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isLoginThrottled, recordLoginFailure } from '@/lib/loginThrottle'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!checkRateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: '嘗試次數過多，請稍後再試' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (await isLoginThrottled('admin', ip, username)) {
    return NextResponse.json({ error: '嘗試次數過多，請稍後再試' }, { status: 429 })
  }

  if (!isValidAdminCredentials(username, password)) {
    await recordLoginFailure('admin', ip, username)
    return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
  }

  const token = await createAdminSessionToken()
  if (!token) {
    return NextResponse.json({ error: '管理員帳號尚未設定' }, { status: 500 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set({
    name: getAdminSessionCookieName(),
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })

  return response
}

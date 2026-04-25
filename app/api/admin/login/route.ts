import { NextRequest, NextResponse } from 'next/server'
import {
  getAdminSessionCookieName,
  getExpectedAdminSessionToken,
  isValidAdminCredentials,
} from '@/lib/adminAuth'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!isValidAdminCredentials(username, password)) {
    return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
  }

  const token = getExpectedAdminSessionToken()
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

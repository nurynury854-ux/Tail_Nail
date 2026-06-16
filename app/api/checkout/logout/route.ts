import { NextResponse } from 'next/server'
import { getCheckoutSessionCookieName } from '@/lib/checkoutAuth'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set({
    name: getCheckoutSessionCookieName(),
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}

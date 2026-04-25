import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionCookieName, isValidAdminSessionToken } from '@/lib/adminAuth'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/admin-login') || pathname.startsWith('/api/admin/login')) {
    return NextResponse.next()
  }

  const token = request.cookies.get(getAdminSessionCookieName())?.value
  if (isValidAdminSessionToken(token)) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = '/admin-login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/admin/:path*'],
}

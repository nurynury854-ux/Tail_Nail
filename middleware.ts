import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionCookieName, isValidAdminSessionToken } from '@/lib/adminAuth'
import { getCheckoutSessionCookieName, verifySessionToken } from '@/lib/checkoutAuth'

async function handleAdmin(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin-login') || pathname.startsWith('/api/admin/login')) {
    return NextResponse.next()
  }

  const token = request.cookies.get(getAdminSessionCookieName())?.value
  if (await isValidAdminSessionToken(token)) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = '/admin-login'
  return NextResponse.redirect(url)
}

async function handleCheckout(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Login endpoints and the login page are always reachable.
  if (pathname.startsWith('/checkout/login') || pathname.startsWith('/api/checkout/login')) {
    return NextResponse.next()
  }

  const token = request.cookies.get(getCheckoutSessionCookieName())?.value
  if (await verifySessionToken(token)) {
    return NextResponse.next()
  }

  // API routes get a 401; pages redirect to the login screen.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = request.nextUrl.clone()
  url.pathname = '/checkout/login'
  return NextResponse.redirect(url)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/checkout') || pathname.startsWith('/api/checkout')) {
    return handleCheckout(request)
  }

  if (pathname.startsWith('/admin')) {
    return handleAdmin(request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/checkout/:path*', '/api/checkout/:path*'],
}

import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  getCheckoutSession,
  getCheckoutSessionCookieName,
} from '@/lib/checkoutAuth'

export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const response = NextResponse.json({
    accountId: session.accountId,
    role: session.role,
    branchId: session.branchId,
    stylistId: session.stylistId,
    displayName: session.displayName,
    username: session.username,
  })

  // Sliding renewal. The login cookie is a fixed 12 hours and was never
  // refreshed, so a staff member who logged in yesterday morning is silently
  // logged out mid-shift today — their calendar stops updating and, until the
  // page started saying so, looked fine.
  //
  // This endpoint is called on mount and whenever the tab regains focus, so
  // renewal here means "12 hours from the last time a human came back to it".
  // A device nobody touches still expires on schedule, which is the point of
  // the window: it gates how long customer names stay on that screen.
  //
  // The token is rebuilt from the freshly re-read account row, so a transfer or
  // role change carries into the renewed cookie rather than being pinned to
  // whatever was true at login.
  response.cookies.set({
    name: getCheckoutSessionCookieName(),
    value: await createSessionToken(session),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
  return response
}

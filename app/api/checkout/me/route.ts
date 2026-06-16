import { NextRequest, NextResponse } from 'next/server'
import { getCheckoutSession } from '@/lib/checkoutAuth'

export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    accountId: session.accountId,
    role: session.role,
    branchId: session.branchId,
    stylistId: session.stylistId,
    displayName: session.displayName,
    username: session.username,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession } from '@/lib/checkoutAuth'
import { logOrderEvent } from '@/lib/orderEditLog'

export const runtime = 'nodejs'

// POST /api/checkout/bookings/[id]/cancel
// Store manager (own store only) or owner cancels an appointment.
// Logged into order_edit_logs so it's visible in the Owner's 修改記錄.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role === 'stylist') {
    return NextResponse.json({ error: '僅店長或老闆可取消預約' }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const { data: booking } = await admin
    .from('bookings')
    .select('id, branch_id, date, start_time, status')
    .eq('id', params.id)
    .maybeSingle()
  if (!booking) return NextResponse.json({ error: '找不到該預約' }, { status: 404 })

  // Managers may only cancel appointments at their own store.
  if (session.role === 'manager' && booking.branch_id !== session.branchId) {
    return NextResponse.json({ error: '無法取消其他分店的預約' }, { status: 403 })
  }
  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: '此預約已取消' }, { status: 409 })
  }

  const body = await request.json().catch(() => ({}))
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null

  const { error } = await admin
    .from('bookings')
    .update({ status: 'cancelled', cancel_reason: reason })
    .eq('id', booking.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Do not put customer identity in the log (PII stays out of the audit feed).
  await logOrderEvent(admin, {
    orderId: null,
    orderIdText: booking.id,
    branchId: booking.branch_id,
    actor: session,
    action: 'cancel_appointment',
    reason: reason || `取消 ${booking.date} ${booking.start_time} 預約`,
  })

  return NextResponse.json({ success: true })
}

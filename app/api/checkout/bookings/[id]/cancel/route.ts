import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession } from '@/lib/checkoutAuth'
import { logOrderEvent } from '@/lib/orderEditLog'
import { getBranchLineConfig } from '@/lib/lineConfig'
import { generateCancellationMessage } from '@/lib/bookingUtils'

export const runtime = 'nodejs'

async function sendLinePushMessage(userId: string, message: string, accessToken: string): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: message }],
    }),
  })

  if (!response.ok) {
    throw new Error(`LINE push failed with status ${response.status}`)
  }
}

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
    .select('id, branch_id, date, start_time, status, line_id, branches(name)')
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

  // NOTE: the bookings table has no cancel_reason column — the reason is kept in
  // the audit log below (visible to the owner), not on the booking row.
  const { error } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', booking.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (booking.line_id) {
    try {
      const branchName = (booking.branches as { name?: string } | null)?.name || '小尾巴美甲'
      const message = generateCancellationMessage({
        branchName,
        date: booking.date,
        startTime: booking.start_time,
      })
      const lineConfig = getBranchLineConfig(booking.branch_id)
      if (lineConfig) {
        await sendLinePushMessage(booking.line_id, message, lineConfig.channelAccessToken)
      } else {
        console.warn(`No LINE config for branch ${booking.branch_id} — cancellation message not sent`)
      }
    } catch (lineError) {
      console.warn('Failed to send cancellation LINE message:', lineError)
    }
  }

  // PII-free signal so every open calendar gets a websocket push and re-fetches
  // through the redacting API. Never blocks the cancellation itself.
  try {
    await admin.from('booking_events').insert({
      booking_id: booking.id,
      branch_id: booking.branch_id,
      action: 'cancelled',
    })
  } catch (err) {
    console.warn('booking_events insert failed (realtime push skipped)', err)
  }

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

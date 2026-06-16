import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession } from '@/lib/checkoutAuth'
import { fetchOrderWithItems } from '@/lib/checkoutOrders'
import { logOrderEvent } from '@/lib/orderEditLog'

export const runtime = 'nodejs'

// POST /api/checkout/orders/[id]/confirm
// Manager (own store) or owner confirms at end of day: submitted -> confirmed (LOCKED).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const order = await fetchOrderWithItems(admin, params.id)
  if (!order) return NextResponse.json({ error: '找不到訂單' }, { status: 404 })

  const allowed =
    session.role === 'owner' ||
    (session.role === 'manager' && session.branchId === order.branch_id_snapshot)
  if (!allowed) {
    return NextResponse.json({ error: '僅店長或老闆可確認訂單' }, { status: 403 })
  }

  if (order.status === 'confirmed') {
    return NextResponse.json({ error: '此訂單已確認' }, { status: 409 })
  }
  if (order.status !== 'submitted') {
    return NextResponse.json({ error: '訂單尚未送出，無法確認' }, { status: 409 })
  }

  const { data: updated, error } = await admin
    .from('checkout_orders')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_by: session.accountId === 'owner-bootstrap' ? null : session.accountId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logOrderEvent(admin, {
    orderId: order.id,
    branchId: order.branch_id_snapshot,
    actor: session,
    action: 'confirm',
  })

  return NextResponse.json(updated)
}

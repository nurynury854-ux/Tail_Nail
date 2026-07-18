import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession } from '@/lib/checkoutAuth'
import { fetchOrderWithItems } from '@/lib/checkoutOrders'
import { logOrderEvent } from '@/lib/orderEditLog'

export const runtime = 'nodejs'

// POST /api/checkout/orders/[id]/submit
// Stylist ticks the confirmation box and submits: draft -> submitted.
// After this the stylist can no longer edit (only manager/owner can).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const order = await fetchOrderWithItems(admin, params.id)
  if (!order) return NextResponse.json({ error: '找不到訂單' }, { status: 404 })

  // Owner/manager of the store, or the owning stylist, may submit.
  const isOwnerOrManager =
    session.role === 'owner' ||
    (session.role === 'manager' && session.branchId === order.branch_id_snapshot)
  const isOwningStylist =
    session.role === 'stylist' &&
    (order.stylist_id_snapshot === session.stylistId ||
      order.account_id_snapshot === session.accountId)
  if (!isOwnerOrManager && !isOwningStylist) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (order.status !== 'draft') {
    return NextResponse.json({ error: '此訂單已送出' }, { status: 409 })
  }

  const body = await request.json().catch(() => ({}))
  if (!body.confirmed) {
    return NextResponse.json({ error: '請先勾選確認方框' }, { status: 400 })
  }

  // Payment method is required to finalize an order (feeds 現金/匯款 breakdown).
  if (order.payment_method !== 'cash' && order.payment_method !== 'transfer') {
    return NextResponse.json({ error: '請先選擇付款方式（現金／匯款）' }, { status: 400 })
  }

  const { data: updated, error } = await admin
    .from('checkout_orders')
    .update({
      status: 'submitted',
      stylist_confirmed: true,
      submitted_at: new Date().toISOString(),
      submitted_by: session.accountId === 'owner-bootstrap' ? null : session.accountId,
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
    action: 'submit',
  })

  return NextResponse.json(updated)
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { canEditOrder, getCheckoutSession } from '@/lib/checkoutAuth'
import { computeOrderTotals } from '@/lib/checkoutCalc'
import { fetchOrderWithItems, normalizeItems, replaceOrderItems } from '@/lib/checkoutOrders'
import { diffOrder, logOrderEvent } from '@/lib/orderEditLog'
import { OrderItemInput, PaymentMethod } from '@/lib/checkoutTypes'

export const runtime = 'nodejs'

// GET /api/checkout/orders/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const order = await fetchOrderWithItems(admin, params.id)
  if (!order) return NextResponse.json({ error: '找不到訂單' }, { status: 404 })

  // Scope check.
  if (session.role === 'stylist' && order.stylist_id_snapshot !== session.stylistId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (session.role === 'manager' && order.branch_id_snapshot !== session.branchId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  return NextResponse.json(order)
}

// PATCH /api/checkout/orders/[id] — gated by the edit-permission matrix.
// A blocked attempt is rejected AND logged so the owner can see it.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const before = await fetchOrderWithItems(admin, params.id)
  if (!before) return NextResponse.json({ error: '找不到訂單' }, { status: 404 })

  if (!canEditOrder(session, before)) {
    await logOrderEvent(admin, {
      orderId: before.id,
      branchId: before.branch_id_snapshot,
      actor: session,
      action: 'blocked_edit_attempt',
    })
    return NextResponse.json({ error: '此訂單已鎖定，無法編輯' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.customer_name === 'string') update.customer_name = body.customer_name.trim() || null
  if (typeof body.customer_phone === 'string') update.customer_phone = body.customer_phone.trim() || null
  if ('payment_method' in body) update.payment_method = (body.payment_method as PaymentMethod) || null

  // If items are supplied, replace them and recompute money.
  let newItems = before.items || []
  if (Array.isArray(body.items)) {
    const normalized = normalizeItems(body.items as OrderItemInput[])
    if (!normalized.length) {
      return NextResponse.json({ error: '請至少保留一個項目' }, { status: 400 })
    }
    const totals = computeOrderTotals(normalized, before.income_rate)
    update.gross_amount = totals.gross
    update.discount_total = totals.discountTotal
    update.revenue = totals.revenue
    update.stylist_income = totals.stylistIncome
    await replaceOrderItems(admin, before.id, normalized)
    newItems = normalized.map((it, i) => ({ id: `tmp-${i}`, order_id: before.id, ...it }))
  }

  const { data: after, error } = await admin
    .from('checkout_orders')
    .update(update)
    .eq('id', before.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const changes = diffOrder(before, after)
  await logOrderEvent(admin, {
    orderId: before.id,
    branchId: before.branch_id_snapshot,
    actor: session,
    action: 'edit',
    fieldChanges: changes,
  })

  return NextResponse.json({ ...after, items: newItems })
}

// DELETE /api/checkout/orders/[id] — same matrix as edit.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const before = await fetchOrderWithItems(admin, params.id)
  if (!before) return NextResponse.json({ error: '找不到訂單' }, { status: 404 })

  if (!canEditOrder(session, before)) {
    await logOrderEvent(admin, {
      orderId: before.id,
      branchId: before.branch_id_snapshot,
      actor: session,
      action: 'blocked_edit_attempt',
    })
    return NextResponse.json({ error: '此訂單已鎖定，無法刪除' }, { status: 403 })
  }

  // Log first (order_id will be set null by FK after deletion).
  await logOrderEvent(admin, {
    orderId: before.id,
    branchId: before.branch_id_snapshot,
    actor: session,
    action: 'delete',
  })
  const { error } = await admin.from('checkout_orders').delete().eq('id', before.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { canEditOrder, getCheckoutSession } from '@/lib/checkoutAuth'
import { computeOrderTotals } from '@/lib/checkoutCalc'
import { fetchOrderWithItems, replaceOrderItems } from '@/lib/checkoutOrders'
import { buildOrderItems, fetchPriceCatalog, PricedItemInput } from '@/lib/checkoutPricing.server'
import { diffOrder, logOrderEvent } from '@/lib/orderEditLog'
import { customerVisibility, orderServiceEnd, redactOrder } from '@/lib/checkoutPrivacy'
import { PaymentMethod } from '@/lib/checkoutTypes'

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

  return NextResponse.json(redactOrder(order, session.role))
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

  // Only let the editor touch identity fields they can currently see — otherwise
  // a redacted (null) form value would wipe PII the owner/manager still needs.
  const vis = customerVisibility(session.role, orderServiceEnd(before), before.business_date ?? null)
  if (vis.name && typeof body.customer_name === 'string') update.customer_name = body.customer_name.trim() || null
  if (vis.phone && typeof body.customer_phone === 'string') update.customer_phone = body.customer_phone.trim() || null
  if ('payment_method' in body) update.payment_method = (body.payment_method as PaymentMethod) || null

  // Order-level discounts (壽星 / 好評) — recompute money when items or discounts change.
  const reviewDiscount = 'review_discount' in body ? Boolean(body.review_discount) : Boolean(before.review_discount)
  const birthdayDiscount = 'birthday_discount' in body ? Boolean(body.birthday_discount) : Boolean(before.birthday_discount)
  const discountsChanged =
    reviewDiscount !== Boolean(before.review_discount) || birthdayDiscount !== Boolean(before.birthday_discount)
  if ('review_discount' in body) update.review_discount = reviewDiscount
  if ('birthday_discount' in body) update.birthday_discount = birthdayDiscount

  // If items are supplied, replace them (prices resolved server-side so a tech
  // can't override fixed prices). Recompute totals from items + discounts.
  let newItems: object[] = before.items || []
  let itemsForTotals: Array<{ unit_price: number; quantity: number; discount: number }> = (before.items || []).map(
    (it) => ({ unit_price: it.unit_price, quantity: it.quantity, discount: it.discount }),
  )
  if (Array.isArray(body.items)) {
    const catalog = await fetchPriceCatalog(admin)
    const normalized = buildOrderItems(catalog, body.items as PricedItemInput[])
    if (!normalized.length) {
      return NextResponse.json({ error: '請至少保留一個項目' }, { status: 400 })
    }
    await replaceOrderItems(admin, before.id, normalized)
    newItems = normalized.map((it, i) => ({ id: `tmp-${i}`, order_id: before.id, ...it }))
    itemsForTotals = normalized
  }
  if (Array.isArray(body.items) || discountsChanged) {
    const totals = computeOrderTotals(itemsForTotals, before.income_rate, {
      review: reviewDiscount,
      birthday: birthdayDiscount,
    })
    update.gross_amount = totals.gross
    update.discount_total = totals.discountTotal
    update.revenue = totals.revenue
    update.stylist_income = totals.stylistIncome
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

  return NextResponse.json({ ...redactOrder(after, session.role), items: newItems })
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

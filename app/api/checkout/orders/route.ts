import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession } from '@/lib/checkoutAuth'
import { computeOrderTotals } from '@/lib/checkoutCalc'
import { normalizeItems, replaceOrderItems } from '@/lib/checkoutOrders'
import { logOrderEvent } from '@/lib/orderEditLog'
import { DEFAULT_INCOME_RATE, OrderItemInput, PaymentMethod } from '@/lib/checkoutTypes'

export const runtime = 'nodejs'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// GET /api/checkout/orders — scoped list.
//   stylist  -> own orders        manager -> own store        owner -> all
// Optional query: ?date=YYYY-MM-DD  ?month=YYYY-MM  ?status=
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const url = new URL(request.url)
  const date = url.searchParams.get('date')
  const month = url.searchParams.get('month')
  const status = url.searchParams.get('status')

  let query = admin.from('checkout_orders').select('*')

  // Scope by role using SNAPSHOT columns (never the live stylists row).
  if (session.role === 'stylist') {
    query = query.eq('stylist_id_snapshot', session.stylistId)
  } else if (session.role === 'manager') {
    query = query.eq('branch_id_snapshot', session.branchId)
  }

  if (date) query = query.eq('business_date', date)
  if (month) query = query.gte('business_date', `${month}-01`).lte('business_date', `${month}-31`)
  if (status) query = query.eq('status', status)

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach line items in one extra round-trip.
  const orders = data || []
  const ids = orders.map((o) => o.id)
  const itemsByOrder: Record<string, unknown[]> = {}
  if (ids.length) {
    const { data: items } = await admin
      .from('checkout_order_items')
      .select('*')
      .in('order_id', ids)
    for (const it of items || []) {
      ;(itemsByOrder[it.order_id] ||= []).push(it)
    }
  }

  return NextResponse.json(orders.map((o) => ({ ...o, items: itemsByOrder[o.id] || [] })))
}

// POST /api/checkout/orders — create an order (manual walk-in or calendar import).
export async function POST(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Owner oversees; orders are created by the technician/manager doing checkout.
  if (!session.branchId || !session.stylistId) {
    return NextResponse.json({ error: '此帳號未綁定分店／美甲師，無法建立訂單' }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const source = body.source === 'calendar' ? 'calendar' : 'manual'
  const bookingId = body.booking_id ? String(body.booking_id) : null
  const paymentMethod = (body.payment_method as PaymentMethod) || null
  const businessDate = typeof body.business_date === 'string' ? body.business_date : today()

  let customerName = typeof body.customer_name === 'string' ? body.customer_name.trim() : ''
  let customerPhone = typeof body.customer_phone === 'string' ? body.customer_phone.trim() : ''
  let itemInputs: OrderItemInput[] = Array.isArray(body.items) ? body.items : []

  // Calendar import: pull customer + services straight from the booking.
  if (source === 'calendar' && bookingId) {
    const { data: booking } = await admin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle()
    if (!booking) return NextResponse.json({ error: '找不到該預約' }, { status: 404 })

    customerName = customerName || booking.customer_name || ''
    customerPhone = customerPhone || booking.phone || ''

    const selected = Array.isArray(booking.selected_services) ? booking.selected_services : []
    // selected_services carries no price; look prices up from the services catalog.
    const serviceIds = selected.map((s: { service_id: string }) => s.service_id).filter(Boolean)
    const priceById: Record<string, { name: string; price: number }> = {}
    if (serviceIds.length) {
      const { data: services } = await admin
        .from('services')
        .select('id, name, price')
        .in('id', serviceIds)
      for (const s of services || []) priceById[s.id] = { name: s.name, price: s.price ?? 0 }
    }
    itemInputs = selected.map((s: { service_id: string; service_name?: string }) => ({
      service_id: s.service_id,
      service_name: priceById[s.service_id]?.name || s.service_name || s.service_id,
      unit_price: priceById[s.service_id]?.price ?? 0,
      quantity: 1,
    }))
  }

  const items = normalizeItems(itemInputs)
  if (!items.length) {
    return NextResponse.json({ error: '請至少新增一個項目' }, { status: 400 })
  }

  const totals = computeOrderTotals(items, DEFAULT_INCOME_RATE)

  // Resolve snapshot names (frozen onto the order forever).
  const { data: branch } = await admin
    .from('branches')
    .select('name')
    .eq('id', session.branchId)
    .maybeSingle()

  const { data: order, error } = await admin
    .from('checkout_orders')
    .insert({
      branch_id_snapshot: session.branchId,
      branch_name_snapshot: branch?.name || session.branchId,
      stylist_id_snapshot: session.stylistId,
      stylist_name_snapshot: session.displayName,
      account_id_snapshot: session.accountId === 'owner-bootstrap' ? null : session.accountId,
      booking_id: bookingId,
      source,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      gross_amount: totals.gross,
      discount_total: totals.discountTotal,
      revenue: totals.revenue,
      stylist_income: totals.stylistIncome,
      income_rate: DEFAULT_INCOME_RATE,
      payment_method: paymentMethod,
      status: 'draft',
      business_date: businessDate,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await replaceOrderItems(admin, order.id, items)
  await logOrderEvent(admin, {
    orderId: order.id,
    branchId: order.branch_id_snapshot,
    actor: session,
    action: 'create',
  })

  return NextResponse.json({ ...order, items }, { status: 201 })
}

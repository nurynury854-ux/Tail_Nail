import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession } from '@/lib/checkoutAuth'
import { computeOrderTotals } from '@/lib/checkoutCalc'
import { replaceOrderItems } from '@/lib/checkoutOrders'
import { buildOrderItems, fetchPriceCatalog, PricedItemInput } from '@/lib/checkoutPricing.server'
import { logOrderEvent } from '@/lib/orderEditLog'
import { computeServiceEndAt, redactOrder } from '@/lib/checkoutPrivacy'
import { monthRange } from '@/lib/monthRange'
import { DEFAULT_INCOME_RATE, PaymentMethod } from '@/lib/checkoutTypes'

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
  if (month) {
    const { start, endExclusive } = monthRange(month)
    query = query.gte('business_date', start).lt('business_date', endExclusive)
  }
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

  // Redact customer identity per the requesting role + timers.
  return NextResponse.json(
    orders.map((o) => ({ ...redactOrder(o, session.role), items: itemsByOrder[o.id] || [] })),
  )
}

// POST /api/checkout/orders — create an order (manual walk-in or calendar import).
export async function POST(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const source = body.source === 'calendar' ? 'calendar' : 'manual'
  const bookingId = body.booking_id ? String(body.booking_id) : null
  const paymentMethod = (body.payment_method as PaymentMethod) || null
  const businessDate = typeof body.business_date === 'string' ? body.business_date : today()
  const reviewDiscount = Boolean(body.review_discount)
  const birthdayDiscount = Boolean(body.birthday_discount)

  let customerName = typeof body.customer_name === 'string' ? body.customer_name.trim() : ''
  let customerPhone = typeof body.customer_phone === 'string' ? body.customer_phone.trim() : ''
  let itemInputs: PricedItemInput[] = Array.isArray(body.items) ? body.items : []
  let bookingDate: string | null = null
  let bookingEndTime: string | null = null

  // The order is credited to a stylist/branch. For a manual walk-in that's the
  // technician entering it; for a calendar import it's the booking's stylist
  // (so a manager/owner importing on someone's behalf credits the right person).
  let creditBranchId: string | null = null
  let creditStylistId: string | null = null
  let creditStylistName = ''
  if (source === 'manual') {
    if (!session.branchId || !session.stylistId) {
      return NextResponse.json({ error: '此帳號未綁定分店／美甲師，無法手動結帳' }, { status: 400 })
    }
    creditBranchId = session.branchId
    creditStylistId = session.stylistId
    creditStylistName = session.displayName
  }

  const catalog = await fetchPriceCatalog(admin)
  // Map a booking service_id -> price catalog key for calendar import.
  const keyByBookingService = new Map<string, string>()
  for (const item of Array.from(catalog.values())) {
    if (item.booking_service_id) keyByBookingService.set(item.booking_service_id, item.key)
  }

  // Calendar import: pull customer + services straight from the booking.
  if (source === 'calendar' && bookingId) {
    const { data: booking } = await admin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle()
    if (!booking) return NextResponse.json({ error: '找不到該預約' }, { status: 404 })
    if (booking.status === 'cancelled') {
      return NextResponse.json({ error: '此預約已取消，無法匯入' }, { status: 400 })
    }

    customerName = customerName || booking.customer_name || ''
    customerPhone = customerPhone || booking.phone || ''
    bookingDate = booking.date || null
    bookingEndTime = booking.end_time || null

    // Importer may only import bookings they're allowed to see.
    if (session.role === 'stylist' && booking.stylist_id !== session.stylistId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    if (session.role === 'manager' && booking.branch_id !== session.branchId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // Credit the booking's stylist/branch, not the importer.
    creditBranchId = booking.branch_id || session.branchId
    creditStylistId = booking.stylist_id || session.stylistId
    if (!creditBranchId || !creditStylistId) {
      return NextResponse.json({ error: '此預約未指定美甲師，無法匯入' }, { status: 400 })
    }
    if (creditStylistId === session.stylistId) {
      creditStylistName = session.displayName
    } else {
      const { data: st } = await admin.from('stylists').select('name').eq('id', creditStylistId).maybeSingle()
      creditStylistName = st?.name || creditStylistId
    }

    const selected = Array.isArray(booking.selected_services) ? booking.selected_services : []
    // Map each booked service to a catalog item by category. Fixed-price items
    // resolve immediately; tier/per-unit/manual items import at 0 for the tech
    // to complete (a booking doesn't record the tier or finger count).
    itemInputs = selected
      .map((s: { service_id: string; category?: 'hand' | 'foot' }) => {
        const key = s.service_id ? keyByBookingService.get(s.service_id) : undefined
        if (!key) return null
        return {
          price_key: key,
          category: (s.category as 'hand' | 'foot') || (booking.category as 'hand' | 'foot') || 'hand',
        } as PricedItemInput
      })
      .filter(Boolean) as PricedItemInput[]
  }

  const items = buildOrderItems(catalog, itemInputs)
  if (!items.length) {
    return NextResponse.json({ error: '請至少新增一個項目' }, { status: 400 })
  }

  const totals = computeOrderTotals(items, DEFAULT_INCOME_RATE, {
    review: reviewDiscount,
    birthday: birthdayDiscount,
  })

  // Resolve snapshot names (frozen onto the order forever).
  const { data: branch } = await admin
    .from('branches')
    .select('name')
    .eq('id', creditBranchId!)
    .maybeSingle()

  const { data: order, error } = await admin
    .from('checkout_orders')
    .insert({
      branch_id_snapshot: creditBranchId,
      branch_name_snapshot: branch?.name || creditBranchId,
      stylist_id_snapshot: creditStylistId,
      stylist_name_snapshot: creditStylistName,
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
      review_discount: reviewDiscount,
      birthday_discount: birthdayDiscount,
      status: 'draft',
      business_date: businessDate,
      service_end_at: computeServiceEndAt({ source, businessDate, bookingDate, bookingEndTime }),
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

  return NextResponse.json({ ...redactOrder(order, session.role), items }, { status: 201 })
}

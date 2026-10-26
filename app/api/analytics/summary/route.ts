import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase'
import { checkAnalyticsAuth } from '@/lib/analyticsAuth'
import { monthRange } from '@/lib/monthRange'
import { nextTaipeiDate, taipeiBusinessMonth, taipeiToday } from '@/lib/dateTW'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD   (both inclusive)
// Read-only business summary for the owner's AI analysis. Bearer ANALYTICS_API_KEY.
// Defaults to the current business month. Max range 366 days.
// Never returns customer names, phone numbers or LINE ids — customers are only
// counted (new vs returning, keyed by phone number server-side).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DAYS = 366
const PAGE = 1000 // PostgREST caps a single select at 1000 rows
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type Sum = { orders: number; revenue: number }

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

function weekday(date: string): string {
  return WEEKDAYS[new Date(`${date}T12:00:00+08:00`).getUTCDay()]
}

function normPhone(p: string | null | undefined): string | null {
  const digits = (p || '').replace(/\D/g, '')
  return digits.length >= 8 ? digits.slice(-9) : null
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

// Pages through a query so ranges over 1000 rows aren't silently truncated.
async function fetchAll<T>(build: () => any): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...((data || []) as T[]))
    if (!data || data.length < PAGE) return out
  }
}

function bump<K>(map: Map<K, Sum>, key: K, revenue: number) {
  const s = map.get(key) || { orders: 0, revenue: 0 }
  s.orders += 1
  s.revenue += revenue
  map.set(key, s)
}

async function loadSummary(admin: SupabaseClient, from: string, to: string) {
  const toExclusive = nextTaipeiDate(to)

  const [orders, bookings, adjustments, branches] = await Promise.all([
    fetchAll<any>(() =>
      admin
        .from('checkout_orders')
        .select(
          'id, status, branch_id_snapshot, branch_name_snapshot, stylist_id_snapshot, stylist_name_snapshot, customer_phone, gross_amount, discount_total, revenue, stylist_income, payment_method, business_date, source, review_discount, birthday_discount',
        )
        .gte('business_date', from)
        .lt('business_date', toExclusive)
        .order('id'),
    ),
    fetchAll<any>(() =>
      admin
        .from('bookings')
        .select('id, branch_id, stylist_id, category, total_duration, date, start_time, status, created_at')
        .gte('date', from)
        .lt('date', toExclusive)
        .order('id'),
    ),
    fetchAll<any>(() =>
      admin
        .from('actual_amount_adjustments')
        .select('branch_id_snapshot, business_date, difference')
        .gte('business_date', from)
        .lt('business_date', toExclusive)
        .order('id'),
    ),
    admin.from('branches').select('id, name').then(({ data }) => data || []),
  ])

  const branchName = new Map<string, string>(branches.map((b: any) => [b.id, b.name]))
  const confirmed = orders.filter((o) => o.status === 'confirmed')
  const pending = orders.filter((o) => o.status !== 'confirmed')

  // ── Revenue (confirmed orders only, matching the in-app 報表) ──────────
  let revenue = 0, gross = 0, discount = 0, income = 0
  const payment = { cash: 0, transfer: 0, unset: 0 }
  const byDay = new Map<string, Sum>()
  const byWeekday = new Map<string, Sum>()
  const byBranch = new Map<string, Sum & { branch_name: string; income: number }>()
  const byStylist = new Map<string, Sum & { stylist_name: string; branch_name: string; income: number }>()
  const bySource = new Map<string, Sum>()
  let reviewDiscountOrders = 0, birthdayDiscountOrders = 0

  for (const o of confirmed) {
    const r = o.revenue || 0
    revenue += r
    gross += o.gross_amount || 0
    discount += o.discount_total || 0
    income += o.stylist_income || 0
    if (o.payment_method === 'cash') payment.cash += r
    else if (o.payment_method === 'transfer') payment.transfer += r
    else payment.unset += r
    if (o.review_discount) reviewDiscountOrders += 1
    if (o.birthday_discount) birthdayDiscountOrders += 1

    bump(byDay, o.business_date, r)
    bump(byWeekday, weekday(o.business_date), r)
    bump(bySource, o.source, r)

    const b = byBranch.get(o.branch_id_snapshot) || { branch_name: o.branch_name_snapshot, orders: 0, revenue: 0, income: 0 }
    b.orders += 1
    b.revenue += r
    b.income += o.stylist_income || 0
    byBranch.set(o.branch_id_snapshot, b)

    const sKey = `${o.branch_id_snapshot}::${o.stylist_id_snapshot ?? o.stylist_name_snapshot}`
    const s = byStylist.get(sKey) || { stylist_name: o.stylist_name_snapshot, branch_name: o.branch_name_snapshot, orders: 0, revenue: 0, income: 0 }
    s.orders += 1
    s.revenue += r
    s.income += o.stylist_income || 0
    byStylist.set(sKey, s)
  }

  // ── Services (line items of confirmed orders) ─────────────────────────
  const confirmedIds = confirmed.map((o) => o.id)
  const items: any[] = []
  for (let i = 0; i < confirmedIds.length; i += 200) {
    const chunk = confirmedIds.slice(i, i + 200)
    items.push(
      ...(await fetchAll<any>(() =>
        admin
          .from('checkout_order_items')
          .select('service_name_snapshot, quantity, discount, line_total')
          .in('order_id', chunk)
          .order('id'),
      )),
    )
  }
  const byService = new Map<string, { quantity: number; revenue: number; discount: number }>()
  for (const it of items) {
    const s = byService.get(it.service_name_snapshot) || { quantity: 0, revenue: 0, discount: 0 }
    s.quantity += it.quantity || 0
    s.revenue += it.line_total || 0
    s.discount += it.discount || 0
    byService.set(it.service_name_snapshot, s)
  }

  // ── Customers: new vs returning, keyed by phone (never returned) ───────
  const phonesInRange = new Set<string>()
  const visitsByPhone = new Map<string, number>()
  let ordersWithPhone = 0
  for (const o of confirmed) {
    const p = normPhone(o.customer_phone)
    if (!p) continue
    ordersWithPhone += 1
    phonesInRange.add(p)
    visitsByPhone.set(p, (visitsByPhone.get(p) || 0) + 1)
  }
  const earlier = await fetchAll<any>(() =>
    admin
      .from('checkout_orders')
      .select('customer_phone')
      .eq('status', 'confirmed')
      .lt('business_date', from)
      .not('customer_phone', 'is', null)
      .order('id'),
  )
  const seenBefore = new Set(earlier.map((o) => normPhone(o.customer_phone)).filter(Boolean) as string[])
  let returning = 0
  phonesInRange.forEach((p) => { if (seenBefore.has(p)) returning += 1 })
  let repeatWithinRange = 0
  visitsByPhone.forEach((n) => { if (n > 1) repeatWithinRange += 1 })

  // ── Bookings (online appointments) ────────────────────────────────────
  const bookingStatus = { confirmed: 0, completed: 0, cancelled: 0 } as Record<string, number>
  const bookingsByBranch = new Map<string, { branch_name: string; total: number; cancelled: number }>()
  const bookingsByHour = new Map<string, number>()
  const bookingsByWeekday = new Map<string, number>()
  const bookingsByCategory = { hand: 0, foot: 0, unspecified: 0 }
  let leadDaysTotal = 0, leadCount = 0, noPreference = 0, durationTotal = 0

  for (const bk of bookings) {
    bookingStatus[bk.status] = (bookingStatus[bk.status] || 0) + 1
    const b = bookingsByBranch.get(bk.branch_id) || { branch_name: branchName.get(bk.branch_id) || bk.branch_id, total: 0, cancelled: 0 }
    b.total += 1
    if (bk.status === 'cancelled') b.cancelled += 1
    bookingsByBranch.set(bk.branch_id, b)
    if (bk.status === 'cancelled') continue

    const hour = String(bk.start_time || '').slice(0, 2) + ':00'
    bookingsByHour.set(hour, (bookingsByHour.get(hour) || 0) + 1)
    bookingsByWeekday.set(weekday(bk.date), (bookingsByWeekday.get(weekday(bk.date)) || 0) + 1)
    if (bk.category === 'hand') bookingsByCategory.hand += 1
    else if (bk.category === 'foot') bookingsByCategory.foot += 1
    else bookingsByCategory.unspecified += 1
    if (!bk.stylist_id) noPreference += 1
    durationTotal += bk.total_duration || 0
    if (bk.created_at) {
      leadDaysTotal += Math.max(0, dayDiff(taipeiToday(new Date(bk.created_at)), bk.date))
      leadCount += 1
    }
  }
  const activeBookings = bookings.length - (bookingStatus.cancelled || 0)

  // ── Till reconciliation (actual cash register vs system) ──────────────
  const recon = new Map<string, { branch_name: string; days: number; difference: number }>()
  for (const a of adjustments) {
    const r = recon.get(a.branch_id_snapshot) || { branch_name: branchName.get(a.branch_id_snapshot) || a.branch_id_snapshot, days: 0, difference: 0 }
    r.days += 1
    r.difference += a.difference || 0
    recon.set(a.branch_id_snapshot, r)
  }

  const sumRows = <T extends Sum>(m: Map<string, T>, keyName: string) =>
    Array.from(m.entries()).map(([k, v]) => ({ [keyName]: k, ...v, avgTicket: v.orders ? Math.round(v.revenue / v.orders) : 0 }))

  return {
    currency: 'TWD',
    range: { from, to, days: dayDiff(from, to) + 1 },
    notes: [
      'All money is in New Taiwan Dollars (TWD), integers.',
      'Revenue counts only orders the store manager has CONFIRMED (same as the in-app report). Draft/submitted orders are shown separately under pendingOrders.',
      'Dates are salon business days: a business day runs 04:00 to 03:59 the next morning, Asia/Taipei.',
      'revenue = gross - discounts. stylistIncome is the technician share (業績), part of revenue, not extra.',
      'Customers are identified only by phone number, server-side; orders without a phone are not counted in customers.',
      'bookings are online appointments made through the booking site; walk-ins only appear as orders (source=manual).',
    ],
    totals: {
      revenue,
      grossBeforeDiscount: gross,
      discounts: discount,
      stylistIncome: income,
      orders: confirmed.length,
      avgTicket: confirmed.length ? Math.round(revenue / confirmed.length) : 0,
      avgRevenuePerDay: Math.round(revenue / (dayDiff(from, to) + 1)),
    },
    pendingOrders: {
      count: pending.length,
      revenue: pending.reduce((n, o) => n + (o.revenue || 0), 0),
    },
    paymentMethods: payment,
    discountUsage: { reviewDiscountOrders, birthdayDiscountOrders },
    orderSource: sumRows(bySource, 'source'),
    customers: {
      ordersWithPhone,
      uniqueCustomers: phonesInRange.size,
      newCustomers: phonesInRange.size - returning,
      returningCustomers: returning,
      customersWithMultipleVisitsInRange: repeatWithinRange,
    },
    byBranch: Array.from(byBranch.entries())
      .map(([branch_id, v]) => ({ branch_id, ...v, avgTicket: v.orders ? Math.round(v.revenue / v.orders) : 0 }))
      .sort((a, b) => b.revenue - a.revenue),
    byStylist: Array.from(byStylist.values())
      .map((v) => ({ ...v, avgTicket: v.orders ? Math.round(v.revenue / v.orders) : 0 }))
      .sort((a, b) => b.revenue - a.revenue),
    byService: Array.from(byService.entries())
      .map(([service, v]) => ({ service, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    byDay: sumRows(byDay, 'date').sort((a: any, b: any) => (a.date < b.date ? -1 : 1)),
    byWeekday: WEEKDAYS.map((d) => ({ weekday: d, ...(byWeekday.get(d) || { orders: 0, revenue: 0 }) })),
    bookings: {
      total: bookings.length,
      byStatus: bookingStatus,
      cancellationRate: bookings.length ? round(((bookingStatus.cancelled || 0) / bookings.length) * 100) : 0,
      noPreferenceTechnicianShare: activeBookings ? round((noPreference / activeBookings) * 100) : 0,
      avgLeadTimeDays: leadCount ? round(leadDaysTotal / leadCount) : 0,
      avgDurationMinutes: activeBookings ? Math.round(durationTotal / activeBookings) : 0,
      byCategory: bookingsByCategory,
      byBranch: Array.from(bookingsByBranch.entries())
        .map(([branch_id, v]) => ({ branch_id, ...v }))
        .sort((a, b) => b.total - a.total),
      byStartHour: Array.from(bookingsByHour.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => (a.hour < b.hour ? -1 : 1)),
      byWeekday: WEEKDAYS.map((d) => ({ weekday: d, count: bookingsByWeekday.get(d) || 0 })),
    },
    tillReconciliation: Array.from(recon.entries()).map(([branch_id, v]) => ({ branch_id, ...v })),
  }
}

export async function GET(request: NextRequest) {
  const denied = checkAnalyticsAuth(request)
  if (denied) return denied

  const url = new URL(request.url)
  const month = monthRange(taipeiBusinessMonth())
  const from = url.searchParams.get('from') || month.start
  const to = url.searchParams.get('to') || taipeiToday(new Date(Date.parse(`${month.endExclusive}T12:00:00+08:00`) - 86_400_000))

  if (!DATE_RE.test(from) || !DATE_RE.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return NextResponse.json({ error: 'from and to must be YYYY-MM-DD' }, { status: 400 })
  }
  if (from > to) return NextResponse.json({ error: 'from must be on or before to' }, { status: 400 })
  if (dayDiff(from, to) + 1 > MAX_DAYS) {
    return NextResponse.json({ error: `range too long (max ${MAX_DAYS} days); split it into smaller calls` }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  try {
    return NextResponse.json(await loadSummary(admin, from, to))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'query failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession } from '@/lib/checkoutAuth'
import { redactBooking } from '@/lib/checkoutPrivacy'
import { monthRange } from '@/lib/monthRange'

export const runtime = 'nodejs'

// GET /api/checkout/bookings?date=YYYY-MM-DD | ?month=YYYY-MM  [&branch_id=&stylist_id=]
// Calendar appointments. Role scoping is enforced regardless of params:
//   stylist -> own bookings   manager -> own branch (optional stylist filter)
//   owner   -> any (optional branch + stylist filter)
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const url = new URL(request.url)
  const date = url.searchParams.get('date')
  const month = url.searchParams.get('month')
  const branchId = url.searchParams.get('branch_id')
  const stylistId = url.searchParams.get('stylist_id')

  let query = admin
    .from('bookings')
    .select('id, branch_id, stylist_id, customer_name, phone, selected_services, category, date, start_time, end_time, total_duration, status')

  if (session.role === 'stylist') {
    // An unlinked stylist account has no stylist_id — querying eq(null) silently
    // returns nothing, which looks like "the calendar is broken". Say so instead.
    if (!session.stylistId) {
      return NextResponse.json(
        { error: '此帳號尚未連結美甲師，請聯絡老闆設定後才能看到行事曆' },
        { status: 409 },
      )
    }
    query = query.eq('stylist_id', session.stylistId)
  } else if (stylistId) {
    // Individual-stylist view (owner or manager looking at one person's full
    // schedule): scope by stylist_id ALONE. bookings.branch_id is a permanent
    // creation-time snapshot, not "this stylist's branch right now" — a
    // stylist who was transferred between branches keeps her pre-transfer
    // bookings stamped with the old branch forever. Also filtering on
    // branch_id here (as before) silently dropped those older appointments
    // from exactly the accounts that most need to see her full calendar,
    // even though her own stylist-role view (which only ever filters by
    // stylist_id) showed them fine — the two views disagreed permanently,
    // not just briefly.
    if (session.role === 'manager') {
      const { data: stylistRow } = await admin
        .from('stylists')
        .select('branch_id')
        .eq('id', stylistId)
        .maybeSingle()
      if (!stylistRow || stylistRow.branch_id !== session.branchId) {
        return NextResponse.json({ error: '無法查看其他分店的美甲師' }, { status: 403 })
      }
    }
    query = query.eq('stylist_id', stylistId)
  } else if (session.role === 'manager') {
    // 整店 (whole-branch) view: what's physically happening at this store,
    // so this one legitimately stays scoped by the booking's own branch_id.
    query = query.eq('branch_id', session.branchId)
  } else if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  if (month) {
    const { start, endExclusive } = monthRange(month)
    query = query.gte('date', start).lt('date', endExclusive)
  } else if (date) {
    query = query.eq('date', date)
  }

  // Cancelled appointments stay on everyone's calendar (greyed, non-importable).
  query = query
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
    .order('id', { ascending: true }) // deterministic tiebreak across pages

  // PostgREST caps a single response at 1000 rows. A busy month easily exceeds
  // that, and since rows come back date-ascending the tail of the month would be
  // silently dropped. Page through until a short batch comes back.
  const PAGE_SIZE = 1000
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const batch = data || []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }

  // Redact customer identity per the requesting role + timers.
  return NextResponse.json(rows.map((b) => redactBooking(b, session.role)))
}

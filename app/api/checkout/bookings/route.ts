import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession } from '@/lib/checkoutAuth'
import { redactBooking } from '@/lib/checkoutPrivacy'

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
    query = query.eq('stylist_id', session.stylistId)
  } else if (session.role === 'manager') {
    query = query.eq('branch_id', session.branchId)
    if (stylistId) query = query.eq('stylist_id', stylistId)
  } else {
    if (branchId) query = query.eq('branch_id', branchId)
    if (stylistId) query = query.eq('stylist_id', stylistId)
  }

  if (month) query = query.gte('date', `${month}-01`).lte('date', `${month}-31`)
  else if (date) query = query.eq('date', date)

  // Cancelled appointments stay on everyone's calendar (greyed, non-importable).
  query = query
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Redact customer identity per the requesting role + timers.
  return NextResponse.json((data || []).map((b) => redactBooking(b, session.role)))
}

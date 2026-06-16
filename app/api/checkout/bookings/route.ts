import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession } from '@/lib/checkoutAuth'

export const runtime = 'nodejs'

// GET /api/checkout/bookings?date=YYYY-MM-DD
// Calendar appointments available for import.
//   stylist -> own bookings    manager -> own store    owner -> all (optional ?branch_id)
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const url = new URL(request.url)
  const date = url.searchParams.get('date')
  const branchId = url.searchParams.get('branch_id')

  let query = admin
    .from('bookings')
    .select('id, branch_id, stylist_id, customer_name, phone, selected_services, category, date, start_time, end_time, status')

  if (session.role === 'stylist') {
    query = query.eq('stylist_id', session.stylistId)
  } else if (session.role === 'manager') {
    query = query.eq('branch_id', session.branchId)
  } else if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  if (date) query = query.eq('date', date)
  query = query.neq('status', 'cancelled').order('start_time', { ascending: true })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

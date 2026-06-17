import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession } from '@/lib/checkoutAuth'

export const runtime = 'nodejs'

// GET /api/checkout/reports?month=YYYY-MM  (or ?date=YYYY-MM-DD)
// Aggregates grouped by SNAPSHOT fields, so revenue stays with the original store.
//   manager -> own store        owner -> all stores
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role === 'stylist') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const url = new URL(request.url)
  const date = url.searchParams.get('date')
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7)

  let query = admin
    .from('checkout_orders')
    .select(
      'branch_id_snapshot, branch_name_snapshot, stylist_id_snapshot, stylist_name_snapshot, revenue, stylist_income, payment_method, business_date',
    )

  if (session.role === 'manager') query = query.eq('branch_id_snapshot', session.branchId)

  if (date) query = query.eq('business_date', date)
  else query = query.gte('business_date', `${month}-01`).lte('business_date', `${month}-31`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const orders = data || []

  const byStylist = new Map<string, { stylist_id: string | null; stylist_name: string; branch_id: string; branch_name: string; orderCount: number; revenue: number; income: number; bonus: number }>()
  const byBranch = new Map<string, { branch_id: string; branch_name: string; orderCount: number; revenue: number; income: number; bonus: number }>()
  const payment = { cash: 0, transfer: 0, unset: 0 }
  let totalRevenue = 0
  let totalIncome = 0

  for (const o of orders) {
    totalRevenue += o.revenue || 0
    totalIncome += o.stylist_income || 0

    const sKey = `${o.branch_id_snapshot}::${o.stylist_id_snapshot ?? o.stylist_name_snapshot}`
    const s = byStylist.get(sKey) || {
      stylist_id: o.stylist_id_snapshot ?? null,
      stylist_name: o.stylist_name_snapshot,
      branch_id: o.branch_id_snapshot,
      branch_name: o.branch_name_snapshot,
      orderCount: 0,
      revenue: 0,
      income: 0,
      bonus: 0,
    }
    s.orderCount += 1
    s.revenue += o.revenue || 0
    s.income += o.stylist_income || 0
    byStylist.set(sKey, s)

    const b = byBranch.get(o.branch_id_snapshot) || {
      branch_id: o.branch_id_snapshot,
      branch_name: o.branch_name_snapshot,
      orderCount: 0,
      revenue: 0,
      income: 0,
      bonus: 0,
    }
    b.orderCount += 1
    b.revenue += o.revenue || 0
    b.income += o.stylist_income || 0
    byBranch.set(o.branch_id_snapshot, b)

    if (o.payment_method === 'cash') payment.cash += o.revenue || 0
    else if (o.payment_method === 'transfer') payment.transfer += o.revenue || 0
    else payment.unset += o.revenue || 0
  }

  // Bonuses only apply to the monthly view (fixed = monthly; performance = period revenue).
  let totalBonus = 0
  if (!date) {
    const [{ data: fixed }, { data: perf }] = await Promise.all([
      admin.from('fixed_bonuses').select('*').eq('is_active', true),
      admin.from('performance_bonuses').select('*').eq('is_active', true),
    ])

    const stylistRows = Array.from(byStylist.values())
    const branchRows = Array.from(byBranch.values())

    // Fixed bonus: flat amount per stylist, every month.
    for (const fb of fixed || []) {
      for (const s of stylistRows) {
        if (s.stylist_id && s.stylist_id === fb.stylist_id_snapshot) s.bonus += fb.amount || 0
      }
    }
    // Performance bonus: paid once the period revenue threshold is hit.
    for (const pb of perf || []) {
      if (pb.scope === 'stylist') {
        for (const s of stylistRows) {
          if (s.stylist_id === pb.stylist_id_snapshot && s.revenue >= pb.revenue_threshold) {
            s.bonus += pb.bonus_amount || 0
          }
        }
      } else if (pb.scope === 'branch') {
        for (const b of branchRows) {
          if (b.branch_id === pb.branch_id_snapshot && b.revenue >= pb.revenue_threshold) {
            b.bonus += pb.bonus_amount || 0
          }
        }
      }
    }

    for (const s of stylistRows) totalBonus += s.bonus
  }

  return NextResponse.json({
    scope: session.role === 'manager' ? 'branch' : 'all',
    range: date ? { date } : { month },
    totals: { revenue: totalRevenue, income: totalIncome, orderCount: orders.length, bonus: totalBonus },
    payment,
    byStylist: Array.from(byStylist.values()).sort((a, b) => b.revenue - a.revenue),
    byBranch: Array.from(byBranch.values()).sort((a, b) => b.revenue - a.revenue),
  })
}

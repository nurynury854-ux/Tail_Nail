import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession } from '@/lib/checkoutAuth'

export const runtime = 'nodejs'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

async function systemTotal(
  admin: ReturnType<typeof createAdminClient>,
  branchId: string,
  date: string,
): Promise<number> {
  const { data } = await admin!
    .from('checkout_orders')
    .select('revenue')
    .eq('branch_id_snapshot', branchId)
    .eq('business_date', date)
  return (data || []).reduce((sum, o) => sum + (o.revenue || 0), 0)
}

// GET /api/checkout/reconcile?date= — system total + saved adjustments.
// Reconciliation (對帳) is a store-manager-only function.
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role !== 'manager') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const url = new URL(request.url)
  const date = url.searchParams.get('date') || today()
  const branchId = session.branchId
  if (!branchId) return NextResponse.json({ error: '缺少分店' }, { status: 400 })

  const system_total = await systemTotal(admin, branchId, date)
  const { data: adjustments } = await admin
    .from('actual_amount_adjustments')
    .select('*')
    .eq('branch_id_snapshot', branchId)
    .eq('business_date', date)
    .order('created_at', { ascending: false })

  return NextResponse.json({ branch_id: branchId, date, system_total, adjustments: adjustments || [] })
}

// POST /api/checkout/reconcile — record an actual-amount adjustment (reason required).
// Store-manager-only.
export async function POST(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role !== 'manager') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const date = typeof body.date === 'string' ? body.date : today()
  const branchId = session.branchId
  const actualTotal = Math.trunc(Number(body.actual_total))
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

  if (!branchId) return NextResponse.json({ error: '缺少分店' }, { status: 400 })
  if (!Number.isFinite(actualTotal)) return NextResponse.json({ error: '請輸入實際金額' }, { status: 400 })
  if (!reason) return NextResponse.json({ error: '請填寫調整原因' }, { status: 400 })

  const system_total = await systemTotal(admin, branchId, date)

  const { data, error } = await admin
    .from('actual_amount_adjustments')
    .insert({
      branch_id_snapshot: branchId,
      business_date: date,
      system_total,
      actual_total: actualTotal,
      difference: actualTotal - system_total,
      reason,
      account_id: session.accountId === 'owner-bootstrap' ? null : session.accountId,
      account_name: session.displayName,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { canViewBranch, getCheckoutSession } from '@/lib/checkoutAuth'
import { autoAssignCleaning, ensureCleaningAssigned } from '@/lib/cleaning'
import { logOrderEvent } from '@/lib/orderEditLog'

export const runtime = 'nodejs'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function resolveBranchId(session: { role: string; branchId: string | null }, param: string | null): string | null {
  if (session.role === 'owner') return param
  return session.branchId
}

// GET /api/checkout/cleaning?branch_id=&from=&to=
// Auto-assigns today's duty on first read of the day (no button needed), then lists.
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const url = new URL(request.url)
  const branchId = resolveBranchId(session, url.searchParams.get('branch_id'))
  if (!branchId) return NextResponse.json({ error: '缺少分店' }, { status: 400 })
  if (!canViewBranch(session, branchId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // The daily assignment happens automatically — the first person to view the
  // schedule that day triggers it if the cron hasn't already.
  const today = todayStr()
  await ensureCleaningAssigned(admin, branchId, today)

  const from = url.searchParams.get('from') || today
  const to = url.searchParams.get('to') || addDays(from, 13)

  const { data, error } = await admin
    .from('cleaning_duty')
    .select('*')
    .eq('branch_id', branchId)
    .gte('duty_date', from)
    .lte('duty_date', to)
    .order('duty_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST /api/checkout/cleaning — manager/owner.
//   { branch_id?, date, stylist_id? }
//   stylist_id present = manual override (logged to the owner's audit feed);
//   absent = re-run the auto-assignment for that date.
export async function POST(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role === 'stylist') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const branchId = resolveBranchId(session, body.branch_id ? String(body.branch_id) : null)
  const date = typeof body.date === 'string' ? body.date : todayStr()
  if (!branchId) return NextResponse.json({ error: '缺少分店' }, { status: 400 })
  if (!canViewBranch(session, branchId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Manual override: manager picks a specific stylist.
  if (body.stylist_id) {
    const { data: stylist } = await admin
      .from('stylists')
      .select('id, name')
      .eq('id', String(body.stylist_id))
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .maybeSingle()
    if (!stylist) return NextResponse.json({ error: '找不到該美甲師' }, { status: 400 })

    // Capture who was previously on duty for the log.
    const { data: prev } = await admin
      .from('cleaning_duty')
      .select('stylist_name_snapshot')
      .eq('branch_id', branchId)
      .eq('duty_date', date)
      .maybeSingle()

    const { data, error } = await admin
      .from('cleaning_duty')
      .upsert(
        {
          branch_id: branchId,
          duty_date: date,
          stylist_id: stylist.id,
          stylist_name_snapshot: stylist.name,
          assigned_at: new Date().toISOString(),
        },
        { onConflict: 'branch_id,duty_date' },
      )
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Manual changes are visible to the owner in 修改記錄.
    await logOrderEvent(admin, {
      orderId: null,
      orderIdText: `cleaning:${branchId}:${date}`,
      branchId,
      actor: session,
      action: 'cleaning_override',
      reason: `值日生改為 ${stylist.name}（${date}）${prev?.stylist_name_snapshot ? `，原為 ${prev.stylist_name_snapshot}` : ''}`,
    })

    return NextResponse.json(data, { status: 201 })
  }

  // Re-run auto-assignment for the date.
  const row = await autoAssignCleaning(admin, branchId, date)
  if (!row) return NextResponse.json({ error: '當天沒有可排班的美甲師' }, { status: 400 })
  return NextResponse.json(row, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { canViewBranch, getCheckoutSession } from '@/lib/checkoutAuth'

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
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const url = new URL(request.url)
  const branchId = resolveBranchId(session, url.searchParams.get('branch_id'))
  if (!branchId) return NextResponse.json({ error: '缺少分店' }, { status: 400 })
  if (!canViewBranch(session, branchId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const from = url.searchParams.get('from') || todayStr()
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

// POST /api/checkout/cleaning — assign duty for a date.
//   { branch_id?, date, stylist_id? }  — stylist_id present = manual override, else auto-assign.
// Manager (own store) or owner.
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

  // Active stylists at this branch.
  const { data: stylists } = await admin
    .from('stylists')
    .select('id, name')
    .eq('branch_id', branchId)
    .eq('is_active', true)
  const candidates = stylists || []
  if (candidates.length === 0) {
    return NextResponse.json({ error: '此分店沒有在職美甲師' }, { status: 400 })
  }

  let chosen: { id: string; name: string } | undefined

  if (body.stylist_id) {
    // Manual override.
    chosen = candidates.find((c) => c.id === String(body.stylist_id))
    if (!chosen) return NextResponse.json({ error: '找不到該美甲師' }, { status: 400 })
  } else {
    // Exclude technicians who are off that day (weekly off or a day-off override).
    const dow = new Date(`${date}T00:00:00`).getDay() // 0=Sunday
    const ids = candidates.map((c) => c.id)

    const [{ data: weekly }, { data: overrides }] = await Promise.all([
      admin.from('stylist_weekly_hours').select('stylist_id, is_working').eq('day_of_week', dow).in('stylist_id', ids),
      admin.from('stylist_day_overrides').select('stylist_id, is_off').eq('date', date).in('stylist_id', ids),
    ])
    const offIds = new Set<string>()
    for (const w of weekly || []) if (w.is_working === false) offIds.add(w.stylist_id)
    for (const o of overrides || []) if (o.is_off === true) offIds.add(o.stylist_id)

    const available = candidates.filter((c) => !offIds.has(c.id))
    if (available.length === 0) {
      return NextResponse.json({ error: '當天沒有可排班的美甲師' }, { status: 400 })
    }

    // Weight against recent assignments to reduce repeats (strict fairness not required).
    const since = addDays(date, -14)
    const { data: recent } = await admin
      .from('cleaning_duty')
      .select('stylist_id')
      .eq('branch_id', branchId)
      .gte('duty_date', since)
      .lt('duty_date', date)
    const counts = new Map<string, number>()
    for (const r of recent || []) if (r.stylist_id) counts.set(r.stylist_id, (counts.get(r.stylist_id) || 0) + 1)

    const minCount = Math.min(...available.map((c) => counts.get(c.id) || 0))
    const leastUsed = available.filter((c) => (counts.get(c.id) || 0) === minCount)
    chosen = leastUsed[Math.floor(Math.random() * leastUsed.length)]
  }

  const { data, error } = await admin
    .from('cleaning_duty')
    .upsert(
      {
        branch_id: branchId,
        duty_date: date,
        stylist_id: chosen!.id,
        stylist_name_snapshot: chosen!.name,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: 'branch_id,duty_date' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

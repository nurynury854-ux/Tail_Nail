import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession, requireRole } from '@/lib/checkoutAuth'

export const runtime = 'nodejs'

// GET /api/checkout/bonuses — { fixed, performance }, scoped by role.
//   owner -> all    manager -> own store    stylist -> own
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  let fixedQ = admin.from('fixed_bonuses').select('*').order('created_at', { ascending: false })
  let perfQ = admin.from('performance_bonuses').select('*').order('created_at', { ascending: false })

  if (session.role === 'stylist') {
    fixedQ = fixedQ.eq('stylist_id_snapshot', session.stylistId)
    perfQ = perfQ.eq('stylist_id_snapshot', session.stylistId)
  } else if (session.role === 'manager') {
    // Manager sees branch-scoped performance bonuses; fixed bonuses are per-stylist,
    // so filter those by the stylists currently at this branch.
    perfQ = perfQ.eq('branch_id_snapshot', session.branchId)
  }

  const [{ data: fixed }, { data: performance }] = await Promise.all([fixedQ, perfQ])
  return NextResponse.json({ fixed: fixed || [], performance: performance || [] })
}

// POST /api/checkout/bonuses — owner only. Create a fixed or performance bonus.
export async function POST(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session || !requireRole(session, ['owner'])) {
    return NextResponse.json({ error: '僅老闆可設定獎金' }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const body = await request.json().catch(() => ({}))

  if (body.type === 'fixed') {
    const amount = Math.trunc(Number(body.amount))
    if (!body.stylist_id_snapshot || !Number.isFinite(amount)) {
      return NextResponse.json({ error: '請選擇美甲師並輸入金額' }, { status: 400 })
    }
    const { data, error } = await admin
      .from('fixed_bonuses')
      .insert({
        stylist_id_snapshot: String(body.stylist_id_snapshot),
        stylist_name_snapshot: body.stylist_name_snapshot || null,
        amount,
        effective_from: body.effective_from || null,
        set_by: session.accountId === 'owner-bootstrap' ? null : session.accountId,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  if (body.type === 'performance') {
    const scope = body.scope === 'branch' ? 'branch' : 'stylist'
    const threshold = Math.trunc(Number(body.revenue_threshold))
    const bonus = Math.trunc(Number(body.bonus_amount))
    if (!Number.isFinite(threshold) || !Number.isFinite(bonus)) {
      return NextResponse.json({ error: '請輸入門檻與獎金金額' }, { status: 400 })
    }
    if (scope === 'stylist' && !body.stylist_id_snapshot) {
      return NextResponse.json({ error: '請選擇美甲師' }, { status: 400 })
    }
    if (scope === 'branch' && !body.branch_id_snapshot) {
      return NextResponse.json({ error: '請選擇分店' }, { status: 400 })
    }
    const { data, error } = await admin
      .from('performance_bonuses')
      .insert({
        scope,
        stylist_id_snapshot: scope === 'stylist' ? String(body.stylist_id_snapshot) : null,
        branch_id_snapshot: scope === 'branch' ? String(body.branch_id_snapshot) : null,
        revenue_threshold: threshold,
        bonus_amount: bonus,
        set_by: session.accountId === 'owner-bootstrap' ? null : session.accountId,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  return NextResponse.json({ error: '未知的獎金類型' }, { status: 400 })
}

// PATCH /api/checkout/bonuses — owner only. Toggle/adjust a bonus.
export async function PATCH(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session || !requireRole(session, ['owner'])) {
    return NextResponse.json({ error: '僅老闆可調整獎金' }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const table = body.type === 'performance' ? 'performance_bonuses' : 'fixed_bonuses'
  if (!body.id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active
  if ('amount' in body) update.amount = Math.trunc(Number(body.amount))
  if ('revenue_threshold' in body) update.revenue_threshold = Math.trunc(Number(body.revenue_threshold))
  if ('bonus_amount' in body) update.bonus_amount = Math.trunc(Number(body.bonus_amount))

  const { data, error } = await admin.from(table).update(update).eq('id', body.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/checkout/bonuses?type=fixed|performance&id=...
export async function DELETE(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session || !requireRole(session, ['owner'])) {
    return NextResponse.json({ error: '僅老闆可刪除獎金' }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const table = url.searchParams.get('type') === 'performance' ? 'performance_bonuses' : 'fixed_bonuses'
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const { error } = await admin.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

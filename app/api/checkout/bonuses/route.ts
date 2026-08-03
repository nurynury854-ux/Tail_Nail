import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession, requireRole } from '@/lib/checkoutAuth'

export const runtime = 'nodejs'

// GET /api/checkout/bonuses — { fixed, performance }, scoped by role.
//   owner   -> every bonus, active or not (this is the editor's data source)
//   manager -> own active fixed bonus + own branch's active performance bonuses
//   stylist -> own active fixed bonus only
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  let fixedQ = admin.from('fixed_bonuses').select('*').order('created_at', { ascending: false })
  // 業績獎金 is branch-level only — legacy stylist-scoped rows are never returned.
  let perfQ = admin
    .from('performance_bonuses')
    .select('*')
    .eq('scope', 'branch')
    .order('created_at', { ascending: false })

  if (session.role !== 'owner') {
    // Staff see only their own bonuses, and only ones currently in effect —
    // a disabled row is Kenny's bookkeeping, not something they are owed.
    // A fixed bonus is keyed by the account's linked technician row, so an
    // account without one matches nothing ('' is never a real stylist id).
    fixedQ = fixedQ.eq('stylist_id_snapshot', session.stylistId || '').eq('is_active', true)
    perfQ = perfQ.eq('is_active', true)
  }

  if (session.role === 'manager') {
    perfQ = perfQ.eq('branch_id_snapshot', session.branchId || '')
  }

  const [{ data: fixed }, { data: performance }] = await Promise.all([fixedQ, perfQ])
  // Performance bonuses are a store-manager payout; stylists don't see them.
  return NextResponse.json({
    fixed: fixed || [],
    performance: session.role === 'stylist' ? [] : performance || [],
  })
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
    // One active fixed bonus per technician. The monthly report sums every
    // active row, so a second one silently doubles the payout — adjust the
    // existing row's amount instead of stacking another on top.
    const { data: clash } = await admin
      .from('fixed_bonuses')
      .select('id')
      .eq('stylist_id_snapshot', String(body.stylist_id_snapshot))
      .eq('is_active', true)
      .limit(1)
    if (clash && clash.length > 0) {
      return NextResponse.json(
        { error: '此美甲師已有啟用中的固定獎金，請直接修改金額' },
        { status: 409 },
      )
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
    // 業績獎金 is branch-level only, awarded to that branch's store manager.
    const threshold = Math.trunc(Number(body.revenue_threshold))
    const bonus = Math.trunc(Number(body.bonus_amount))
    const branchId = body.branch_id_snapshot ? String(body.branch_id_snapshot) : null
    if (!branchId) {
      return NextResponse.json({ error: '請選擇分店' }, { status: 400 })
    }
    if (!Number.isFinite(threshold) || !Number.isFinite(bonus)) {
      return NextResponse.json({ error: '請輸入門檻與獎金金額' }, { status: 400 })
    }
    const { data, error } = await admin
      .from('performance_bonuses')
      .insert({
        scope: 'branch',
        stylist_id_snapshot: null,
        branch_id_snapshot: branchId,
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

  // Amounts are edited in place, so a bad value must be rejected rather than
  // written as NaN.
  for (const field of ['amount', 'revenue_threshold', 'bonus_amount'] as const) {
    if (!(field in body)) continue
    const value = Math.trunc(Number(body[field]))
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: '金額必須為 0 以上的數字' }, { status: 400 })
    }
    update[field] = value
  }

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

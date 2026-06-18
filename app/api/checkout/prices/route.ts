import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession, requireRole } from '@/lib/checkoutAuth'

export const runtime = 'nodejs'

// GET /api/checkout/prices — the active price catalog (any signed-in role).
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const { data, error } = await admin
    .from('checkout_service_prices')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// PATCH /api/checkout/prices — owner only. Edit one catalog item's prices.
export async function PATCH(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session || !requireRole(session, ['owner'])) {
    return NextResponse.json({ error: '僅老闆可調整價格' }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  if (!body.id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const toInt = (v: unknown) => (v === null || v === '' ? null : Math.trunc(Number(v)))
  const toArr = (v: unknown) =>
    Array.isArray(v) ? v.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n)) : undefined

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('price_hand' in body) update.price_hand = toInt(body.price_hand)
  if ('price_foot' in body) update.price_foot = toInt(body.price_foot)
  if ('tiers_hand' in body) update.tiers_hand = toArr(body.tiers_hand)
  if ('tiers_foot' in body) update.tiers_foot = toArr(body.tiers_foot)
  if ('unit_price' in body) update.unit_price = toInt(body.unit_price)
  if ('unit_full_qty' in body) update.unit_full_qty = toInt(body.unit_full_qty)
  if ('unit_full_price' in body) update.unit_full_price = toInt(body.unit_full_price)
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active

  const { data, error } = await admin
    .from('checkout_service_prices')
    .update(update)
    .eq('id', body.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

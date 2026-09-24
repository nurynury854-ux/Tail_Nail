import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseConfig, supabase, createAdminClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id')
  const activeOnly = searchParams.get('active') !== 'false'

  if (!hasSupabaseConfig || !supabase) {
    return NextResponse.json([])
  }

  let query = supabase.from('stylists').select('*').order('name', { ascending: true })
  if (branchId) query = query.eq('branch_id', branchId)
  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const admin = createAdminClient()
  if (!hasSupabaseConfig || !admin) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const body = await request.json()
  const { name, branch_id, bio, force } = body as {
    name?: string
    branch_id?: string
    bio?: string
    force?: boolean
  }

  if (!name || !branch_id) {
    return NextResponse.json({ error: 'name and branch_id are required' }, { status: 400 })
  }

  // A stylist moving branches must go through the account-transfer feature
  // (PATCH /api/checkout/accounts/[id]), which updates her EXISTING row's
  // branch_id in place. "Add stylist" for someone who already has a row
  // elsewhere instead creates a second, disconnected row — her checkout
  // login's accounts.stylist_id still points at the old row, so any booking
  // resolved against this new one becomes permanently invisible on her own
  // calendar (self-view only ever queries by that one stylist_id) even
  // though everything else about the booking, including the LINE
  // confirmation, looks completely normal. Block the accidental case; a
  // genuine same-name coincidence can still opt in with `force`.
  if (!force) {
    const { data: existing } = await admin
      .from('stylists')
      .select('id, branch_id')
      .ilike('name', name.trim())
      .eq('is_active', true)
    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          error: '已有同名美甲師存在，如果是分店異動請改用「帳號管理」的分店轉移功能，不要新增——否則她的行事曆將對不上她本人帳號看到的預約。若確定是不同的人，請重新提交並加上 force。',
          existing,
        },
        { status: 409 },
      )
    }
  }

  const { data, error } = await admin
    .from('stylists')
    .insert({
      name: name.trim(),
      branch_id,
      bio: bio?.trim() || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const weeklyDefaults = Array.from({ length: 7 }, (_, day) => ({
    stylist_id: data.id,
    day_of_week: day,
    start_time: '11:00',
    end_time: '21:00',
    is_working: true,
  }))

  const { error: scheduleError } = await admin.from('stylist_weekly_hours').insert(weeklyDefaults)
  if (scheduleError) {
    return NextResponse.json({ error: scheduleError.message }, { status: 500 })
  }

  // Apply hardcoded default durations for new stylists
  const DEFAULT_DURATIONS: Array<{ service_id: string; hand: number; foot: number }> = [
    { service_id: 'svc-main-solid', hand: 60, foot: 40 },
    { service_id: 'svc-main-cat-eye', hand: 90, foot: 60 },
    { service_id: 'svc-main-gradient', hand: 90, foot: 60 },
    { service_id: 'svc-main-french', hand: 90, foot: 80 },
    { service_id: 'svc-main-mirror', hand: 90, foot: 90 },
    { service_id: 'svc-main-store-style', hand: 90, foot: 90 },
    { service_id: 'svc-main-custom-style', hand: 150, foot: 150 },
    { service_id: 'svc-addon-remove', hand: 30, foot: 30 },
    { service_id: 'svc-addon-care', hand: 40, foot: 60 },
    { service_id: 'svc-addon-shape', hand: 20, foot: 30 },
    { service_id: 'svc-addon-thicken', hand: 20, foot: 20 },
    { service_id: 'svc-addon-extension', hand: 60, foot: 60 },
  ]

  const durationDefaults = DEFAULT_DURATIONS.flatMap((row) => [
    { stylist_id: data.id, service_id: row.service_id, category: 'hand', duration_minutes: row.hand, is_pending: false },
    { stylist_id: data.id, service_id: row.service_id, category: 'foot', duration_minutes: row.foot, is_pending: false },
  ])

  await admin.from('service_durations').insert(durationDefaults)
  // Non-fatal: if this fails the stylist is still created

  return NextResponse.json(data, { status: 201 })
}

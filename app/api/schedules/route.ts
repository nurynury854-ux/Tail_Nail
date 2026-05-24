import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseConfig, supabase, createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')
  return NextResponse.json(body, { ...init, headers })
}

export async function GET(request: NextRequest) {
  if (!hasSupabaseConfig || !supabase) {
    return jsonNoStore({ branchHours: null, stylistWeekly: [], branchOverrides: [], stylistOverrides: [] })
  }

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id')
  const stylistId = searchParams.get('stylist_id')

  const [branchHoursResult, stylistWeeklyResult, branchOverridesResult, stylistOverridesResult] = await Promise.all([
    branchId ? supabase.from('branch_working_hours').select('*').eq('branch_id', branchId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    stylistId
      ? supabase.from('stylist_weekly_hours').select('*').eq('stylist_id', stylistId).order('day_of_week', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    branchId
      ? supabase.from('branch_day_overrides').select('*').eq('branch_id', branchId).order('date', { ascending: false }).limit(500)
      : supabase.from('branch_day_overrides').select('*').order('date', { ascending: false }).limit(500),
    stylistId
      ? supabase.from('stylist_day_overrides').select('*').eq('stylist_id', stylistId).order('date', { ascending: false }).limit(500)
      : supabase.from('stylist_day_overrides').select('*').order('date', { ascending: false }).limit(500),
  ])

  const error = branchHoursResult.error || stylistWeeklyResult.error || branchOverridesResult.error || stylistOverridesResult.error
  if (error) return jsonNoStore({ error: error.message }, { status: 500 })

  // Deduplicate overrides: before the delete-before-insert fix, each save created a new row.
  // Keep the most restrictive row per (branch_id, date) and (stylist_id, date).
  const branchOverrideMap = new Map<string, Record<string, unknown>>()
  for (const row of (branchOverridesResult.data || []) as Record<string, unknown>[]) {
    const key = `${row.branch_id}:${row.date}`
    const existing = branchOverrideMap.get(key)
    if (!existing || row.is_closed) branchOverrideMap.set(key, row)
  }
  const stylistOverrideMap = new Map<string, Record<string, unknown>>()
  for (const row of (stylistOverridesResult.data || []) as Record<string, unknown>[]) {
    const key = `${row.stylist_id}:${row.date}`
    const existing = stylistOverrideMap.get(key)
    if (!existing || row.is_off) stylistOverrideMap.set(key, row)
  }

  return jsonNoStore({
    branchHours: branchHoursResult.data,
    stylistWeekly: stylistWeeklyResult.data || [],
    branchOverrides: Array.from(branchOverrideMap.values()).slice(0, 30),
    stylistOverrides: Array.from(stylistOverrideMap.values()).slice(0, 30),
  })
}

export async function POST(request: NextRequest) {
  const admin = createAdminClient()
  if (!hasSupabaseConfig || !admin) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const body = await request.json()
  const { type } = body as { type?: string }

  if (type === 'branch_weekly') {
    const { branch_id, day_key, open_time, close_time } = body as {
      branch_id?: string
      day_key?: string
      open_time?: string | null
      close_time?: string | null
    }

    if (!branch_id || !day_key) return NextResponse.json({ error: 'branch_id and day_key are required' }, { status: 400 })

    const openColumn = `${day_key}_open`
    const closeColumn = `${day_key}_close`
    const colUpdate: Record<string, string | null> = {
      [openColumn]: open_time || null,
      [closeColumn]: close_time || null,
    }

    // Use SELECT + UPDATE/INSERT to avoid duplicate rows from upsert on auto-PK
    const { data: existing, error: fetchError } = await admin
      .from('branch_working_hours')
      .select('branch_id')
      .eq('branch_id', branch_id)
      .maybeSingle()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

    let data, error
    if (existing) {
      ;({ data, error } = await admin
        .from('branch_working_hours')
        .update(colUpdate)
        .eq('branch_id', branch_id)
        .select()
        .single())
    } else {
      ;({ data, error } = await admin
        .from('branch_working_hours')
        .insert({ branch_id, ...colUpdate })
        .select()
        .single())
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'stylist_weekly') {
    const { stylist_id, day_of_week, start_time, end_time, is_working } = body as {
      stylist_id?: string
      day_of_week?: number
      start_time?: string | null
      end_time?: string | null
      is_working?: boolean
    }

    if (!stylist_id || day_of_week === undefined) {
      return NextResponse.json({ error: 'stylist_id and day_of_week are required' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('stylist_weekly_hours')
      .upsert({
        stylist_id,
        day_of_week,
        start_time: start_time || null,
        end_time: end_time || null,
        is_working: Boolean(is_working),
      }, { onConflict: 'stylist_id,day_of_week' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'branch_override') {
    const { branch_id, date, open_time, close_time, is_closed, reason } = body as {
      branch_id?: string
      date?: string
      open_time?: string | null
      close_time?: string | null
      is_closed?: boolean
      reason?: string
    }

    if (!branch_id || !date) return NextResponse.json({ error: 'branch_id and date are required' }, { status: 400 })

    await admin.from('branch_day_overrides').delete().eq('branch_id', branch_id).eq('date', date)

    const { data, error } = await admin
      .from('branch_day_overrides')
      .insert({
        branch_id,
        date,
        open_time: open_time || null,
        close_time: close_time || null,
        is_closed: Boolean(is_closed),
        reason: reason?.trim() || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'stylist_override') {
    const { stylist_id, date, start_time, end_time, is_off, reason } = body as {
      stylist_id?: string
      date?: string
      start_time?: string | null
      end_time?: string | null
      is_off?: boolean
      reason?: string
    }

    if (!stylist_id || !date) return NextResponse.json({ error: 'stylist_id and date are required' }, { status: 400 })

    await admin.from('stylist_day_overrides').delete().eq('stylist_id', stylist_id).eq('date', date)

    const { data, error } = await admin
      .from('stylist_day_overrides')
      .insert({
        stylist_id,
        date,
        start_time: start_time || null,
        end_time: end_time || null,
        is_off: Boolean(is_off),
        reason: reason?.trim() || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Unsupported schedule update type' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  const admin = createAdminClient()
  if (!hasSupabaseConfig || !admin) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const id = searchParams.get('id')

  if (!type || !id) {
    return NextResponse.json({ error: 'type and id are required' }, { status: 400 })
  }

  if (type === 'branch_override') {
    const { error } = await admin.from('branch_day_overrides').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (type === 'stylist_override') {
    const { error } = await admin.from('stylist_day_overrides').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unsupported delete type' }, { status: 400 })
}

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
  const { name, branch_id, bio } = body as {
    name?: string
    branch_id?: string
    bio?: string
  }

  if (!name || !branch_id) {
    return NextResponse.json({ error: 'name and branch_id are required' }, { status: 400 })
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

  // Inherit max durations from existing stylists in the same branch
  const { data: siblingStylists } = await admin
    .from('stylists')
    .select('id')
    .eq('branch_id', branch_id)
    .neq('id', data.id)

  const siblingIds = (siblingStylists || []).map((s: { id: string }) => s.id)

  if (siblingIds.length > 0) {
    const { data: existingDurations } = await admin
      .from('service_durations')
      .select('service_id, category, duration_minutes')
      .in('stylist_id', siblingIds)
      .eq('is_pending', false)

    // Build max duration per (service_id, category)
    const maxMap: Record<string, { service_id: string; category: string; duration_minutes: number }> = {}
    for (const row of existingDurations || []) {
      const key = `${row.service_id}::${row.category}`
      if (!maxMap[key] || row.duration_minutes > maxMap[key].duration_minutes) {
        maxMap[key] = { service_id: row.service_id, category: row.category, duration_minutes: row.duration_minutes }
      }
    }

    const durationDefaults = Object.values(maxMap).map((row) => ({
      stylist_id: data.id,
      service_id: row.service_id,
      category: row.category,
      duration_minutes: row.duration_minutes,
      is_pending: false,
    }))

    if (durationDefaults.length > 0) {
      await admin.from('service_durations').insert(durationDefaults)
      // Non-fatal: if this fails the stylist is still created
    }
  }

  return NextResponse.json(data, { status: 201 })
}

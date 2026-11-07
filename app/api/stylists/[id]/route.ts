import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseConfig, createAdminClient } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/adminAuth'
import { taipeiToday } from '@/lib/dateTW'

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

// What removing a stylist touches: her booking history, her checkout logins,
// and the upcoming appointments someone still has to take over. The admin UI
// shows this before confirming so nothing is left silently hanging.
async function loadRemovalImpact(admin: AdminClient, stylistId: string) {
  const [history, accounts, upcoming] = await Promise.all([
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('stylist_id', stylistId),
    admin.from('accounts').select('id, username, display_name, is_active').eq('stylist_id', stylistId),
    admin
      .from('bookings')
      .select('*')
      .eq('stylist_id', stylistId)
      .eq('status', 'confirmed')
      .gte('date', taipeiToday())
      .order('date')
      .order('start_time'),
  ])
  const error = history.error || accounts.error || upcoming.error
  if (error) return { error: error.message }
  return {
    bookingCount: history.count ?? 0,
    accounts: accounts.data || [],
    upcoming: upcoming.data || [],
  }
}

function upcomingBlock(upcoming: unknown[]) {
  return NextResponse.json(
    {
      error: `她名下還有 ${upcoming.length} 筆已預約的客人，請先逐筆改派給有空的美甲師，才能停用或刪除`,
      upcoming,
    },
    { status: 409 },
  )
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!hasSupabaseConfig || !admin) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const impact = await loadRemovalImpact(admin, params.id)
  if ('error' in impact) return NextResponse.json({ error: impact.error }, { status: 500 })
  return NextResponse.json(impact)
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!hasSupabaseConfig || !admin) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const body = await request.json()

  // Taking a stylist out of service strands her booked customers — they must be
  // moved to someone with the time first (/api/bookings/[id]/reassign).
  if (body.is_active === false) {
    const impact = await loadRemovalImpact(admin, params.id)
    if ('error' in impact) return NextResponse.json({ error: impact.error }, { status: 500 })
    if (impact.upcoming.length > 0) return upcomingBlock(impact.upcoming)
  }

  const validGrades = ['special', 'grade1', 'grade2']
  const validWeights = ['high', 'low']
  const updates = {
    ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
    ...(typeof body.bio === 'string' ? { bio: body.bio.trim() } : {}),
    ...(typeof body.branch_id === 'string' ? { branch_id: body.branch_id } : {}),
    ...(typeof body.is_active === 'boolean' ? { is_active: body.is_active } : {}),
    ...(body.grade === null || validGrades.includes(body.grade) ? { grade: body.grade ?? null } : {}),
    ...('selection_weight' in body && (body.selection_weight === null || validWeights.includes(body.selection_weight))
      ? { selection_weight: body.selection_weight ?? null }
      : {}),
  }

  const { data, error } = await admin
    .from('stylists')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!hasSupabaseConfig || !admin) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  // Permanent removal: the owner wants the name gone from the system. Her
  // past bookings are handed to another technician first —
  // the database refuses to delete a stylist that bookings still point at, and
  // blanking them would orphan every one. Her checkout logins are deleted with
  // her. Leave/hour rows cascade.
  const impact = await loadRemovalImpact(admin, params.id)
  if ('error' in impact) return NextResponse.json({ error: impact.error }, { status: 500 })
  // Never remove someone who still has customers booked: each one has to be
  // moved to a stylist who is actually free (checked by the reassign route).
  if (impact.upcoming.length > 0) return upcomingBlock(impact.upcoming)

  const url = new URL(request.url)
  if (url.searchParams.get('permanent') === 'true') {
    const reassignTo = url.searchParams.get('reassign_to')
    // Only her past/finished bookings are left to hand over; they need a
    // holder because the database refuses to orphan a booking.
    if (impact.bookingCount > 0 && (!reassignTo || reassignTo === params.id)) {
      return NextResponse.json({ error: '請選擇接手歷史預約的美甲師' }, { status: 400 })
    }
    if (impact.bookingCount > 0) {
      const { data: target } = await admin.from('stylists').select('id').eq('id', reassignTo!).maybeSingle()
      if (!target) return NextResponse.json({ error: '接手的美甲師不存在' }, { status: 400 })
      const { error: moveError } = await admin.from('bookings').update({ stylist_id: reassignTo }).eq('stylist_id', params.id)
      if (moveError) return NextResponse.json({ error: moveError.message }, { status: 500 })
    }
    const { error: accountError } = await admin.from('accounts').delete().eq('stylist_id', params.id)
    if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 })
    const { error: deleteError } = await admin.from('stylists').delete().eq('id', params.id)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
    return NextResponse.json({ success: true, deactivated: false, permanent: true })
  }

  // bookings.stylist_id and accounts.stylist_id were ON DELETE SET NULL, so a
  // hard delete silently wiped the technician off every booking she ever had
  // (they showed up as unassigned) and unlinked her checkout login. A
  // technician with any history is deactivated instead — she stops being
  // bookable but her bookings keep pointing at her — and her logins are
  // switched off with her, since she has left. Only a row nothing refers to
  // (e.g. one added by mistake) is actually removed.
  if (impact.bookingCount > 0 || impact.accounts.length > 0) {
    const { error } = await admin.from('stylists').update({ is_active: false }).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (impact.accounts.length > 0) {
      const { error: accountError } = await admin.from('accounts').update({ is_active: false }).eq('stylist_id', params.id)
      if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deactivated: true, ...impact })
  }

  const { error } = await admin.from('stylists').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, deactivated: false, ...impact })
}

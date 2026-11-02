import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseConfig, createAdminClient } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/adminAuth'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!hasSupabaseConfig || !admin) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const body = await request.json()
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

  // bookings.stylist_id and accounts.stylist_id were ON DELETE SET NULL, so a
  // hard delete silently wiped the technician off every booking she ever had
  // (they showed up as unassigned) and unlinked her checkout login. A
  // technician with any history is deactivated instead — she stops being
  // bookable but her bookings keep pointing at her. Only a row nothing refers
  // to (e.g. one added by mistake) is actually removed.
  const [bookingRefs, accountRefs] = await Promise.all([
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('stylist_id', params.id),
    admin.from('accounts').select('id', { count: 'exact', head: true }).eq('stylist_id', params.id),
  ])
  const refError = bookingRefs.error || accountRefs.error
  if (refError) return NextResponse.json({ error: refError.message }, { status: 500 })

  if ((bookingRefs.count ?? 0) > 0 || (accountRefs.count ?? 0) > 0) {
    const { error } = await admin.from('stylists').update({ is_active: false }).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, deactivated: true, bookings: bookingRefs.count ?? 0 })
  }

  const { error } = await admin.from('stylists').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, deactivated: false })
}

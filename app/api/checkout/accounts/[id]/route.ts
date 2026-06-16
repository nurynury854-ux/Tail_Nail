import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession, hashPassword, requireRole } from '@/lib/checkoutAuth'

export const runtime = 'nodejs'

function sanitize(account: Record<string, unknown>) {
  const { password_hash, password_salt, ...rest } = account
  return rest
}

// PATCH /api/checkout/accounts/[id] — owner only.
// Handles: transfer branch, edit subtitle/display name, reset password, activate/deactivate.
// NOTE: past orders snapshot branch/stylist, so a transfer never moves historical revenue.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCheckoutSession(request)
  if (!requireRole(session, ['owner'])) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.display_name === 'string') update.display_name = body.display_name.trim()
  if ('subtitle' in body) update.subtitle = body.subtitle ? String(body.subtitle).trim() : null
  if ('branch_id' in body) update.branch_id = body.branch_id ? String(body.branch_id) : null
  if ('stylist_id' in body) update.stylist_id = body.stylist_id ? String(body.stylist_id) : null
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active
  if (typeof body.password === 'string' && body.password) {
    const { hash, salt } = await hashPassword(body.password)
    update.password_hash = hash
    update.password_salt = salt
  }

  const { data, error } = await admin
    .from('accounts')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Keep the booking system in sync: if this account links a technician and the
  // branch was transferred, move the stylist row too (current assignment only —
  // past checkout orders keep their snapshot and stay with the original store).
  if ('branch_id' in body && data?.stylist_id && data?.branch_id) {
    await admin.from('stylists').update({ branch_id: data.branch_id }).eq('id', data.stylist_id)
  }

  return NextResponse.json(sanitize(data))
}

// DELETE /api/checkout/accounts/[id] — owner only.
// Orders retain their snapshot fields, so revenue history is preserved.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCheckoutSession(request)
  if (!requireRole(session, ['owner'])) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const { error } = await admin.from('accounts').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

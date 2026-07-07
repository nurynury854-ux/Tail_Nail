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

  // Account-type switch — only between 美甲師 (stylist) and 店長 (manager).
  // Never converts to/from owner, and the account row is kept so no data is lost.
  if ('role' in body) {
    if (body.role !== 'stylist' && body.role !== 'manager') {
      return NextResponse.json({ error: '僅可切換美甲師／店長' }, { status: 400 })
    }
    const { data: current } = await admin.from('accounts').select('role, branch_id').eq('id', params.id).maybeSingle()
    if (!current) return NextResponse.json({ error: '找不到帳號' }, { status: 404 })
    if (current.role === 'owner') {
      return NextResponse.json({ error: '無法變更老闆帳號類型' }, { status: 403 })
    }
    if (body.role === 'manager' && !current.branch_id && !('branch_id' in body)) {
      return NextResponse.json({ error: '店長必須指定分店' }, { status: 400 })
    }
    update.role = body.role
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

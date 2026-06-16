import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession, hashPassword, requireRole } from '@/lib/checkoutAuth'

export const runtime = 'nodejs'

function sanitize(account: Record<string, unknown>) {
  const { password_hash, password_salt, ...rest } = account
  return rest
}

// GET /api/checkout/accounts — owner only, list all accounts.
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!requireRole(session, ['owner'])) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const { data, error } = await admin
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(sanitize))
}

// POST /api/checkout/accounts — owner only, create a stylist/manager (or owner) account.
export async function POST(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session || !requireRole(session, ['owner'])) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const role = body.role as 'owner' | 'manager' | 'stylist'
  const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : ''
  const branchId = body.branch_id ? String(body.branch_id) : null
  const stylistId = body.stylist_id ? String(body.stylist_id) : null
  const subtitle = typeof body.subtitle === 'string' ? body.subtitle.trim() || null : null

  if (!username || !password || !displayName || !['owner', 'manager', 'stylist'].includes(role)) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }
  if ((role === 'manager' || role === 'stylist') && !branchId) {
    return NextResponse.json({ error: '美甲師與店長必須指定分店' }, { status: 400 })
  }

  const { hash, salt } = await hashPassword(password)

  const { data, error } = await admin
    .from('accounts')
    .insert({
      username,
      password_hash: hash,
      password_salt: salt,
      role,
      branch_id: branchId,
      stylist_id: stylistId,
      display_name: displayName,
      subtitle,
      created_by: session.accountId === 'owner-bootstrap' ? null : session.accountId,
    })
    .select()
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    const message = status === 409 ? '帳號已存在' : error.message
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json(sanitize(data), { status: 201 })
}

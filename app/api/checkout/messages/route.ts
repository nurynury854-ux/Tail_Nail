import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { canViewBranch, getCheckoutSession } from '@/lib/checkoutAuth'

export const runtime = 'nodejs'

// The board is a private channel between a store's manager and the owner.
// Stylists have no access. Each store's board is isolated; the owner sees all.

// GET /api/checkout/messages?branch_id=
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role === 'stylist') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const url = new URL(request.url)
  const branchId = session.role === 'manager' ? session.branchId : url.searchParams.get('branch_id')
  if (!branchId) return NextResponse.json({ error: '缺少分店' }, { status: 400 })
  if (!canViewBranch(session, branchId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data, error } = await admin
    .from('message_board')
    .select('*')
    .eq('branch_id', branchId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST /api/checkout/messages — manager (own store) or owner.
export async function POST(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role === 'stylist') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const branchId = session.role === 'manager' ? session.branchId : (body.branch_id ? String(body.branch_id) : null)
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (!branchId) return NextResponse.json({ error: '缺少分店' }, { status: 400 })
  if (!canViewBranch(session, branchId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!text) return NextResponse.json({ error: '請輸入訊息內容' }, { status: 400 })

  const { data, error } = await admin
    .from('message_board')
    .insert({
      branch_id: branchId,
      author_account_id: session.accountId === 'owner-bootstrap' ? null : session.accountId,
      author_name: session.displayName,
      author_role: session.role,
      body: text,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

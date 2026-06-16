import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCheckoutSession } from '@/lib/checkoutAuth'

export const runtime = 'nodejs'

// GET /api/checkout/logs?order_id=&limit=
// Owner sees all edit history; manager sees their own store's subset.
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role === 'stylist') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const url = new URL(request.url)
  const orderId = url.searchParams.get('order_id')
  const limit = Math.min(500, Number(url.searchParams.get('limit')) || 200)

  let query = admin.from('order_edit_logs').select('*').order('created_at', { ascending: false }).limit(limit)
  if (session.role === 'manager') query = query.eq('branch_id_snapshot', session.branchId)
  if (orderId) query = query.eq('order_id', orderId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

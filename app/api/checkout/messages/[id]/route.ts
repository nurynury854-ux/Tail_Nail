import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { canViewBranch, getCheckoutSession } from '@/lib/checkoutAuth'

export const runtime = 'nodejs'

// DELETE /api/checkout/messages/[id] — soft delete. Manager (own store) or owner.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role === 'stylist') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const { data: msg } = await admin.from('message_board').select('branch_id').eq('id', params.id).maybeSingle()
  if (!msg) return NextResponse.json({ error: '找不到訊息' }, { status: 404 })
  if (!canViewBranch(session, msg.branch_id)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await admin
    .from('message_board')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

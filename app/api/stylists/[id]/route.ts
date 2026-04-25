import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseConfig, supabase } from '@/lib/supabase'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!hasSupabaseConfig || !supabase) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const body = await request.json()
  const updates = {
    ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
    ...(typeof body.bio === 'string' ? { bio: body.bio.trim() } : {}),
    ...(typeof body.branch_id === 'string' ? { branch_id: body.branch_id } : {}),
    ...(typeof body.is_active === 'boolean' ? { is_active: body.is_active } : {}),
  }

  const { data, error } = await supabase
    .from('stylists')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!hasSupabaseConfig || !supabase) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const { error } = await supabase.from('stylists').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

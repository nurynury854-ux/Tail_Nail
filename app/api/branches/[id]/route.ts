import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseConfig, supabase } from '@/lib/supabase'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!hasSupabaseConfig || !supabase) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const body = await request.json()
  const updates = {
    ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
    ...(typeof body.address === 'string' ? { address: body.address.trim() } : {}),
    ...(typeof body.staff_count === 'number' ? { staff_count: body.staff_count } : {}),
    ...(typeof body.phone === 'string' ? { phone: body.phone.trim() } : {}),
    ...(typeof body.image_url === 'string' ? { image_url: body.image_url.trim() } : {}),
  }

  const { data, error } = await supabase
    .from('branches')
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

  const { error } = await supabase.from('branches').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

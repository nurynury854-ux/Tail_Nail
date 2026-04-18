import { NextRequest, NextResponse } from 'next/server'
import { supabase, hasSupabaseConfig } from '@/lib/supabase'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params

  try {
    const body = await request.json()
    const { status } = body

    const validStatuses = ['confirmed', 'cancelled', 'completed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    if (!hasSupabaseConfig || !supabase) {
      return NextResponse.json({ id, status, source: 'fallback' })
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('PATCH booking error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params

  try {
    if (!hasSupabaseConfig || !supabase) {
      return NextResponse.json({ success: true, id, source: 'fallback' })
    }

    const { error } = await supabase.from('bookings').delete().eq('id', id)

    if (error) {
      console.error('DELETE booking error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

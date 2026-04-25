import { NextRequest, NextResponse } from 'next/server'
import { supabase, hasSupabaseConfig } from '@/lib/supabase'
import { generateCancellationMessage } from '@/lib/bookingUtils'

async function sendLinePushMessage(userId: string, message: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: message }],
    }),
  })

  if (!response.ok) {
    throw new Error(`LINE push failed with status ${response.status}`)
  }
}

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

    const { data: currentBooking, error: currentError } = await supabase
      .from('bookings')
      .select('id, customer_name, line_id, date, start_time, branches(name)')
      .eq('id', id)
      .single()

    if (currentError || !currentBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
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

    if (status === 'cancelled' && currentBooking.line_id) {
      try {
        const branchName = (currentBooking.branches as { name?: string } | null)?.name || '小尾巴美甲'
        const message = generateCancellationMessage({
          customerName: currentBooking.customer_name,
          branchName,
          date: currentBooking.date,
          startTime: currentBooking.start_time,
        })
        await sendLinePushMessage(currentBooking.line_id, message)
      } catch (lineError) {
        console.warn('Failed to send cancellation LINE message:', lineError)
      }
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

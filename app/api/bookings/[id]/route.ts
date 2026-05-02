import { NextRequest, NextResponse } from 'next/server'
import { supabase, hasSupabaseConfig, createAdminClient } from '@/lib/supabase'
import { getBranchLineConfig } from '@/lib/lineConfig'
import { generateCancellationMessage } from '@/lib/bookingUtils'

async function sendLinePushMessage(userId: string, message: string, accessToken: string): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
      .select('id, customer_name, line_id, date, start_time, branch_id, branches(name)')
      .eq('id', id)
      .single()

    if (currentError || !currentBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const admin = createAdminClient() ?? supabase!
    const { data, error } = await admin
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
        const lineConfig = getBranchLineConfig(currentBooking.branch_id)
        if (lineConfig) {
          await sendLinePushMessage(currentBooking.line_id, message, lineConfig.channelAccessToken)
        } else {
          console.warn(`No LINE config for branch ${currentBooking.branch_id} — cancellation message not sent`)
        }
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

    const admin = createAdminClient() ?? supabase!
    const { error } = await admin.from('bookings').delete().eq('id', id)

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

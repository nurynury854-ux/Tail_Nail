import { NextRequest, NextResponse } from 'next/server'
import { supabase, hasSupabaseConfig } from '@/lib/supabase'
import { BRANCHES, SERVICES } from '@/lib/types'
import { timeToMinutes, getWorkingHours, generateConfirmationMessage } from '@/lib/bookingUtils'

async function sendLinePushMessage(userId: string, message: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured')
  }

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
    const errorBody = await response.text()
    throw new Error(`LINE push failed (${response.status}): ${errorBody}`)
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id')
  const date = searchParams.get('date')
  const status = searchParams.get('status')

  if (!hasSupabaseConfig || !supabase) {
    return NextResponse.json([])
  }

  try {
    let query = supabase
      .from('bookings')
      .select(`
        *,
        branches (id, name, address),
        services (id, name, duration_minutes, price)
      `)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (branchId) query = query.eq('branch_id', branchId)
    if (date) query = query.eq('date', date)
    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
      console.error('Supabase GET bookings error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('GET bookings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { branch_id, service_id, customer_name, line_id, phone, date, start_time, end_time, status } = body

    // Validate required fields
    if (!branch_id || !service_id || !customer_name || !line_id || !date || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const branch = BRANCHES.find((b) => b.id === branch_id)
    const service = SERVICES.find((s) => s.id === service_id)

    if (!branch || !service) {
      return NextResponse.json({ error: 'Invalid branch or service' }, { status: 400 })
    }

    // Validate date/time
    const [year, month, day] = date.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    const hours = getWorkingHours(dateObj)

    if (!hours) {
      return NextResponse.json({ error: 'We are closed on Sundays.' }, { status: 400 })
    }

    const startMin = timeToMinutes(start_time)
    const endMin = timeToMinutes(end_time)

    if (startMin < hours.open || endMin > hours.close) {
      return NextResponse.json({ error: 'Selected time is outside working hours.' }, { status: 400 })
    }

    const normalizedLineId = line_id.trim()
    const bookingPayload = {
      branch_id,
      service_id,
      customer_name: customer_name.trim(),
      line_id: normalizedLineId,
      phone: phone?.trim() || null,
      date,
      start_time,
      end_time,
      status: status || 'confirmed',
    }

    const recipientLineUserId = normalizedLineId.startsWith('U')
      ? normalizedLineId
      : process.env.LINE_DEMO_USER_ID

    const confirmationMessage = generateConfirmationMessage({
      customerName: bookingPayload.customer_name,
      branchName: branch.name,
      serviceName: service.name,
      date,
      startTime: start_time,
    })

    const notifyLine = async () => {
      if (!recipientLineUserId) {
        console.warn(
          'Skipping LINE push: no LINE userId provided. Use a U... value or set LINE_DEMO_USER_ID.'
        )
        return false
      }
      await sendLinePushMessage(recipientLineUserId, confirmationMessage)
      return true
    }

    if (!hasSupabaseConfig || !supabase) {
      const demoData = {
        id: `DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        ...bookingPayload,
      }

      let lineNotificationSent = false
      try {
        lineNotificationSent = await notifyLine()
      } catch (lineError) {
        console.error('LINE notification error (demo mode):', lineError)
      }

      return NextResponse.json({ ...demoData, line_notification_sent: lineNotificationSent }, { status: 201 })
    }

    // Check concurrent booking count (staff capacity check)
    const { data: overlapping, error: overlapError } = await supabase
      .from('bookings')
      .select('id')
      .eq('branch_id', branch_id)
      .eq('date', date)
      .eq('status', 'confirmed')
      .lt('start_time', end_time)
      .gt('end_time', start_time)

    if (overlapError) {
      console.error('Overlap check error:', overlapError)
      // Proceed anyway in demo mode
    }

    if (overlapping && overlapping.length >= branch.staff_count) {
      return NextResponse.json(
        { error: 'Sorry, this time slot is fully booked. Please choose another time.' },
        { status: 409 }
      )
    }

    // Create the booking
    const { data, error } = await supabase
      .from('bookings')
      .insert(bookingPayload)
      .select()
      .single()

    if (error) {
      console.error('Insert booking error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let lineNotificationSent = false
    try {
      lineNotificationSent = await notifyLine()
    } catch (lineError) {
      console.error('LINE notification error:', lineError)
    }

    return NextResponse.json({ ...data, line_notification_sent: lineNotificationSent }, { status: 201 })
  } catch (err) {
    console.error('POST booking error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

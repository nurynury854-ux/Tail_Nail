import { NextRequest, NextResponse } from 'next/server'
import { supabase, hasSupabaseConfig, createAdminClient } from '@/lib/supabase'
import { buildCandidateBranchIds, lookupOaBranch, sendCustomerPush } from '@/lib/lineNotify'
import { generateCancellationMessage } from '@/lib/bookingUtils'
import { isAdminRequest } from '@/lib/adminAuth'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

    let lineNotificationSent = false
    if (status === 'cancelled' && currentBooking.line_id) {
      try {
        const branchName = (currentBooking.branches as { name?: string } | null)?.name || '小尾巴美甲'
        const message = generateCancellationMessage({
          branchName,
          date: currentBooking.date,
          startTime: currentBooking.start_time,
        })
        // Never assume the booked branch's OA can reach this customer: a push
        // through an OA they haven't added fails with 400. Start with the
        // channel their confirmation actually went out through, then walk the
        // rest — the same way the confirmation itself is sent.
        const provenBranchId = await lookupOaBranch(admin, currentBooking.id)
        const result = await sendCustomerPush(
          currentBooking.line_id,
          message,
          buildCandidateBranchIds(provenBranchId, currentBooking.branch_id),
        )
        lineNotificationSent = result.sent
        if (!result.sent) {
          console.warn(
            `Cancellation LINE message FAILED for booking ${currentBooking.id} ` +
              `(branch ${currentBooking.branch_id}). Tried: ${result.errors.join(' | ')}`,
          )
        }
      } catch (lineError) {
        console.warn('Failed to send cancellation LINE message:', lineError)
      }
    }

    // Surfaced so the admin UI can say whether the customer was actually told,
    // instead of implying it from a successful status update.
    return NextResponse.json({ ...data, line_notification_sent: lineNotificationSent })
  } catch (err) {
    console.error('PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

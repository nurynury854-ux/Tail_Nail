// Realtime signal for booking changes.
//
// Every open calendar / booking list subscribes to `booking_events` over a
// Supabase websocket (see lib/useBookingEvents.ts). Browsers must NOT watch the
// `bookings` table itself — Realtime would push the full row (name + phone) to
// every device, bypassing the role/timer redaction the API enforces. So each
// route that changes a booking writes ONE PII-free row here instead, and the
// clients re-fetch through the redacting API when it arrives.
//
// EVERY code path that inserts, updates or deletes a booking must call this,
// or open calendars silently stay stale until someone reloads the page.

import type { SupabaseClient } from '@supabase/supabase-js'

export type BookingEventAction = 'created' | 'updated' | 'cancelled' | 'deleted'

export interface BookingEvent {
  bookingId: string
  branchId: string | null
  action: BookingEventAction
}

/**
 * Best-effort: never throws and never blocks the booking write it follows. A
 * missed push only means a device stays stale until its safety-net poll.
 *
 * Note: supabase-js reports failures via `{ error }`, not by throwing — a bare
 * try/catch around the insert would swallow them silently.
 */
export async function emitBookingEvent(admin: SupabaseClient, event: BookingEvent): Promise<void> {
  try {
    const { error } = await admin.from('booking_events').insert({
      booking_id: event.bookingId,
      branch_id: event.branchId,
      action: event.action,
    })
    if (error) {
      console.warn(`booking_events insert failed (realtime push skipped): ${error.message}`)
    }
  } catch (err) {
    console.warn('booking_events insert failed (realtime push skipped)', err)
  }
}

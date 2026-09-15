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

// Callers await this on the customer-facing booking-creation request. A slow
// or hanging insert (network blip, connection pool exhaustion, ...) must
// never be able to add meaningful latency to that response, let alone tip it
// past a serverless function timeout and make the booking itself look like
// it failed. Race it against a short timeout so it always settles quickly —
// in the healthy case the insert itself finishes in a few ms anyway.
const EMIT_TIMEOUT_MS = 1500

/**
 * Best-effort: never throws and never blocks the booking write it follows. A
 * missed push only means a device stays stale until its safety-net poll.
 *
 * Note: supabase-js reports failures via `{ error }`, not by throwing — a bare
 * try/catch around the insert would swallow them silently.
 */
export async function emitBookingEvent(admin: SupabaseClient, event: BookingEvent): Promise<void> {
  try {
    const insert = admin.from('booking_events').insert({
      booking_id: event.bookingId,
      branch_id: event.branchId,
      action: event.action,
    })
    const timeout = new Promise<{ error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ error: { message: 'timed out' } }), EMIT_TIMEOUT_MS),
    )
    const { error } = await Promise.race([insert, timeout])
    if (error) {
      console.warn(`booking_events insert failed (realtime push skipped): ${error.message}`)
    }
  } catch (err) {
    console.warn('booking_events insert failed (realtime push skipped)', err)
  }
}

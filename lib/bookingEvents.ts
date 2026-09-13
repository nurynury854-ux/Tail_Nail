// Single choke point for the booking_events realtime signal (see
// supabase/checkout_realtime.sql). Every write to `bookings` — create,
// status change, cancel, delete — MUST call this so every open calendar
// (stylist/manager/owner) refetches promptly. A write path that forgets to
// emit this is exactly how a customer's appointment silently fails to show
// up on a stylist's calendar for days: the shared calendar has no polling,
// it only refetches on receiving one of these events.
//
// Best-effort by design: a failure here must never block or fail the
// underlying booking write.

import type { SupabaseClient } from '@supabase/supabase-js'

export type BookingEventAction = 'created' | 'updated' | 'cancelled'

export async function emitBookingEvent(
  admin: SupabaseClient,
  args: { bookingId: string | null | undefined; branchId: string | null | undefined; action: BookingEventAction },
): Promise<void> {
  try {
    await admin.from('booking_events').insert({
      booking_id: args.bookingId ?? null,
      branch_id: args.branchId ?? null,
      action: args.action,
    })
  } catch (err) {
    console.warn('booking_events insert failed (realtime push skipped)', err)
  }
}

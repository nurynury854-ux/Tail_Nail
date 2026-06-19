// Customer-PII visibility rules (role + time gated).
//
// The PII lives in one place (retained permanently for the owner/admin).
// Stylist and manager simply stop receiving it once their timer expires —
// it is never returned to them again, so it is unrecoverable on their side.
// Financial fields are never touched.

import type { CheckoutRole } from './checkoutTypes'

// Taiwan is UTC+8, no DST — anchor all wall-clock times to that offset so the
// "end of business day" / appointment-end instants are correct regardless of
// the server timezone.
const TW_OFFSET = '+08:00'

/** When the service is considered over, for visibility-timer purposes. */
export function computeServiceEndAt(opts: {
  source: 'calendar' | 'manual'
  businessDate: string
  bookingDate?: string | null
  bookingEndTime?: string | null
}): string {
  if (opts.source === 'calendar' && opts.bookingDate && opts.bookingEndTime) {
    const t = opts.bookingEndTime.length === 5 ? `${opts.bookingEndTime}:00` : opts.bookingEndTime
    return `${opts.bookingDate}T${t}${TW_OFFSET}`
  }
  // Manual walk-in: end of that business day (user-chosen rule).
  return `${opts.businessDate}T23:59:59${TW_OFFSET}`
}

export interface CustomerVisibility {
  name: boolean
  phone: boolean
}

/** Decide whether a given role may currently see the customer's name / phone. */
export function customerVisibility(
  role: CheckoutRole,
  serviceEndAt: string | null,
  now: Date = new Date(),
): CustomerVisibility {
  if (role === 'owner') return { name: true, phone: true } // owner = admin, permanent
  const end = serviceEndAt ? new Date(serviceEndAt).getTime() : null

  if (role === 'manager') {
    const ok = end === null ? true : now.getTime() <= end + 24 * 60 * 60 * 1000
    return { name: ok, phone: ok }
  }

  // stylist: phone never; name only until service end.
  return { name: end === null ? true : now.getTime() <= end, phone: false }
}

/** Service-end fallback for a checkout order (older rows may lack the snapshot). */
export function orderServiceEnd(order: { service_end_at?: string | null; business_date?: string | null }): string | null {
  if (order.service_end_at) return order.service_end_at
  if (order.business_date) return `${order.business_date}T23:59:59${TW_OFFSET}`
  return null
}

/** Return a copy of a checkout order with hidden customer fields nulled. */
export function redactOrder<T extends { customer_name?: string | null; customer_phone?: string | null; service_end_at?: string | null; business_date?: string | null }>(
  order: T,
  role: CheckoutRole,
  now?: Date,
): T {
  const vis = customerVisibility(role, orderServiceEnd(order), now)
  return {
    ...order,
    customer_name: vis.name ? order.customer_name ?? null : null,
    customer_phone: vis.phone ? order.customer_phone ?? null : null,
  }
}

/** Return a copy of a booking with hidden customer fields nulled. */
export function redactBooking<T extends { customer_name?: string | null; phone?: string | null; line_id?: string | null; date?: string; end_time?: string }>(
  booking: T,
  role: CheckoutRole,
  now?: Date,
): T {
  const serviceEnd = booking.date
    ? `${booking.date}T${(booking.end_time && booking.end_time.length === 5 ? `${booking.end_time}:00` : booking.end_time) || '23:59:59'}${TW_OFFSET}`
    : null
  const vis = customerVisibility(role, serviceEnd, now)
  return {
    ...booking,
    customer_name: vis.name ? booking.customer_name ?? null : null,
    phone: vis.phone ? booking.phone ?? null : null,
    line_id: vis.name ? booking.line_id ?? null : null,
  }
}

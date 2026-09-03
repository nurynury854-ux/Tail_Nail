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

/** "YYYY-MM-DD" + N months, clamping the day into the target month (no JS rollover). */
function addMonthsToDateString(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const total = (m - 1) + months
  const targetYear = y + Math.floor(total / 12)
  const targetMonth = ((total % 12) + 12) % 12 // 0-11
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
  const targetDay = Math.min(d, daysInTargetMonth)
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
}

/**
 * Decide whether a given role may currently see the customer's name / phone.
 *  - owner:   always (permanent).
 *  - manager: name + phone until 1 full month after the appointment DATE.
 *  - stylist: phone NEVER; name until midnight ending the service DATE, so the
 *             name is available all shift for keying in orders, then destroyed
 *             at 00:00 that night.
 *
 * Manager and stylist are deliberately independent branches, each computing
 * its own cutoff from the appointment date — never share a timer or a
 * deletion function. (Previously the manager branch derived its cutoff from
 * serviceEndAt + 24h, which is *also* about one day — nearly identical to the
 * stylist's same-day-midnight rule, so managers lost customer PII after
 * ~1 day instead of the required 1 month.)
 */
export function customerVisibility(
  role: CheckoutRole,
  serviceEndAt: string | null,
  serviceDate?: string | null,
  now: Date = new Date(),
): CustomerVisibility {
  if (role === 'owner') return { name: true, phone: true } // owner = admin, permanent

  const dateStr = serviceDate || (serviceEndAt ? serviceEndAt.slice(0, 10) : null)

  if (role === 'manager') {
    const cutoff = dateStr ? new Date(`${addMonthsToDateString(dateStr, 1)}T23:59:59${TW_OFFSET}`).getTime() : null
    const ok = cutoff === null ? true : now.getTime() <= cutoff
    return { name: ok, phone: ok }
  }

  // Stylist: phone never; name until midnight at the end of the service date.
  const cutoff = dateStr ? new Date(`${dateStr}T23:59:59${TW_OFFSET}`).getTime() : null
  return { name: cutoff === null ? true : now.getTime() <= cutoff, phone: false }
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
  const vis = customerVisibility(role, orderServiceEnd(order), order.business_date ?? null, now)
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
  const vis = customerVisibility(role, serviceEnd, booking.date ?? null, now)
  return {
    ...booking,
    customer_name: vis.name ? booking.customer_name ?? null : null,
    phone: vis.phone ? booking.phone ?? null : null,
    line_id: vis.name ? booking.line_id ?? null : null,
  }
}

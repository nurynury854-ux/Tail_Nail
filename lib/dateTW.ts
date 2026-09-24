// Business dates are always Taiwan calendar dates. Deriving "today" from
// `new Date().toISOString()` silently gives the UTC date, which is the *previous*
// day between 00:00 and 08:00 Taipei — so an early-morning open would land on
// yesterday. Both sides need Asia/Taipei asked for explicitly: Vercel's servers
// run in UTC, and a phone reports whatever timezone the device is set to.

const TAIPEI_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Today's Taiwan calendar date as YYYY-MM-DD. */
export function taipeiToday(now: Date = new Date()): string {
  const parts = TAIPEI_PARTS.formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** The current Taiwan calendar month as YYYY-MM. */
export function taipeiMonth(now: Date = new Date()): string {
  return taipeiToday(now).slice(0, 7)
}

// ---------------------------------------------------------------------------
// Business day (04:00 cutoff)
//
// The salon day runs 04:00 -> 04:00, not midnight -> midnight: an order rung up
// at 03:00 on Aug 27 belongs to the Aug 26 shift. Only the *grouping* key moves
// — created_at / confirmed_at keep the true clock time for audit.
//
// Every date-based view (總覽, K單, 報表, 對帳) filters on the stored
// `business_date` column, so stamping that column correctly at creation is what
// makes the rule hold everywhere; no query needs to know about the cutoff.
// ---------------------------------------------------------------------------

/** Taipei hour at which a new business day begins. */
export const BUSINESS_DAY_START_HOUR = 4

/**
 * The business day an instant falls in, as YYYY-MM-DD. Taiwan has no DST, so
 * rolling the instant back 4h and asking for its Taipei date is exact.
 */
export function taipeiBusinessDate(now: Date = new Date()): string {
  return taipeiToday(new Date(now.getTime() - BUSINESS_DAY_START_HOUR * 60 * 60 * 1000))
}

/** The business month (YYYY-MM) an instant falls in. */
export function taipeiBusinessMonth(now: Date = new Date()): string {
  return taipeiBusinessDate(now).slice(0, 7)
}

/** The Taiwan calendar date after `date` (YYYY-MM-DD in, YYYY-MM-DD out). */
export function nextTaipeiDate(date: string): string {
  // Anchor at noon so the +24h step can't land on the wrong side of a boundary.
  const noon = new Date(`${date}T12:00:00+08:00`)
  return taipeiToday(new Date(noon.getTime() + 24 * 60 * 60 * 1000))
}

/**
 * The last instant of a business day: 03:59:59 Taipei on the following calendar
 * day. Used for shift-scoped timers (e.g. how long a stylist keeps a customer
 * name) so they expire when the shift really ends, not at midnight mid-shift.
 */
export function businessDayEndAt(businessDate: string): string {
  return `${nextTaipeiDate(businessDate)}T03:59:59+08:00`
}

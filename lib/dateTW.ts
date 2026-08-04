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

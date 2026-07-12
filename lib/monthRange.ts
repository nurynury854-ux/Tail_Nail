// Month bounds for date-column queries.
//
// Do NOT build a month end as `${month}-31` — for a 30-day month (or February)
// that is an invalid date (e.g. 2026-06-31) and Postgres errors on the cast,
// failing the whole query. Use a half-open range instead: [first, nextFirst).

export interface MonthRange {
  start: string // YYYY-MM-01 (inclusive)
  endExclusive: string // first day of the NEXT month (exclusive)
}

/** `month` is 'YYYY-MM'. */
export function monthRange(month: string): MonthRange {
  const [year, m] = month.split('-').map(Number)
  const nextYear = m === 12 ? year + 1 : year
  const nextMonth = m === 12 ? 1 : m + 1
  return {
    start: `${month}-01`,
    endExclusive: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  }
}

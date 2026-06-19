import { Booking, Stylist } from './types'
import { defaultWorkingHoursByDay, timeToMinutes } from './bookingUtils'

export interface WorkingWindow {
  open: number
  close: number
}

type BranchHoursRow = {
  monday_open?: string | null
  monday_close?: string | null
  tuesday_open?: string | null
  tuesday_close?: string | null
  wednesday_open?: string | null
  wednesday_close?: string | null
  thursday_open?: string | null
  thursday_close?: string | null
  friday_open?: string | null
  friday_close?: string | null
  saturday_open?: string | null
  saturday_close?: string | null
  sunday_open?: string | null
  sunday_close?: string | null
}

type BranchOverrideRow = {
  open_time?: string | null
  close_time?: string | null
  is_closed?: boolean
}

type StylistWeeklyRow = {
  day_of_week: number
  start_time?: string | null
  end_time?: string | null
  is_working: boolean
}

type StylistOverrideRow = {
  start_time?: string | null
  end_time?: string | null
  is_off?: boolean
}

const dayColumns = [
  ['sunday_open', 'sunday_close'],
  ['monday_open', 'monday_close'],
  ['tuesday_open', 'tuesday_close'],
  ['wednesday_open', 'wednesday_close'],
  ['thursday_open', 'thursday_close'],
  ['friday_open', 'friday_close'],
  ['saturday_open', 'saturday_close'],
] as const

export function resolveBranchWindow(
  date: Date,
  branchHours?: BranchHoursRow | null,
  dayOverride?: BranchOverrideRow | null
): WorkingWindow | null {
  if (dayOverride?.is_closed) return null

  if (dayOverride?.open_time && dayOverride?.close_time) {
    return {
      open: timeToMinutes(dayOverride.open_time),
      close: timeToMinutes(dayOverride.close_time),
    }
  }

  const day = date.getDay()
  const defaultWindow = defaultWorkingHoursByDay(day)

  if (!branchHours) return defaultWindow

  const [openKey, closeKey] = dayColumns[day]
  const open = branchHours[openKey]
  const close = branchHours[closeKey]

  if (open && close) {
    return { open: timeToMinutes(open), close: timeToMinutes(close) }
  }

  return defaultWindow
}

export function resolveStylistWindow(
  day: number,
  weeklyRows: StylistWeeklyRow[],
  dayOverride?: StylistOverrideRow | null
): WorkingWindow | null {
  if (dayOverride?.is_off) return null

  if (dayOverride?.start_time && dayOverride?.end_time) {
    return {
      open: timeToMinutes(dayOverride.start_time),
      close: timeToMinutes(dayOverride.end_time),
    }
  }

  const weekly = weeklyRows.find((row) => row.day_of_week === day)
  if (!weekly || !weekly.is_working || !weekly.start_time || !weekly.end_time) return null

  return {
    open: timeToMinutes(weekly.start_time),
    close: timeToMinutes(weekly.end_time),
  }
}

export function overlapCountForStylist(
  bookings: Booking[],
  start: number,
  end: number
): number {
  return bookings.filter((booking) => {
    const bStart = timeToMinutes(booking.start_time)
    const bEnd = timeToMinutes(booking.end_time)
    return bStart < end && bEnd > start
  }).length
}

export function getAvailableStylistsForSlot(args: {
  stylists: Stylist[]
  stylistWindows: Record<string, WorkingWindow | null>
  bookingsByStylist: Record<string, Booking[]>
  start: number
  end: number
}): string[] {
  const { stylists, stylistWindows, bookingsByStylist, start, end } = args

  return stylists
    .filter((stylist) => {
      const window = stylistWindows[stylist.id]
      if (!window) return false
      if (start < window.open || end > window.close) return false

      const overlaps = overlapCountForStylist(bookingsByStylist[stylist.id] || [], start, end)
      return overlaps === 0
    })
    .map((stylist) => stylist.id)
}

export function chooseLeastBookedStylist(args: {
  candidateIds: string[]
  bookingsByStylist: Record<string, Booking[]>
}): string | null {
  const { candidateIds, bookingsByStylist } = args
  if (candidateIds.length === 0) return null

  const ranked = [...candidateIds].sort((a, b) => {
    const countA = (bookingsByStylist[a] || []).length
    const countB = (bookingsByStylist[b] || []).length
    if (countA !== countB) return countA - countB
    return a.localeCompare(b)
  })

  return ranked[0] || null
}

// Relative multipliers for the Owner's manual weight nudge. Kept deliberately
// modest so "High" is more likely than "Low" without overwhelming randomness.
export const STYLIST_WEIGHT_MULTIPLIERS = {
  high: 1.5,
  default: 1.0,
  low: 0.67,
} as const

export type StylistWeightSetting = 'high' | 'low' | null | undefined

export function weightMultiplier(weight: StylistWeightSetting): number {
  if (weight === 'high') return STYLIST_WEIGHT_MULTIPLIERS.high
  if (weight === 'low') return STYLIST_WEIGHT_MULTIPLIERS.low
  return STYLIST_WEIGHT_MULTIPLIERS.default
}

/**
 * Picks a stylist for a "no preference" booking using a weighted random draw
 * that blends the Owner's manual weight with same-day load balancing:
 *
 *   score(t) = weightMultiplier(t) / (bookingsToday(t) + 1)
 *   P(t)     = score(t) / Σ score
 *
 * A busier stylist gets lower odds (preserving the old least-booked spirit),
 * while the Owner's High/Low nudge biases the result. When the Owner has set no
 * weights, every stylist with equal load has equal probability. A single
 * candidate is always returned. Returns null only for an empty pool.
 *
 * `rng` is injectable for deterministic testing; defaults to Math.random.
 */
export function chooseWeightedStylist(args: {
  candidateIds: string[]
  bookingsByStylist: Record<string, Booking[]>
  weightByStylist: Record<string, StylistWeightSetting>
  rng?: () => number
}): string | null {
  const { candidateIds, bookingsByStylist, weightByStylist, rng = Math.random } = args
  if (candidateIds.length === 0) return null
  if (candidateIds.length === 1) return candidateIds[0]

  const scored = candidateIds.map((id) => {
    const load = (bookingsByStylist[id] || []).length
    const score = weightMultiplier(weightByStylist[id]) / (load + 1)
    return { id, score }
  })

  const totalScore = scored.reduce((sum, s) => sum + s.score, 0)
  if (totalScore <= 0) {
    // Degenerate guard (shouldn't happen with positive multipliers) — fall back
    // to a uniform pick so we never fail to assign an eligible stylist.
    return candidateIds[Math.floor(rng() * candidateIds.length)] || candidateIds[0]
  }

  let threshold = rng() * totalScore
  for (const s of scored) {
    threshold -= s.score
    if (threshold <= 0) return s.id
  }

  // Floating-point fallthrough safety net.
  return scored[scored.length - 1].id
}
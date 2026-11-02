import type { SupabaseClient } from '@supabase/supabase-js'
import { Booking, SelectedServiceItem, Stylist } from './types'
import { getMinRequiredGrade, stylistMeetsGrade } from './serviceGrades'
import { durationForStylist, StylistRef } from './serviceDurations'
import { minutesToTime, timeToMinutes } from './bookingUtils'
import { buildStylistOverrideMap, effectiveBranchClose, resolveBranchWindow, resolveStylistWindow } from './scheduleUtils'

// The one place that decides whether a stylist can take a booking at a given
// date/time: grade, branch hours, her own hours/leave, her other bookings, and
// the single foot-equipment-per-branch rule. Online booking (POST
// /api/bookings) and admin reassignment both go through it, so the two can
// never disagree about what is bookable.

export type StylistSlotCheck = {
  stylist: Stylist
  ok: boolean
  /** Why she can't take it; unset when ok. */
  reason?: string
  meetsGrade: boolean
  total: number
  items: SelectedServiceItem[]
  endTime: string
}

export type SlotEvaluation =
  | { ok: false; status: number; error: string }
  | {
      ok: true
      branchName: string
      /** False when the branch is closed that day (every check then fails). */
      branchOpen: boolean
      checks: StylistSlotCheck[]
      /** The branch's other confirmed bookings that day. */
      dayBookings: Booking[]
    }

export function enrichServiceDurationsForStylist(args: {
  stylist: StylistRef
  category: 'hand' | 'foot'
  services: SelectedServiceItem[]
}): { total: number; items: SelectedServiceItem[] } {
  const { stylist, category, services } = args

  const items = services.map((item) => ({
    ...item,
    duration_minutes: durationForStylist(item.service_id, category, stylist) ?? item.duration_minutes ?? 120,
    is_pending: false,
  }))

  const total = items.reduce((sum, item) => sum + item.duration_minutes, 0)
  return { total, items }
}

const overlaps = (b: Booking, start: number, end: number) =>
  timeToMinutes(b.start_time) < end && timeToMinutes(b.end_time) > start

export async function evaluateStylistsForSlot(
  db: SupabaseClient,
  args: {
    branchId: string
    date: string
    startTime: string
    category: 'hand' | 'foot'
    services: SelectedServiceItem[]
    /** Only consider this stylist (a customer's 指定, or the admin's pick). */
    stylistId?: string | null
    /** The booking being moved — it must not conflict with itself. */
    excludeBookingId?: string
  },
): Promise<SlotEvaluation> {
  const { branchId, date, startTime, category, services, stylistId, excludeBookingId } = args

  let stylistQuery = db
    .from('stylists')
    .select('id, branch_id, name, bio, is_active, grade, selection_weight')
    .eq('branch_id', branchId)
    .eq('is_active', true)
  if (stylistId) stylistQuery = stylistQuery.eq('id', stylistId)

  const [
    { data: dbBranch, error: branchError },
    { data: branchHours, error: branchHoursError },
    { data: branchOverride, error: branchOverrideError },
    { data: stylistRows, error: stylistError },
    { data: dayRows, error: dayError },
  ] = await Promise.all([
    db.from('branches').select('id, name').eq('id', branchId).maybeSingle(),
    db.from('branch_working_hours').select('*').eq('branch_id', branchId).maybeSingle(),
    db.from('branch_day_overrides').select('*').eq('branch_id', branchId).eq('date', date).maybeSingle(),
    stylistQuery,
    db.from('bookings').select('*').eq('branch_id', branchId).eq('date', date).eq('status', 'confirmed'),
  ])

  const firstError = branchError || branchHoursError || branchOverrideError || stylistError || dayError
  if (firstError) return { ok: false, status: 500, error: firstError.message }
  if (!dbBranch) return { ok: false, status: 400, error: 'Invalid branch' }

  const stylists = (stylistRows || []) as Stylist[]
  const dayBookings = ((dayRows || []) as Booking[]).filter((b) => b.id !== excludeBookingId)
  const requiredGrade = getMinRequiredGrade(services.map((s) => s.service_id), category)

  const stylistIds = stylists.map((s) => s.id)
  const [{ data: weeklyRows, error: weeklyError }, { data: stylistOverrides, error: overridesError }] = stylistIds.length
    ? await Promise.all([
        db.from('stylist_weekly_hours').select('*').in('stylist_id', stylistIds),
        db.from('stylist_day_overrides').select('*').in('stylist_id', stylistIds).eq('date', date),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]
  if (weeklyError || overridesError) {
    return { ok: false, status: 500, error: (weeklyError || overridesError)!.message }
  }

  const weeklyMap: Record<string, Array<{ day_of_week: number; start_time?: string | null; end_time?: string | null; is_working: boolean }>> = {}
  for (const row of weeklyRows || []) {
    if (!weeklyMap[row.stylist_id]) weeklyMap[row.stylist_id] = []
    weeklyMap[row.stylist_id].push(row)
  }
  const overrideMap = buildStylistOverrideMap(stylistOverrides || [])

  const [year, month, dayOfMonth] = date.split('-').map(Number)
  const dateObj = new Date(year, month - 1, dayOfMonth)
  const rawBranchWindow = resolveBranchWindow(dateObj, branchHours, branchOverride)
  const branchWindow = rawBranchWindow ? { open: rawBranchWindow.open, close: effectiveBranchClose(rawBranchWindow) } : null
  const startMin = timeToMinutes(startTime)

  const checks = stylists.map((stylist): StylistSlotCheck => {
    const { total, items } = enrichServiceDurationsForStylist({ stylist, category, services })
    const endMin = startMin + total
    const meetsGrade = stylistMeetsGrade(stylist.grade, requiredGrade)
    const base = { stylist, meetsGrade, total, items, endTime: minutesToTime(endMin) }
    const fail = (reason: string) => ({ ...base, ok: false, reason })

    if (!meetsGrade) return fail(stylist.grade ? '等級不符此服務' : '未設定等級')
    if (!rawBranchWindow || !branchWindow) return fail('分店當日休息')
    if (startMin < branchWindow.open || endMin > branchWindow.close) return fail('超出分店營業時間')

    const w = resolveStylistWindow(dateObj.getDay(), weeklyMap[stylist.id] || [], overrideMap[stylist.id])
    if (!w) return fail('當日休假或未排班')
    // Working until branch close also gets the branch's after-close grace period.
    const close = w.close >= rawBranchWindow.close ? Math.max(w.close, branchWindow.close) : w.close
    if (startMin < w.open || endMin > close) return fail('超出她的上班時間')

    // Foot: one equipment per branch — any overlapping foot booking blocks it.
    // Either way the stylist herself must be free.
    if (category === 'foot' && dayBookings.some((b) => b.category === 'foot' && overlaps(b, startMin, endMin))) {
      return fail('足部設備該時段已被使用')
    }
    if (dayBookings.some((b) => b.stylist_id === stylist.id && overlaps(b, startMin, endMin))) {
      return fail('該時段已有其他預約')
    }
    return { ...base, ok: true }
  })

  return { ok: true, branchName: dbBranch.name, branchOpen: Boolean(rawBranchWindow), checks, dayBookings }
}

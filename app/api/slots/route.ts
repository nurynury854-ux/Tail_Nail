import { NextRequest, NextResponse } from 'next/server'
import { supabase, hasSupabaseConfig } from '@/lib/supabase'
import { BRANCHES, SERVICES, Booking, Stylist, TimeSlot } from '@/lib/types'
import { defaultWorkingHoursByDay, timeToMinutes, minutesToTime } from '@/lib/bookingUtils'
import { getAvailableStylistsForSlot, resolveBranchWindow, resolveStylistWindow } from '@/lib/scheduleUtils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')
  return NextResponse.json(body, { ...init, headers })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id')
  const date = searchParams.get('date') // YYYY-MM-DD
  const serviceId = searchParams.get('service_id')
  const stylistId = searchParams.get('stylist_id')
  const totalDurationParam = searchParams.get('total_duration')
  const category = searchParams.get('category') as 'hand' | 'foot' | null

  if (!branchId || !date) {
    return jsonNoStore({ error: 'Missing required params: branch_id, date' }, { status: 400 })
  }

  const service = serviceId ? SERVICES.find((s) => s.id === serviceId) : null
  const totalDuration = Number(totalDurationParam || service?.duration_minutes || 0)

  if (Number.isNaN(totalDuration) || totalDuration <= 0) {
    return jsonNoStore({ error: 'Invalid branch or duration' }, { status: 400 })
  }

  // Parse date
  const [year, month, day] = date.split('-').map(Number)
  const dateObj = new Date(year, month - 1, day)

  // Compute current Taiwan time so past slots can be greyed out when date is today
  const nowTW = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const todayTW = `${nowTW.getFullYear()}-${String(nowTW.getMonth() + 1).padStart(2, '0')}-${String(nowTW.getDate()).padStart(2, '0')}`
  const nowMinutes = date === todayTW ? nowTW.getHours() * 60 + nowTW.getMinutes() : -1

  if (!hasSupabaseConfig || !supabase) {
    // Fallback path requires branch from the static list for staff_count
    const branch = BRANCHES.find((b) => b.id === branchId)
    if (!branch) return jsonNoStore({ error: 'Invalid branch' }, { status: 400 })
    const fallbackHours = defaultWorkingHoursByDay(dateObj.getDay())
    if (!fallbackHours) return jsonNoStore({ slots: [], source: 'fallback' })

    const safeOpen = Math.max(fallbackHours.open, 11 * 60)
    const LATEST_START = 19 * 60 // 7pm — last slot that can start
    const EFFECTIVE_CLOSE = Math.max(fallbackHours.close, 22 * 60)
    const slots: TimeSlot[] = []
    for (let start = safeOpen; start < EFFECTIVE_CLOSE; start += 60) {
      if (start > LATEST_START) continue
      const end = start + totalDuration
      const fitsInHours = end <= EFFECTIVE_CLOSE
      const isPast = nowMinutes >= 0 && start <= nowMinutes
      const isTooEarlyToday = nowMinutes >= 0 && start < 12 * 60
      slots.push({
        time: minutesToTime(start),
        available: fitsInHours && !isPast && !isTooEarlyToday,
        bookingsCount: 0,
        availableStylists: fitsInHours && !isPast && !isTooEarlyToday ? branch.staff_count : 0,
      })
    }
    return jsonNoStore({ slots, source: 'fallback' })
  }

  try {
    const { data: existingBookings, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('branch_id', branchId)
      .eq('date', date)
      .eq('status', 'confirmed')

    if (bookingError) {
      console.error('Supabase bookings error:', bookingError)
      return jsonNoStore({ error: bookingError.message }, { status: 500 })
    }

    let stylistQuery = supabase
      .from('stylists')
      .select('id, branch_id, name, bio, is_active')
      .eq('branch_id', branchId)
      .eq('is_active', true)

    if (stylistId) {
      stylistQuery = stylistQuery.eq('id', stylistId)
    }

    const [{ data: stylists, error: stylistsError }, { data: branchHours, error: branchHoursError }, { data: branchOverride, error: branchOverrideError }] = await Promise.all([
      stylistQuery,
      supabase.from('branch_working_hours').select('*').eq('branch_id', branchId).maybeSingle(),
      supabase.from('branch_day_overrides').select('*').eq('branch_id', branchId).eq('date', date).maybeSingle(),
    ])

    if (stylistsError || branchHoursError || branchOverrideError) {
      const firstError = stylistsError || branchHoursError || branchOverrideError
      console.error('Supabase schedule dependency error:', firstError)
      return jsonNoStore({ error: firstError?.message || 'Failed to resolve schedule data' }, { status: 500 })
    }

    const activeStylists = (stylists || []) as Stylist[]
    if (activeStylists.length === 0) {
      return jsonNoStore({ slots: [], source: 'database' })
    }

    const rawBranchWindow = resolveBranchWindow(dateObj, branchHours, branchOverride)
    if (!rawBranchWindow) {
      return jsonNoStore({ slots: [], source: 'database' })
    }
    const LATEST_START = 19 * 60 // 7pm — last slot that can start
    // Effective close is always at least 22:30 so services finishing after 9pm aren't blocked.
    // The displayed/stored close time stays as-is (9pm), but the finishing deadline extends to 10:30pm.
    const EFFECTIVE_CLOSE = Math.max(rawBranchWindow.close, 22 * 60)
    const branchWindow = {
      open: Math.max(rawBranchWindow.open, 11 * 60),
      close: EFFECTIVE_CLOSE,
    }

    const stylistIds = activeStylists.map((stylist) => stylist.id)
    const [{ data: weeklyRows, error: weeklyError }, { data: stylistOverrides, error: stylistOverrideError }] = await Promise.all([
      supabase.from('stylist_weekly_hours').select('*').in('stylist_id', stylistIds),
      supabase.from('stylist_day_overrides').select('*').in('stylist_id', stylistIds).eq('date', date),
    ])

    if (weeklyError || stylistOverrideError) {
      const firstError = weeklyError || stylistOverrideError
      console.error('Supabase stylist schedule error:', firstError)
      return jsonNoStore({ error: firstError?.message || 'Failed to resolve stylist schedule' }, { status: 500 })
    }

    const weeklyMap: Record<string, Array<{ day_of_week: number; start_time?: string | null; end_time?: string | null; is_working: boolean }>> = {}
    for (const row of weeklyRows || []) {
      if (!weeklyMap[row.stylist_id]) weeklyMap[row.stylist_id] = []
      weeklyMap[row.stylist_id].push(row)
    }

    const overrideMap: Record<string, { start_time?: string | null; end_time?: string | null; is_off?: boolean }> = {}
    for (const row of stylistOverrides || []) {
      overrideMap[row.stylist_id] = row
    }

    const bookingsByStylist: Record<string, Booking[]> = {}
    for (const booking of (existingBookings || []) as Booking[]) {
      if (!booking.stylist_id) continue
      if (!bookingsByStylist[booking.stylist_id]) bookingsByStylist[booking.stylist_id] = []
      bookingsByStylist[booking.stylist_id].push(booking)
    }

    const day = dateObj.getDay()
    const stylistWindows: Record<string, { open: number; close: number } | null> = {}
    for (const stylist of activeStylists) {
      const w = resolveStylistWindow(day, weeklyMap[stylist.id] || [], overrideMap[stylist.id])
      stylistWindows[stylist.id] = w ? { open: w.open, close: Math.max(w.close, 22 * 60) } : null
    }

    const slots: TimeSlot[] = []
    for (let start = branchWindow.open; start < branchWindow.close; start += 60) {
      if (start > LATEST_START) continue

      // Grey out slots that have passed or are before noon for same-day bookings
      if (nowMinutes >= 0 && (start <= nowMinutes || start < 12 * 60)) {
        slots.push({ time: minutesToTime(start), available: false, bookingsCount: 0, availableStylists: 0 })
        continue
      }

      const end = start + totalDuration

      if (end > branchWindow.close) {
        // Service extends past closing — grey out (applies to 7pm with a very long service)
        slots.push({
          time: minutesToTime(start),
          available: false,
          bookingsCount: 0,
          availableStylists: 0,
        })
        continue
      }

      // Foot services share one piece of equipment per branch — if any foot booking
      // overlaps this slot, the slot is blocked for everyone regardless of stylist.
      if (category === 'foot') {
        const hasFootConflict = (existingBookings || []).some((booking) => {
          if ((booking as Booking & { category?: string }).category !== 'foot') return false
          const bStart = timeToMinutes(booking.start_time)
          const bEnd = timeToMinutes(booking.end_time)
          return bStart < end && bEnd > start
        })
        if (hasFootConflict) {
          slots.push({ time: minutesToTime(start), available: false, bookingsCount: 0, availableStylists: 0 })
          continue
        }
      }

      const availableStylistIds = getAvailableStylistsForSlot({
        stylists: activeStylists,
        stylistWindows,
        bookingsByStylist,
        start,
        end,
      })

      slots.push({
        time: minutesToTime(start),
        available: availableStylistIds.length > 0,
        bookingsCount: (existingBookings || []).filter((booking) => {
          const bStart = timeToMinutes(booking.start_time)
          const bEnd = timeToMinutes(booking.end_time)
          return bStart < end && bEnd > start
        }).length,
        availableStylists: availableStylistIds.length,
        stylistIds: availableStylistIds,
      })
    }

    return jsonNoStore({ slots, source: 'database' })
  } catch (err) {
    console.error('Slots API error:', err)
    return jsonNoStore({ error: 'Failed to fetch availability' }, { status: 500 })
  }
}

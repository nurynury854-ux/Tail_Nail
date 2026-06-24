import { NextRequest, NextResponse } from 'next/server'
import { supabase, hasSupabaseConfig, createAdminClient } from '@/lib/supabase'
import { getBranchLineConfig } from '@/lib/lineConfig'
import { BRANCHES, SERVICES, Booking, SelectedServiceItem, Service, Stylist } from '@/lib/types'
import { getMinRequiredGrade, stylistMeetsGrade } from '@/lib/serviceGrades'
import { UNIVERSAL_DURATIONS } from '@/lib/serviceDurations'
import {
  calculateEndTime,
  defaultWorkingHoursByDay,
  formatSelectedServicesLine,
  generateConfirmationMessage,
  isValidTaiwanMobile,
  minutesToTime,
  timeToMinutes,
} from '@/lib/bookingUtils'
import {
  chooseWeightedStylist,
  getAvailableStylistsForSlot,
  resolveBranchWindow,
  resolveStylistWindow,
} from '@/lib/scheduleUtils'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isAdminRequest } from '@/lib/adminAuth'

type BookingRequestBody = {
  branch_id?: string
  service_id?: string
  stylist_id?: string | null
  customer_name?: string
  line_id?: string
  phone?: string
  selected_services?: SelectedServiceItem[]
  category?: 'hand' | 'foot'
  total_duration?: number
  date?: string
  start_time?: string
  end_time?: string
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  note?: string
  line_source_branch_id?: string | null
}

async function sendLinePushMessage(userId: string, message: string, accessToken: string): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: message }],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`LINE push failed (${response.status}): ${errorBody}`)
  }
}

function normalizeSupabaseError(errorMessage: string): string {
  if (errorMessage.includes('<!DOCTYPE html>')) {
    return 'Supabase configuration looks invalid. Use NEXT_PUBLIC_SUPABASE_URL like https://<project-ref>.supabase.co (not dashboard URL).'
  }
  return errorMessage
}

function validateSupabaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null

  if (url.includes('supabase.com') && url.includes('/dashboard')) {
    return 'NEXT_PUBLIC_SUPABASE_URL is set to a Supabase dashboard URL. Use https://<project-ref>.supabase.co'
  }

  return null
}

function buildLegacySelectedServices(service: Service, category: 'hand' | 'foot'): SelectedServiceItem[] {
  return [
    {
      service_id: service.id,
      service_name: service.name,
      service_type: service.service_type,
      category,
      duration_minutes: service.duration_minutes || 120,
      is_pending: !service.duration_minutes,
    },
  ]
}

function normalizeSelectedServices(raw: unknown): SelectedServiceItem[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Partial<SelectedServiceItem>
      if (!row.service_id || !row.service_type || !row.category) return null
      return {
        service_id: row.service_id,
        service_name: row.service_name,
        service_type: row.service_type,
        category: row.category,
        duration_minutes: Number(row.duration_minutes || 0),
        is_pending: Boolean(row.is_pending),
      } as SelectedServiceItem
    })
    .filter((item): item is SelectedServiceItem => Boolean(item))
}

function enrichServiceDurationsForStylist(args: {
  stylistId: string
  category: 'hand' | 'foot'
  services: SelectedServiceItem[]
}): { total: number; items: SelectedServiceItem[] } {
  const { category, services } = args

  const items = services.map((item) => ({
    ...item,
    duration_minutes: UNIVERSAL_DURATIONS[item.service_id]?.[category] ?? item.duration_minutes ?? 120,
    is_pending: false,
  }))

  const total = items.reduce((sum, item) => sum + item.duration_minutes, 0)
  return { total, items }
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id')
  const date = searchParams.get('date')
  const status = searchParams.get('status')

  if (!hasSupabaseConfig || !supabase) {
    return NextResponse.json([])
  }

  const configError = validateSupabaseUrl()
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 })
  }

  try {
    // PostgREST caps a single response at 1000 rows. Page through with .range()
    // until a short batch comes back so the admin total isn't stuck at 1000.
    // `id` is the final tiebreaker to give a deterministic total order across pages.
    const PAGE_SIZE = 1000
    const buildQuery = () => {
      let query = supabase!
        .from('bookings')
        .select(`
          *,
          branches (id, name, address),
          services (id, name, service_type, is_addon, price),
          stylists (id, name)
        `)
        .order('date', { ascending: false })
        .order('start_time', { ascending: false })
        .order('id', { ascending: false })

      if (branchId) query = query.eq('branch_id', branchId)
      if (date) query = query.eq('date', date)
      if (status) query = query.eq('status', status)
      return query
    }

    const allBookings: unknown[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
      if (error) {
        return NextResponse.json({ error: normalizeSupabaseError(error.message) }, { status: 500 })
      }
      const batch = data || []
      allBookings.push(...batch)
      if (batch.length < PAGE_SIZE) break
    }

    return NextResponse.json(allBookings)
  } catch (err) {
    console.error('GET bookings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!checkRateLimit(`booking-post:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: '提交次數過多，請稍後再試' }, { status: 429 })
  }

  try {
    const body = (await request.json()) as BookingRequestBody
    const {
      branch_id,
      service_id,
      stylist_id,
      customer_name,
      line_id,
      phone,
      category,
      date,
      start_time,
      status,
      note,
      line_source_branch_id,
    } = body

    if (!branch_id || !customer_name || !date || !start_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (typeof customer_name === 'string' && customer_name.trim().length > 50) {
      return NextResponse.json({ error: '姓名不可超過50字' }, { status: 400 })
    }

    if (typeof note === 'string' && note.trim().length > 300) {
      return NextResponse.json({ error: '備註不可超過300字' }, { status: 400 })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: '日期格式錯誤' }, { status: 400 })
    }

    if (!/^\d{2}:\d{2}$/.test(start_time)) {
      return NextResponse.json({ error: '時間格式錯誤' }, { status: 400 })
    }

    const todayTW = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
    const todayStr = `${todayTW.getFullYear()}-${String(todayTW.getMonth() + 1).padStart(2, '0')}-${String(todayTW.getDate()).padStart(2, '0')}`
    if (date < todayStr) {
      return NextResponse.json({ error: '無法預約過去的日期' }, { status: 400 })
    }
    if (date === todayStr) {
      const nowMinutes = todayTW.getHours() * 60 + todayTW.getMinutes()
      const startMinutes = timeToMinutes(start_time)
      if (startMinutes < 12 * 60) {
        return NextResponse.json({ error: '當日預約最早從中午12點開始' }, { status: 400 })
      }
      if (startMinutes <= nowMinutes) {
        return NextResponse.json({ error: '無法預約已過去的時段' }, { status: 400 })
      }
    }

    const bookingCategory = category || 'hand'

    const normalizedSelected = normalizeSelectedServices(body.selected_services)
    const selectedServices = normalizedSelected.length > 0
      ? normalizedSelected
      : service_id
      ? (() => {
          const service = SERVICES.find((s) => s.id === service_id)
          return service ? buildLegacySelectedServices(service, bookingCategory) : []
        })()
      : []

    if (selectedServices.length === 0) {
      return NextResponse.json({ error: '請至少選擇一項服務' }, { status: 400 })
    }

    const hasMain = selectedServices.some((s) => s.service_type === 'main')
    const mainCount = selectedServices.filter((s) => s.service_type === 'main').length
    if (mainCount > 1) {
      return NextResponse.json({ error: '主項目只能選擇一項' }, { status: 400 })
    }
    const hasAddon = selectedServices.some((s) => s.service_type === 'addon')
    if (!hasMain && !hasAddon) {
      return NextResponse.json({ error: '請選擇有效服務組合' }, { status: 400 })
    }

    if (!phone || !isValidTaiwanMobile(phone.trim())) {
      return NextResponse.json({ error: '請輸入正確手機格式：09xxxxxxxx' }, { status: 400 })
    }

    const branch = BRANCHES.find((b) => b.id === branch_id)
    if (!branch) {
      return NextResponse.json({ error: 'Invalid branch' }, { status: 400 })
    }

    const [year, month, dayOfMonth] = date.split('-').map(Number)
    const dateObj = new Date(year, month - 1, dayOfMonth)
    const startMin = timeToMinutes(start_time)

    const defaultTotalDuration = Number(body.total_duration || 0) || selectedServices.reduce((sum, item) => sum + (item.duration_minutes || 0), 0) || 120
    const fallbackEndTime = calculateEndTime(start_time, defaultTotalDuration)

    const normalizedLineId = (line_id || process.env.LINE_DEMO_USER_ID || '').trim()
    const preferredStylistId = stylist_id?.trim() || null
    let assignedStylistId: string | null = preferredStylistId
    let assignedStylistName: string | undefined
    let finalSelected = selectedServices
    let finalTotalDuration = defaultTotalDuration
    let finalEndTime = fallbackEndTime

    if (!hasSupabaseConfig || !supabase) {
      const hours = defaultWorkingHoursByDay(dateObj.getDay())
      if (!hours) {
        return NextResponse.json({ error: '分店當日未營業' }, { status: 400 })
      }

      const endMin = startMin + finalTotalDuration
      const effectiveClose = Math.max(hours.close, 22 * 60)
      if (startMin < hours.open || endMin > effectiveClose) {
        return NextResponse.json({ error: '時段超出營業時間' }, { status: 400 })
      }

      assignedStylistName = preferredStylistId ? undefined : '不指定'
      const serviceLine = formatSelectedServicesLine(finalSelected)

      const confirmationMessage = generateConfirmationMessage({
        customerName: customer_name.trim(),
        branchName: branch.name,
        serviceLine,
        category: bookingCategory,
        date,
        startTime: start_time,
        endTime: finalEndTime,
        phone: phone.trim(),
        stylistName: assignedStylistName,
      })

      let lineNotificationSent = false
      const fallbackLineConfig =
        (line_source_branch_id && line_source_branch_id !== branch_id
          ? getBranchLineConfig(line_source_branch_id)
          : null) || getBranchLineConfig(branch_id)
      if (normalizedLineId && fallbackLineConfig) {
        try {
          await sendLinePushMessage(normalizedLineId, confirmationMessage, fallbackLineConfig.channelAccessToken)
          lineNotificationSent = true
        } catch (err) {
          console.warn('LINE push failed in fallback mode:', err)
        }
      }

      return NextResponse.json(
        {
          id: `DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          branch_id,
          stylist_id: assignedStylistId,
          customer_name: customer_name.trim(),
          line_id: normalizedLineId,
          phone: phone.trim(),
          selected_services: finalSelected,
          category: bookingCategory,
          total_duration: finalTotalDuration,
          date,
          start_time,
          end_time: finalEndTime,
          status: status || 'confirmed',
          note: note?.trim() || null,
          line_notification_sent: lineNotificationSent,
          assigned_stylist_name: assignedStylistName,
        },
        { status: 201 }
      )
    }

    const configError = validateSupabaseUrl()
    if (configError) {
      return NextResponse.json({ error: configError }, { status: 500 })
    }

    const [
      { data: dbBranch, error: branchError },
      { data: branchHours, error: branchHoursError },
      { data: branchOverride, error: branchOverrideError },
    ] = await Promise.all([
      supabase.from('branches').select('id, name').eq('id', branch_id).maybeSingle(),
      supabase.from('branch_working_hours').select('*').eq('branch_id', branch_id).maybeSingle(),
      supabase.from('branch_day_overrides').select('*').eq('branch_id', branch_id).eq('date', date).maybeSingle(),
    ])

    if (branchError || branchHoursError || branchOverrideError) {
      const firstError = branchError || branchHoursError || branchOverrideError
      return NextResponse.json({ error: normalizeSupabaseError(firstError?.message || 'Failed to validate booking') }, { status: 500 })
    }

    if (!dbBranch) {
      return NextResponse.json({ error: 'Invalid branch' }, { status: 400 })
    }

    let stylistQuery = supabase
      .from('stylists')
      .select('id, branch_id, name, bio, is_active, grade, selection_weight')
      .eq('branch_id', branch_id)
      .eq('is_active', true)

    if (preferredStylistId) {
      stylistQuery = stylistQuery.eq('id', preferredStylistId)
    }

    const { data: stylistRows, error: stylistError } = await stylistQuery
    if (stylistError) {
      return NextResponse.json({ error: normalizeSupabaseError(stylistError.message) }, { status: 500 })
    }

    const allStylists = (stylistRows || []) as Stylist[]
    const selectedServiceIds = selectedServices.map((s) => s.service_id)
    const requiredGrade = getMinRequiredGrade(selectedServiceIds, bookingCategory)
    const stylists = allStylists.filter((s) => stylistMeetsGrade(s.grade, requiredGrade))

    if (stylists.length === 0) {
      const noneInDB = allStylists.length === 0
      return NextResponse.json(
        {
          error: preferredStylistId
            ? noneInDB ? '指定美甲師目前不可預約' : '指定美甲師的等級不符合所選服務需求'
            : noneInDB ? '此分店目前無可預約美甲師' : '此分店目前無符合等級需求的美甲師',
        },
        { status: 409 }
      )
    }

    const stylistIds = stylists.map((stylist) => stylist.id)

    const [{ data: weeklyRows, error: weeklyError }, { data: stylistOverrides, error: stylistOverridesError }] = await Promise.all([
      supabase.from('stylist_weekly_hours').select('*').in('stylist_id', stylistIds),
      supabase.from('stylist_day_overrides').select('*').in('stylist_id', stylistIds).eq('date', date),
    ])

    if (weeklyError || stylistOverridesError) {
      const firstError = weeklyError || stylistOverridesError
      return NextResponse.json({ error: normalizeSupabaseError(firstError?.message || 'Failed to resolve stylist schedule') }, { status: 500 })
    }

    const weeklyMap: Record<string, Array<{ day_of_week: number; start_time?: string | null; end_time?: string | null; is_working: boolean }>> = {}
    for (const row of weeklyRows || []) {
      if (!weeklyMap[row.stylist_id]) weeklyMap[row.stylist_id] = []
      weeklyMap[row.stylist_id].push(row)
    }

    const overrideMap: Record<string, { start_time?: string | null; end_time?: string | null; is_off?: boolean }> = {}
    for (const row of stylistOverrides || []) {
      const existing = overrideMap[row.stylist_id]
      // Prefer is_off:true (most restrictive), then prefer rows that actually have times set
      if (!existing || row.is_off || (!existing.is_off && existing.start_time == null && row.start_time != null)) {
        overrideMap[row.stylist_id] = row
      }
    }

    const rawBranchWindow = resolveBranchWindow(dateObj, branchHours, branchOverride)
    if (!rawBranchWindow) {
      return NextResponse.json({ error: '所選日期分店休息' }, { status: 400 })
    }
    const branchWindow = {
      open: rawBranchWindow.open,
      close: Math.max(rawBranchWindow.close, 22 * 60),
    }

    const dayOfWeek = dateObj.getDay()
    const stylistWindows: Record<string, { open: number; close: number } | null> = {}
    for (const stylist of stylists) {
      const w = resolveStylistWindow(dayOfWeek, weeklyMap[stylist.id] || [], overrideMap[stylist.id])
      if (!w) {
        stylistWindows[stylist.id] = null
      } else {
        const effectiveClose = w.close >= rawBranchWindow.close
          ? Math.max(w.close, branchWindow.close)
          : w.close
        stylistWindows[stylist.id] = { open: w.open, close: effectiveClose }
      }
    }

    const availabilityByStylist: Record<string, { total: number; items: SelectedServiceItem[]; endTime: string }> = {}

    for (const stylist of stylists) {
      const durationResult = enrichServiceDurationsForStylist({
        stylistId: stylist.id,
        category: bookingCategory,
        services: selectedServices,
      })

      const endMin = startMin + durationResult.total
      if (startMin < branchWindow.open || endMin > branchWindow.close) {
        continue
      }

      const window = stylistWindows[stylist.id]
      if (!window || startMin < window.open || endMin > window.close) {
        continue
      }

      const endTime = minutesToTime(endMin)

      // Foot services: one equipment per branch — block if any foot booking overlaps.
      // Hand services: per-stylist check — different stylists can work simultaneously.
      let conflictQuery = supabase
        .from('bookings')
        .select('id, stylist_id')
        .eq('branch_id', branch_id)
        .eq('date', date)
        .eq('status', 'confirmed')
        .lt('start_time', endTime)
        .gt('end_time', start_time)

      if (bookingCategory === 'foot') {
        conflictQuery = conflictQuery.eq('category', 'foot')
      } else {
        conflictQuery = conflictQuery.eq('stylist_id', stylist.id)
      }

      const { data: conflicts, error: conflictError } = await conflictQuery

      if (conflictError) {
        return NextResponse.json({ error: normalizeSupabaseError(conflictError.message) }, { status: 500 })
      }

      if ((conflicts || []).length > 0) {
        continue
      }

      // For foot bookings the equipment check above only looks at other foot bookings.
      // Also verify the stylist isn't already occupied by a hand booking in this window.
      if (bookingCategory === 'foot') {
        const { data: stylistConflicts, error: stylistConflictError } = await supabase
          .from('bookings')
          .select('id')
          .eq('branch_id', branch_id)
          .eq('date', date)
          .eq('status', 'confirmed')
          .eq('stylist_id', stylist.id)
          .lt('start_time', endTime)
          .gt('end_time', start_time)

        if (stylistConflictError) {
          return NextResponse.json({ error: normalizeSupabaseError(stylistConflictError.message) }, { status: 500 })
        }

        if ((stylistConflicts || []).length > 0) {
          continue
        }
      }

      availabilityByStylist[stylist.id] = {
        total: durationResult.total,
        items: durationResult.items,
        endTime,
      }
    }

    const availableStylistIds = Object.keys(availabilityByStylist)
    if (availableStylistIds.length === 0) {
      return NextResponse.json({ error: '此時段已無可預約美甲師，請改選其他時間' }, { status: 409 })
    }

    if (!preferredStylistId) {
      const { data: dayBookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('branch_id', branch_id)
        .eq('date', date)
        .eq('status', 'confirmed')

      const bookingsByStylist: Record<string, Booking[]> = {}
      for (const booking of (dayBookings || []) as Booking[]) {
        if (!booking.stylist_id) continue
        if (!bookingsByStylist[booking.stylist_id]) bookingsByStylist[booking.stylist_id] = []
        bookingsByStylist[booking.stylist_id].push(booking)
      }

      const weightByStylist: Record<string, 'high' | 'low' | null | undefined> = {}
      for (const stylist of stylists) {
        weightByStylist[stylist.id] = stylist.selection_weight ?? null
      }

      assignedStylistId = chooseWeightedStylist({
        candidateIds: availableStylistIds,
        bookingsByStylist,
        weightByStylist,
      })
    } else {
      assignedStylistId = preferredStylistId
    }

    if (!assignedStylistId || !availabilityByStylist[assignedStylistId]) {
      return NextResponse.json({ error: '指定美甲師目前無法安排此時段' }, { status: 409 })
    }

    assignedStylistName = stylists.find((stylist) => stylist.id === assignedStylistId)?.name
    finalSelected = availabilityByStylist[assignedStylistId].items
    finalTotalDuration = availabilityByStylist[assignedStylistId].total
    finalEndTime = availabilityByStylist[assignedStylistId].endTime

    const mainService = finalSelected.find((s) => s.service_type === 'main')
    const primaryServiceId = mainService?.service_id ?? finalSelected[0]?.service_id ?? null

    const bookingPayload = {
      branch_id,
      service_id: primaryServiceId,
      customer_name: customer_name.trim(),
      line_id: normalizedLineId,
      phone: phone.trim(),
      selected_services: finalSelected,
      category: bookingCategory,
      total_duration: finalTotalDuration,
      date,
      start_time,
      end_time: finalEndTime,
      stylist_id: assignedStylistId,
      status: status || 'confirmed',
      note: note?.trim() || null,
    }

    const admin = createAdminClient() ?? supabase!

    // Final conflict re-check immediately before insert to close the race window.
    // The earlier check runs during stylist selection (potentially seconds earlier);
    // a concurrent request could have inserted between then and now.
    {
      let finalConflictQuery = admin
        .from('bookings')
        .select('id')
        .eq('branch_id', branch_id)
        .eq('date', date)
        .eq('status', 'confirmed')
        .lt('start_time', finalEndTime)
        .gt('end_time', start_time)

      if (bookingCategory === 'foot') {
        finalConflictQuery = finalConflictQuery.eq('category', 'foot')
      } else {
        finalConflictQuery = finalConflictQuery.eq('stylist_id', assignedStylistId)
      }

      const { data: finalConflicts, error: finalConflictError } = await finalConflictQuery
      if (finalConflictError) {
        return NextResponse.json({ error: normalizeSupabaseError(finalConflictError.message) }, { status: 500 })
      }
      if ((finalConflicts || []).length > 0) {
        return NextResponse.json({ error: '此時段已無可預約美甲師，請改選其他時間' }, { status: 409 })
      }

      // For foot: equipment check above only matches other foot bookings.
      // Also guard against the assigned stylist being busy with a hand booking.
      if (bookingCategory === 'foot') {
        const { data: finalStylistConflicts, error: finalStylistConflictError } = await admin
          .from('bookings')
          .select('id')
          .eq('branch_id', branch_id)
          .eq('date', date)
          .eq('status', 'confirmed')
          .eq('stylist_id', assignedStylistId)
          .lt('start_time', finalEndTime)
          .gt('end_time', start_time)

        if (finalStylistConflictError) {
          return NextResponse.json({ error: normalizeSupabaseError(finalStylistConflictError.message) }, { status: 500 })
        }
        if ((finalStylistConflicts || []).length > 0) {
          return NextResponse.json({ error: '此時段已無可預約美甲師，請改選其他時間' }, { status: 409 })
        }
      }
    }

    const { data, error } = await admin.from('bookings').insert(bookingPayload).select().single()

    if (error) {
      return NextResponse.json({ error: normalizeSupabaseError(error.message) }, { status: 500 })
    }

    const serviceLine = formatSelectedServicesLine(finalSelected)
    const confirmationMessage = generateConfirmationMessage({
      customerName: bookingPayload.customer_name,
      branchName: dbBranch.name,
      serviceLine,
      category: bookingCategory,
      date,
      startTime: start_time,
      endTime: finalEndTime,
      phone: bookingPayload.phone || undefined,
      stylistName: preferredStylistId ? assignedStylistName : undefined,
    })

    const lineConfig = getBranchLineConfig(branch_id)
    // LINE user IDs are scoped per channel. If the customer's userId came from a
    // different branch's OA (cross-branch booking), the confirmation must be sent
    // via that originating channel, not the booked branch's channel.
    const customerLineConfig =
      (line_source_branch_id && line_source_branch_id !== branch_id
        ? getBranchLineConfig(line_source_branch_id)
        : null) || lineConfig
    let lineNotificationSent = false
    if (normalizedLineId && customerLineConfig) {
      try {
        await sendLinePushMessage(normalizedLineId, confirmationMessage, customerLineConfig.channelAccessToken)
        lineNotificationSent = true
      } catch (lineError) {
        console.warn(`Failed to send to customer LINE ID ${normalizedLineId}:`, lineError)
      }
    }

    const businessNotifyId = lineConfig?.notifyTo?.trim()
    if (businessNotifyId && lineConfig) {
      try {
        await sendLinePushMessage(
          businessNotifyId,
          `🆕 新預約\n${bookingPayload.customer_name}｜${dbBranch.name}\n📞 ${bookingPayload.phone}\n${date} ${start_time}-${finalEndTime}\n部位：${bookingCategory === 'hand' ? '手部' : '足部'}\n${serviceLine}\n美甲師：${preferredStylistId ? assignedStylistName : `不指定（系統指定：${assignedStylistName}）`}`,
          lineConfig.channelAccessToken
        )
      } catch (notifyError) {
        console.warn('Business LINE new-booking notify failed:', notifyError)
      }
    }

    return NextResponse.json(
      {
        ...data,
        line_notification_sent: lineNotificationSent,
        assigned_stylist_name: assignedStylistName,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('POST booking error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

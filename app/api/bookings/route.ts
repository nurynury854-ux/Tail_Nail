import { NextRequest, NextResponse } from 'next/server'
import { supabase, hasSupabaseConfig, createAdminClient } from '@/lib/supabase'
import { BRANCHES, SERVICES, Booking, SelectedServiceItem, Service, Stylist } from '@/lib/types'
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
  chooseLeastBookedStylist,
  getAvailableStylistsForSlot,
  resolveBranchWindow,
  resolveStylistWindow,
} from '@/lib/scheduleUtils'

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
}

async function sendLinePushMessage(userId: string, message: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured')
  }

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
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

async function enrichServiceDurationsForStylist(args: {
  stylistId: string
  category: 'hand' | 'foot'
  services: SelectedServiceItem[]
}): Promise<{ total: number; items: SelectedServiceItem[] }> {
  const { stylistId, category, services } = args

  if (!hasSupabaseConfig || !supabase) {
    const items = services.map((item) => ({
      ...item,
      duration_minutes: item.duration_minutes > 0 ? item.duration_minutes : 120,
      is_pending: item.duration_minutes > 0 ? Boolean(item.is_pending) : true,
    }))
    const total = items.reduce((sum, item) => sum + item.duration_minutes, 0)
    return { total, items }
  }

  const ids = services.map((s) => s.service_id)
  const { data, error } = await supabase
    .from('service_durations')
    .select('service_id, duration_minutes')
    .eq('stylist_id', stylistId)
    .eq('category', category)
    .eq('is_pending', false)
    .in('service_id', ids)

  if (error) {
    throw new Error(normalizeSupabaseError(error.message))
  }

  const durationMap = new Map<string, number>()
  for (const row of data || []) {
    if (row.duration_minutes) durationMap.set(row.service_id, row.duration_minutes)
  }

  const items = services.map((item) => {
    const confirmed = durationMap.get(item.service_id)
    const minutes = confirmed ?? item.duration_minutes
    return {
      ...item,
      duration_minutes: minutes,
      is_pending: confirmed === undefined,
    }
  })

  const total = items.reduce((sum, item) => sum + item.duration_minutes, 0)
  return { total, items }
}

export async function GET(request: NextRequest) {
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
    let query = supabase
      .from('bookings')
      .select(`
        *,
        branches (id, name, address),
        services (id, name, service_type, is_addon, price),
        stylists (id, name)
      `)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (branchId) query = query.eq('branch_id', branchId)
    if (date) query = query.eq('date', date)
    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: normalizeSupabaseError(error.message) }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('GET bookings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    } = body

    if (!branch_id || !customer_name || !date || !start_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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
      if (startMin < hours.open || endMin > hours.close) {
        return NextResponse.json({ error: '時段超出營業時間' }, { status: 400 })
      }

      assignedStylistName = preferredStylistId ? undefined : '不指定'
      const serviceLine = formatSelectedServicesLine(finalSelected)

      const confirmationMessage = generateConfirmationMessage({
        customerName: customer_name.trim(),
        branchName: branch.name,
        serviceLine,
        date,
        startTime: start_time,
        endTime: finalEndTime,
        phone: phone.trim(),
        stylistName: assignedStylistName,
      })

      let lineNotificationSent = false
      if (normalizedLineId) {
        try {
          await sendLinePushMessage(normalizedLineId, confirmationMessage)
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
      .select('id, branch_id, name, bio, is_active')
      .eq('branch_id', branch_id)
      .eq('is_active', true)

    if (preferredStylistId) {
      stylistQuery = stylistQuery.eq('id', preferredStylistId)
    }

    const { data: stylistRows, error: stylistError } = await stylistQuery
    if (stylistError) {
      return NextResponse.json({ error: normalizeSupabaseError(stylistError.message) }, { status: 500 })
    }

    const stylists = (stylistRows || []) as Stylist[]
    if (stylists.length === 0) {
      return NextResponse.json(
        { error: preferredStylistId ? '指定美甲師目前不可預約' : '此分店目前無可預約美甲師' },
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
      overrideMap[row.stylist_id] = row
    }

    const branchWindow = resolveBranchWindow(dateObj, branchHours, branchOverride)
    if (!branchWindow) {
      return NextResponse.json({ error: '所選日期分店休息' }, { status: 400 })
    }

    const dayOfWeek = dateObj.getDay()
    const stylistWindows: Record<string, { open: number; close: number } | null> = {}
    for (const stylist of stylists) {
      stylistWindows[stylist.id] = resolveStylistWindow(dayOfWeek, weeklyMap[stylist.id] || [], overrideMap[stylist.id])
    }

    const availabilityByStylist: Record<string, { total: number; items: SelectedServiceItem[]; endTime: string }> = {}

    for (const stylist of stylists) {
      const durationResult = await enrichServiceDurationsForStylist({
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
      const { data: conflicts, error: conflictError } = await supabase
        .from('bookings')
        .select('id, stylist_id')
        .eq('branch_id', branch_id)
        .eq('date', date)
        .eq('status', 'confirmed')
        .eq('stylist_id', stylist.id)
        .lt('start_time', endTime)
        .gt('end_time', start_time)

      if (conflictError) {
        return NextResponse.json({ error: normalizeSupabaseError(conflictError.message) }, { status: 500 })
      }

      if ((conflicts || []).length > 0) {
        continue
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

      assignedStylistId = chooseLeastBookedStylist({
        candidateIds: availableStylistIds,
        bookingsByStylist,
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

    const bookingPayload = {
      branch_id,
      service_id: mainService?.service_id || null,
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
    const { data, error } = await admin.from('bookings').insert(bookingPayload).select().single()

    if (error) {
      return NextResponse.json({ error: normalizeSupabaseError(error.message) }, { status: 500 })
    }

    const serviceLine = formatSelectedServicesLine(finalSelected)
    const confirmationMessage = generateConfirmationMessage({
      customerName: bookingPayload.customer_name,
      branchName: dbBranch.name,
      serviceLine,
      date,
      startTime: start_time,
      endTime: finalEndTime,
      phone: bookingPayload.phone || undefined,
      stylistName: assignedStylistName,
    })

    let lineNotificationSent = false
    if (normalizedLineId) {
      try {
        await sendLinePushMessage(normalizedLineId, confirmationMessage)
        lineNotificationSent = true
      } catch (lineError) {
        console.warn(`Failed to send to customer LINE ID ${normalizedLineId}:`, lineError)
      }
    }

    const businessNotifyId = process.env.LINE_BOOKING_NOTIFY_TO?.trim()
    if (businessNotifyId) {
      try {
        await sendLinePushMessage(
          businessNotifyId,
          `🆕 新預約\n${bookingPayload.customer_name}｜${dbBranch.name}\n${date} ${start_time}-${finalEndTime}\n${serviceLine}\n美甲師：${assignedStylistName || '不指定'}`
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

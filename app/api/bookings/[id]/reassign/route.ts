import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseConfig, createAdminClient } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/adminAuth'
import { emitBookingEvent } from '@/lib/bookingEvents'
import { evaluateStylistsForSlot } from '@/lib/bookingAvailability'
import { buildCandidateBranchIds, lookupOaBranch, sendCustomerPush } from '@/lib/lineNotify'
import { formatSelectedServicesLine, generateChangeMessage, timeToMinutes } from '@/lib/bookingUtils'
import { taipeiToday } from '@/lib/dateTW'
import type { Booking } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const db = createAdminClient()

// Move a confirmed booking to another stylist and/or date/time — e.g. when her
// stylist has left. Every option is judged by the same rules as online
// booking (lib/bookingAvailability), so the admin can't create a booking the
// site itself would have refused.
//
// GET  ?date=YYYY-MM-DD&start_time=HH:MM  → which stylists can take it then (and why not)
// POST { stylist_id, date, start_time, notify }  → apply it

async function loadBooking(id: string) {
  const { data, error } = await db!.from('bookings').select('*').eq('id', id).maybeSingle()
  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) }
  if (!data) return { error: NextResponse.json({ error: '找不到此預約' }, { status: 404 }) }
  const booking = data as Booking
  if (booking.status !== 'confirmed') {
    return { error: NextResponse.json({ error: '只能改派「已確認」的預約' }, { status: 400 }) }
  }
  if (booking.category !== 'hand' && booking.category !== 'foot') {
    return { error: NextResponse.json({ error: '此預約沒有記錄手部／足部，無法判斷可改派的美甲師' }, { status: 400 }) }
  }
  return { booking: booking as Booking & { category: 'hand' | 'foot' } }
}

function validateWhen(date: string, startTime: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '日期格式錯誤'
  if (!/^\d{2}:\d{2}$/.test(startTime)) return '時間格式錯誤'
  const today = taipeiToday()
  if (date < today) return '無法改到過去的日期'
  if (date === today) {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
    if (timeToMinutes(startTime) <= now.getHours() * 60 + now.getMinutes()) return '無法改到已過去的時段'
  }
  return null
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!hasSupabaseConfig || !db) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const loaded = await loadBooking(params.id)
  if ('error' in loaded) return loaded.error
  const { booking } = loaded

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || booking.date
  const startTime = searchParams.get('start_time') || booking.start_time.slice(0, 5)
  const invalid = validateWhen(date, startTime)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const evaluation = await evaluateStylistsForSlot(db, {
    branchId: booking.branch_id,
    date,
    startTime,
    category: booking.category,
    services: booking.selected_services || [],
    excludeBookingId: booking.id,
  })
  if (!evaluation.ok) return NextResponse.json({ error: evaluation.error }, { status: evaluation.status })

  return NextResponse.json({
    date,
    start_time: startTime,
    options: evaluation.checks.map((c) => ({
      stylist_id: c.stylist.id,
      name: c.stylist.name,
      ok: c.ok,
      reason: c.reason ?? null,
      end_time: c.endTime,
      is_current: c.stylist.id === booking.stylist_id,
    })),
  })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!hasSupabaseConfig || !db) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    stylist_id?: string
    date?: string
    start_time?: string
    notify?: boolean
  }
  const stylistId = body.stylist_id?.trim()
  if (!stylistId) return NextResponse.json({ error: '請選擇美甲師' }, { status: 400 })

  const loaded = await loadBooking(params.id)
  if ('error' in loaded) return loaded.error
  const { booking } = loaded

  const date = body.date || booking.date
  const startTime = body.start_time || booking.start_time.slice(0, 5)
  const invalid = validateWhen(date, startTime)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const evaluation = await evaluateStylistsForSlot(db, {
    branchId: booking.branch_id,
    date,
    startTime,
    category: booking.category,
    services: booking.selected_services || [],
    stylistId,
    excludeBookingId: booking.id,
  })
  if (!evaluation.ok) return NextResponse.json({ error: evaluation.error }, { status: evaluation.status })

  const check = evaluation.checks[0]
  if (!check) return NextResponse.json({ error: '此美甲師已停用或不在這間分店' }, { status: 409 })
  if (!check.ok) return NextResponse.json({ error: `${check.stylist.name} 無法安排：${check.reason}` }, { status: 409 })

  const { data: updated, error } = await db
    .from('bookings')
    .update({
      stylist_id: stylistId,
      date,
      start_time: startTime,
      end_time: check.endTime,
      total_duration: check.total,
      selected_services: check.items,
    })
    .eq('id', booking.id)
    .eq('status', 'confirmed')
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: '預約狀態已變更，請重新整理' }, { status: 409 })

  // Calendars only refetch on this signal (see lib/bookingEvents.ts).
  await emitBookingEvent(db, { bookingId: booking.id, branchId: booking.branch_id, action: 'updated' })

  let lineNotificationSent = false
  if (body.notify && booking.line_id) {
    const message = generateChangeMessage({
      branchName: evaluation.branchName,
      serviceLine: formatSelectedServicesLine(check.items),
      date,
      startTime,
      endTime: check.endTime,
      stylistName: check.stylist.name,
    })
    const provenBranchId = await lookupOaBranch(db, booking.id)
    const result = await sendCustomerPush(booking.line_id, message, buildCandidateBranchIds(provenBranchId, booking.branch_id))
    lineNotificationSent = result.sent
    if (!result.sent) {
      console.warn(`Reassign LINE message FAILED for booking ${booking.id}. Tried: ${result.errors.join(' | ')}`)
    }
  }

  return NextResponse.json({ ...updated, line_notification_sent: lineNotificationSent })
}

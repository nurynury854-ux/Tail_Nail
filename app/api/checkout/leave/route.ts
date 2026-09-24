import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { canViewBranch, getCheckoutSession } from '@/lib/checkoutAuth'
import { logOrderEvent } from '@/lib/orderEditLog'
import { taipeiBusinessDate } from '@/lib/dateTW'
import type { CheckoutSession, StylistLeave } from '@/lib/checkoutTypes'

export const runtime = 'nodejs'

// Staff leave (排休) for a store manager's own technicians.
//
// Stored as stylist_day_overrides rows with is_off = true, which is what the
// calendar, the 值日生 rotation and the unassigned-booking draw already read —
// so an entry takes effect across all three the moment it is written. See
// supabase/checkout_leave.sql.
//
// Scoping rule, enforced on every method: a manager's branch comes from their
// SESSION, never from the request. A stylist_id from another branch fails the
// branch check below, so there is no request a manager can craft that reaches
// another store's staff.

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** The branch this request may touch. Managers are pinned to their own. */
function resolveBranchId(session: CheckoutSession, param: string | null): string | null {
  if (session.role === 'owner') return param
  return session.branchId
}

/**
 * Whether the acting session may remove an entry.
 * Kenny (owner) may remove anything. A manager may remove only what a manager
 * created: a NULL created_by_role means the row pre-dates this feature or came
 * from Kenny's /admin panel, so it counts as Kenny's and stays locked.
 */
function canRemove(session: CheckoutSession, createdByRole: string | null | undefined): boolean {
  if (session.role === 'owner') return true
  if (session.role !== 'manager') return false
  return createdByRole === 'manager'
}

/** Confirmed appointments per `stylistId:date`, for the "this day is booked" warning. */
async function bookingCounts(
  admin: ReturnType<typeof createAdminClient>,
  branchId: string,
  from: string,
  to: string,
): Promise<Record<string, number>> {
  if (!admin) return {}
  const { data } = await admin
    .from('bookings')
    .select('stylist_id, date')
    .eq('branch_id', branchId)
    .eq('status', 'confirmed')
    .gte('date', from)
    .lte('date', to)

  const counts: Record<string, number> = {}
  for (const row of data || []) {
    if (!row.stylist_id) continue
    const key = `${row.stylist_id}:${row.date}`
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

// GET /api/checkout/leave?branch_id=&from=&to=
// Owner may name any branch; a manager always gets their own.
export async function GET(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role === 'stylist') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const url = new URL(request.url)
  const branchId = resolveBranchId(session, url.searchParams.get('branch_id'))
  if (!branchId) return NextResponse.json({ error: '缺少分店' }, { status: 400 })
  if (!canViewBranch(session, branchId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const today = taipeiBusinessDate()
  const from = isDateString(url.searchParams.get('from')) ? url.searchParams.get('from')! : today
  const to = isDateString(url.searchParams.get('to')) ? url.searchParams.get('to')! : addDays(from, 59)

  // Start from the branch's technicians, so the query can never return a row
  // belonging to another store even if a stylist row were mis-keyed.
  const { data: stylists, error: stylistError } = await admin
    .from('stylists')
    .select('id, name, is_active')
    .eq('branch_id', branchId)
  if (stylistError) return NextResponse.json({ error: stylistError.message }, { status: 500 })

  const roster = stylists || []
  if (roster.length === 0) return NextResponse.json({ branch_id: branchId, leaves: [] })

  const nameById = new Map(roster.map((s) => [s.id, s.name as string]))

  const { data: rows, error } = await admin
    .from('stylist_day_overrides')
    .select('id, stylist_id, date, reason, is_off, created_by_role, created_by_name')
    .in('stylist_id', Array.from(nameById.keys()))
    .eq('is_off', true)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const counts = await bookingCounts(admin, branchId, from, to)

  const leaves: StylistLeave[] = (rows || []).map((row) => ({
    id: String(row.id),
    stylist_id: row.stylist_id,
    stylist_name: nameById.get(row.stylist_id) || '—',
    branch_id: branchId,
    date: row.date,
    reason: row.reason ?? null,
    created_by_role: (row.created_by_role as StylistLeave['created_by_role']) ?? null,
    created_by_name: row.created_by_name ?? null,
    locked: !canRemove(session, row.created_by_role),
    booking_count: counts[`${row.stylist_id}:${row.date}`] || 0,
  }))

  return NextResponse.json({ branch_id: branchId, leaves })
}

// POST /api/checkout/leave  { branch_id?, stylist_id, date, reason? }
// Marks one technician off for one full day.
export async function POST(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role === 'stylist') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const branchId = resolveBranchId(session, body.branch_id ? String(body.branch_id) : null)
  if (!branchId) return NextResponse.json({ error: '缺少分店' }, { status: 400 })
  if (!canViewBranch(session, branchId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const stylistId = body.stylist_id ? String(body.stylist_id) : ''
  const date = body.date
  if (!stylistId) return NextResponse.json({ error: '請選擇美甲師' }, { status: 400 })
  if (!isDateString(date)) return NextResponse.json({ error: '日期格式錯誤' }, { status: 400 })

  // The scoping gate: the technician must belong to the branch this session may
  // act on. A manager sending another store's stylist_id lands here and stops.
  const { data: stylist } = await admin
    .from('stylists')
    .select('id, name, branch_id, is_active')
    .eq('id', stylistId)
    .eq('branch_id', branchId)
    .maybeSingle()
  if (!stylist) return NextResponse.json({ error: '找不到本店的美甲師' }, { status: 403 })
  if (!stylist.is_active) return NextResponse.json({ error: '該美甲師已停用' }, { status: 400 })

  // An existing row for that day may be one of Kenny's — either his own leave
  // entry or a partial-hours adjustment. A manager must not overwrite either.
  const { data: existing } = await admin
    .from('stylist_day_overrides')
    .select('id, is_off, created_by_role, created_by_name')
    .eq('stylist_id', stylistId)
    .eq('date', date)
    .maybeSingle()

  if (existing && !canRemove(session, existing.created_by_role)) {
    return NextResponse.json(
      { error: existing.is_off ? '該日排休由老闆設定，店長無法修改' : '該日班表由老闆調整過，店長無法覆蓋' },
      { status: 403 },
    )
  }
  if (existing?.is_off) {
    return NextResponse.json({ error: '該美甲師當日已排休' }, { status: 409 })
  }

  const { data, error } = await admin
    .from('stylist_day_overrides')
    .upsert(
      {
        stylist_id: stylistId,
        date,
        is_off: true,
        // A full-day leave carries no window; leaving these set would make
        // resolveStylistWindow read a shift that is supposed to be gone.
        start_time: null,
        end_time: null,
        reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null,
        created_by_role: session.role,
        created_by_account_id: session.accountId === 'owner-bootstrap' ? null : session.accountId,
        created_by_name: session.displayName,
      },
      { onConflict: 'stylist_id,date' },
    )
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Leave does not cancel anything. If the day is already booked the manager
  // has to call those customers, so hand back the count and say so.
  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('stylist_id', stylistId)
    .eq('date', date)
    .eq('status', 'confirmed')
  const bookingCount = count ?? 0

  await logOrderEvent(admin, {
    orderId: null,
    orderIdText: `leave:${stylistId}:${date}`,
    branchId,
    actor: session,
    action: 'leave_add',
    reason:
      `${stylist.name} ${date} 排休` +
      (bookingCount > 0 ? `（當日仍有 ${bookingCount} 筆已確認預約）` : '') +
      (data.reason ? `，原因：${data.reason}` : ''),
  })

  return NextResponse.json({ ...data, stylist_name: stylist.name, booking_count: bookingCount }, { status: 201 })
}

// DELETE /api/checkout/leave?id=
export async function DELETE(request: NextRequest) {
  const session = await getCheckoutSession(request)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role === 'stylist') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const { data: row } = await admin
    .from('stylist_day_overrides')
    .select('id, stylist_id, date, is_off, created_by_role, created_by_name')
    .eq('id', id)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: '找不到該排休' }, { status: 404 })
  if (!row.is_off) return NextResponse.json({ error: '該筆不是排休紀錄' }, { status: 400 })

  const { data: stylist } = await admin
    .from('stylists')
    .select('id, name, branch_id')
    .eq('id', row.stylist_id)
    .maybeSingle()
  if (!stylist) return NextResponse.json({ error: '找不到該美甲師' }, { status: 404 })
  if (!canViewBranch(session, stylist.branch_id)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  if (!canRemove(session, row.created_by_role)) {
    return NextResponse.json({ error: '該日排休由老闆設定，店長無法取消' }, { status: 403 })
  }

  const { error } = await admin.from('stylist_day_overrides').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logOrderEvent(admin, {
    orderId: null,
    orderIdText: `leave:${row.stylist_id}:${row.date}`,
    branchId: stylist.branch_id,
    actor: session,
    action: 'leave_remove',
    reason: `取消 ${stylist.name} ${row.date} 的排休`,
  })

  return NextResponse.json({ success: true })
}

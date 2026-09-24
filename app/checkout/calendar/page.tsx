'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDays, endOfMonth, format, startOfMonth } from 'date-fns'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import type { Branch, Stylist } from '@/lib/types'
import AppointmentCalendar, { CalBooking, CalLeave, categoryLabel } from '@/components/checkout/AppointmentCalendar'
import { useCheckoutSession } from '@/components/checkout/session'
import { useBookingEvents } from '@/lib/useBookingEvents'
import { taipeiMonth } from '@/lib/dateTW'

const STATUS_LABELS: Record<string, string> = {
  confirmed: '已確認',
  pending: '待確認',
  completed: '已完成',
  cancelled: '已取消',
}

// Staff read the clock on the wall, not the one in their phone's settings.
const TW_CLOCK = new Intl.DateTimeFormat('zh-TW', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Taipei',
})

/**
 * The month to show by default: the current month in TAIPEI, not on the device.
 * Anchored at noon on the 1st so no timezone shift can slide it into a
 * neighbouring month.
 */
function currentMonthDate(): Date {
  return new Date(`${taipeiMonth()}-01T12:00:00`)
}

/** A failed load, carrying the status so an expired session can be told apart. */
class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export default function CalendarPage() {
  const { session, loading: sessionLoading } = useCheckoutSession()
  const router = useRouter()

  const [month, setMonth] = useState(currentMonthDate)
  const [branches, setBranches] = useState<Branch[]>([])
  const [stylists, setStylists] = useState<Stylist[]>([])
  const [branchId, setBranchId] = useState('')
  const [stylistId, setStylistId] = useState('')
  const [allBookings, setAllBookings] = useState<CalBooking[]>([])
  const [selected, setSelected] = useState<CalBooking | null>(null)
  const [leaves, setLeaves] = useState<CalLeave[]>([])
  const [importing, setImporting] = useState(false)
  // 整店 = whole branch (all stylists) | 個人 = one selected stylist.
  const [view, setView] = useState<'branch' | 'individual'>('branch')
  // When the calendar on screen was last confirmed current.
  const [syncedAt, setSyncedAt] = useState<Date | null>(null)
  const [expired, setExpired] = useState(false)

  const role = session?.role
  const canToggleView = role === 'owner' || role === 'manager'
  const branchView = canToggleView && view === 'branch'

  // The checkout session is a 12-hour cookie. It is renewed whenever someone
  // comes back to the tab (/api/checkout/me), but a device nobody touches for
  // that long still reaches the end of it — and a calendar left open overnight
  // is exactly that device. Catch both routes to it: this page's own fetch
  // coming back 401, and the session provider's re-check clearing the session.
  const loggedOut = !sessionLoading && !session
  const sessionEnded = loggedOut || expired

  // Load the filter option lists. Fetch ALL stylists (active=false) so branch view
  // can still name an inactive stylist who has bookings.
  useEffect(() => {
    if (role === 'owner') {
      fetch('/api/branches').then((r) => (r.ok ? r.json() : [])).then(setBranches).catch(() => {})
    } else if (role === 'manager' && session?.branchId) {
      fetch(`/api/stylists?branch_id=${session.branchId}&active=false`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setStylists)
        .catch(() => {})
    }
  }, [role, session?.branchId])

  // Owner: repopulate stylists when the branch changes.
  useEffect(() => {
    if (role !== 'owner' || !branchId) {
      if (role === 'owner') setStylists([])
      return
    }
    setStylistId('')
    fetch(`/api/stylists?branch_id=${branchId}&active=false`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setStylists)
      .catch(() => {})
  }, [role, branchId])

  // The branch a manager/owner is viewing (a stylist uses their own scope).
  const activeBranchId = role === 'owner' ? branchId : role === 'manager' ? session?.branchId ?? '' : ''

  // 整店 fetches the whole branch (scoped by each booking's own branch_id —
  // "what's physically happening at this store"). 個人 fetches that one
  // person's full schedule directly by stylist_id instead of deriving it by
  // filtering the branch fetch: a booking's branch_id is a permanent
  // creation-time snapshot, so after a stylist transfers between branches it
  // no longer matches her current branch, and deriving 個人 from a
  // branch-scoped fetch used to silently hide her pre-transfer appointments
  // from the owner/manager even though her own stylist-role view (always
  // stylist_id-scoped) showed them fine.
  //
  // load() also runs unattended (realtime push, tab focus, poll), so it must
  // never blank the calendar on a transient failure, and a slow older response
  // must not overwrite a newer one. Only a failure for a DIFFERENT scope than
  // what's on screen clears it — never leave another filter's rows up.
  const loadSeq = useRef(0)
  const shownKey = useRef('')
  // A failed fetch must never look identical to "you have no appointments" —
  // that's exactly how an unlinked/misconfigured stylist account (backend
  // returns a clear 409 with a real message) went unnoticed as "完全沒上系統"
  // until someone thought to check the network tab. Surface it plainly
  // instead of swallowing it into an empty calendar.
  const [loadError, setLoadError] = useState<string | null>(null)
  const load = useCallback(async () => {
    // No session yet (first paint) or no longer one: leave the screen to the
    // logged-out effect below rather than falling through to "nothing selected".
    if (!role) return

    const params = new URLSearchParams({ month: format(month, 'yyyy-MM') })
    if (role === 'stylist') {
      // no params — the API self-scopes to their own stylist_id.
    } else if (branchView) {
      if (!activeBranchId) {
        setAllBookings([])
        setLoadError(null)
        shownKey.current = ''
        return
      }
      params.set('branch_id', activeBranchId)
    } else {
      if (!stylistId) {
        setAllBookings([])
        setLoadError(null)
        shownKey.current = ''
        return
      }
      params.set('stylist_id', stylistId)
    }
    const key = params.toString()
    const seq = ++loadSeq.current
    try {
      const res = await fetch(`/api/checkout/bookings?${key}`, { cache: 'no-store' })
      if (seq !== loadSeq.current) return
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new ApiError(res.status, body.error || `讀取行事曆失敗（HTTP ${res.status}）`)
      }
      const rows = await res.json()
      if (seq !== loadSeq.current) return
      setAllBookings(Array.isArray(rows) ? rows : [])
      setLoadError(null)
      setExpired(false)
      setSyncedAt(new Date())
      shownKey.current = key
    } catch (err) {
      if (seq !== loadSeq.current) return
      if (err instanceof ApiError && err.status === 401) {
        // Session gone. Every refetch from here on 401s too, so without this the
        // page sits on its last snapshot looking perfectly healthy and days out
        // of date. Customer names on screen — grid and open detail panel alike —
        // were released to a role that no longer holds, so they go with it.
        setExpired(true)
        setLoadError(null)
        setAllBookings([])
        setSelected(null)
        shownKey.current = ''
        return
      }
      setLoadError(err instanceof Error ? err.message : '讀取行事曆失敗')
      if (shownKey.current !== key) {
        setAllBookings([])
        shownKey.current = ''
      }
    }
  }, [month, role, activeBranchId, branchView, stylistId])

  // Full-day leave for the visible grid, so a thin day reads as "she's off"
  // rather than "nobody booked". Owner/manager only: the leave API does not
  // serve technicians. Padded a week each side to cover the grid's spill days.
  const loadLeaves = useCallback(async () => {
    if (role !== 'owner' && role !== 'manager') {
      setLeaves([])
      return
    }
    if (!activeBranchId) {
      setLeaves([])
      return
    }
    const params = new URLSearchParams({
      branch_id: activeBranchId,
      from: format(addDays(startOfMonth(month), -7), 'yyyy-MM-dd'),
      to: format(addDays(endOfMonth(month), 7), 'yyyy-MM-dd'),
    })
    try {
      const res = await fetch(`/api/checkout/leave?${params}`, { cache: 'no-store' })
      if (!res.ok) return // non-fatal: the appointments still render
      const data = await res.json()
      setLeaves(
        ((data.leaves || []) as Array<{ date: string; stylist_id: string; stylist_name: string }>).map((l) => ({
          date: l.date,
          stylist_id: l.stylist_id,
          stylist_name: l.stylist_name,
        })),
      )
    } catch {
      /* non-fatal */
    }
  }, [role, activeBranchId, month])

  useEffect(() => {
    loadLeaves()
  }, [loadLeaves])

  // The session provider re-checks on focus/visibility; if it comes back empty,
  // the rows on screen are PII nobody is currently entitled to.
  useEffect(() => {
    if (loggedOut) {
      setAllBookings([])
      setSelected(null)
      shownKey.current = ''
    }
  }, [loggedOut])

  useEffect(() => {
    load()
  }, [load])

  // The displayed month is picked once, at mount. A phone left open on the
  // calendar for a week would otherwise still be showing the month it was
  // opened in, with every new appointment landing outside the grid — so unless
  // the user navigated somewhere deliberately, roll forward with the date.
  const followsToday = useRef(true)
  const changeMonth = useCallback((m: Date) => {
    // Navigating back to the current month resumes following it.
    followsToday.current = format(m, 'yyyy-MM') === taipeiMonth()
    setMonth(m)
  }, [])
  const refresh = useCallback(() => {
    if (followsToday.current) {
      const now = currentMonthDate()
      setMonth((prev) => (format(prev, 'yyyy-MM') === format(now, 'yyyy-MM') ? prev : now))
    }
    load()
    loadLeaves()
  }, [load, loadLeaves])

  // Realtime + fallbacks: re-fetch on every booking_events push, on websocket
  // reconnect, when the phone wakes up, and on a slow safety-net poll — see
  // useBookingEvents. 整店 data is branch-scoped, so watch that branch. 個人
  // and a stylist's own view are stylist-scoped and can span branches after a
  // transfer, so watch every branch (the signal rows are tiny and PII-free).
  const watchBranchId =
    role === 'stylist' ? null : branchView ? activeBranchId || undefined : stylistId ? null : undefined
  const liveStatus = useBookingEvents(watchBranchId, refresh)

  // allBookings is already scoped correctly by load() above for whichever
  // view is active, so it can be rendered as-is.
  const displayed = allBookings

  // Whether we have enough selections to render the calendar.
  const ready =
    !sessionEnded &&
    (branchView
      ? role === 'manager' || (role === 'owner' && !!branchId)
      : role === 'stylist' ||
        (role === 'manager' && !!stylistId) ||
        (role === 'owner' && !!branchId && !!stylistId))

  const branchName = useMemo(() => branches.find((b) => b.id === branchId)?.name, [branches, branchId])
  const stylistName = useMemo(
    () => (role === 'stylist' ? session?.displayName : stylists.find((s) => s.id === stylistId)?.name),
    [role, session?.displayName, stylists, stylistId],
  )
  // Branch view labels each entry with its stylist.
  const stylistNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of stylists) map[s.id] = s.name
    return map
  }, [stylists])

  const importBooking = async () => {
    if (!selected) return
    setImporting(true)
    try {
      const res = await fetch('/api/checkout/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'calendar', booking_id: selected.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '匯入失敗')
        return
      }
      toast.success('已匯入結帳')
      router.push(`/checkout/orders/${data.id}`)
    } finally {
      setImporting(false)
    }
  }

  const cancelBooking = async () => {
    if (!selected) return
    if (!confirm('確定取消此預約？')) return
    const reason = prompt('取消原因（選填）') || ''
    const id = selected.id
    const prevStatus = selected.status

    // Instant: flip the entry to 已取消 in place the moment it's confirmed — no
    // waiting on the round-trip. Both 整店 and 個人 are slices of this same array,
    // so they update in the same render.
    setAllBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)))
    setSelected(null)

    try {
      const res = await fetch(`/api/checkout/bookings/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (res.ok) {
        // Say plainly whether the customer was reached. A push only lands through
        // an OA they've added as a friend, so it can fail even when the
        // cancellation itself succeeded — the store needs to know to call them.
        const data = await res.json().catch(() => ({}))
        if (data.line_notification_sent) {
          toast.success('已取消預約，並已通知客人')
        } else {
          toast('已取消預約，但 LINE 通知未送達，請自行聯繫客人', { icon: '⚠️' })
        }
        return
      }
      const e = await res.json().catch(() => ({}))
      toast.error(e.error || '取消失敗')
    } catch {
      toast.error('取消失敗')
    }
    // Failed — put it back so the calendar never shows a cancellation that didn't happen.
    setAllBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: prevStatus } : b)))
  }

  const selectCls = 'rounded-lg border border-blush px-3 py-2 text-sm'

  return (
    <div className="space-y-4">
      <h1 className="font-playfair text-2xl text-charcoal">行事曆</h1>

      {/* An expired session used to be invisible here: pushes kept arriving,
          every refetch came back 401, and the page kept showing yesterday.
          Say it outright and give them the way back. */}
      {sessionEnded && (
        <div className="rounded-xl border border-rose bg-rose/10 px-4 py-3 space-y-2">
          <p className="text-sm font-semibold text-charcoal">登入已過期，行事曆已停止更新</p>
          <p className="text-xs text-warmgray">
            為保護客人資料，登入僅維持 12 小時。重新登入後即可看到最新預約。
          </p>
          <a
            href="/checkout/login"
            className="inline-block rounded-lg bg-rose px-4 py-2 text-sm font-semibold text-white"
          >
            重新登入
          </a>
        </div>
      )}

      {/* View toggle + filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {canToggleView && (
          <div className="inline-flex rounded-lg border border-blush overflow-hidden">
            {(['branch', 'individual'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 text-sm ${view === v ? 'bg-rose text-white' : 'bg-white text-charcoal'}`}
              >
                {v === 'branch' ? '整店' : '個人'}
              </button>
            ))}
          </div>
        )}

        {role === 'owner' && (
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectCls}>
            <option value="">— 選擇分店 —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        {/* Stylist selector only in 個人 view — 整店 shows every stylist. */}
        {canToggleView && !branchView && (
          <select
            value={stylistId}
            onChange={(e) => setStylistId(e.target.value)}
            className={selectCls}
            disabled={role === 'owner' && !branchId}
          >
            <option value="">— 選擇美甲師 —</option>
            {stylists.filter((s) => s.is_active).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {!sessionEnded && loadError && (
        <p className="text-sm text-rose-dark bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">
          ⚠️ {loadError}
        </p>
      )}

      {ready ? (
        <>
          <AppointmentCalendar
            month={month}
            bookings={displayed}
            onMonthChange={changeMonth}
            onSelect={setSelected}
            branchName={role === 'owner' ? branchName : undefined}
            stylistName={branchView ? '整店' : stylistName}
            stylistNames={branchView ? stylistNames : undefined}
            leaves={branchView ? leaves : leaves.filter((l) => l.stylist_id === stylistId)}
          />
          {/* "Live" and "a minute behind" look identical on screen, and nobody
              is reading a console on a phone — so state which one this is. */}
          <p className="text-xs text-warmgray text-center">
            {liveStatus === 'live'
              ? '● 即時更新中'
              : liveStatus === 'polling'
                ? '○ 自動更新（每分鐘）'
                : '○ 連線中…'}
            {syncedAt ? `・上次更新 ${TW_CLOCK.format(syncedAt)}` : ''}
          </p>
        </>
      ) : sessionEnded ? null : (
        <p className="text-warmgray text-sm">
          {branchView
            ? '請先選擇分店以顯示整店行事曆。'
            : role === 'owner'
              ? '請先選擇分店與美甲師以顯示行事曆。'
              : '請先選擇美甲師以顯示行事曆。'}
        </p>
      )}

      {/* Appointment detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-medium" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-playfair text-lg text-charcoal">預約明細</h2>
              <button onClick={() => setSelected(null)} className="text-warmgray hover:text-rose-dark"><X size={18} /></button>
            </div>
            <div className="space-y-2 text-sm">
              {/* 部位 and 服務 lead the panel — they are what the technician needs
                  first, not a detail to hunt for at the bottom. */}
              <Row label="部位" value={categoryLabel(selected.category) || '未指定'} emphasis />
              <Row label="服務" value={(selected.selected_services || []).map((s) => s.service_name || s.service_id).join('、') || '—'} emphasis />
              {branchView && selected.stylist_id && stylistNames[selected.stylist_id] && (
                <Row label="美甲師" value={stylistNames[selected.stylist_id]} />
              )}
              <Row label="客戶" value={selected.customer_name || '—'} />
              {selected.phone && <Row label="電話" value={selected.phone} />}
              <Row label="時間" value={`${selected.date} ${selected.start_time}`} />
              <Row label="預估時長" value={selected.total_duration ? `${selected.total_duration} 分鐘` : '—'} />
              <Row label="狀態" value={STATUS_LABELS[selected.status] || selected.status} />
            </div>
            {selected.status === 'cancelled' ? (
              <p className="mt-4 w-full text-center text-warmgray text-sm py-2.5 bg-warmgray/10 rounded-lg">
                此預約已取消，無法結帳
              </p>
            ) : (
              <>
                <button
                  onClick={importBooking}
                  disabled={importing}
                  className="mt-4 w-full bg-rose text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {importing ? '匯入中...' : '匯入結帳'}
                </button>
                {/* Managers (own store) and the owner can cancel appointments. */}
                {(role === 'manager' || role === 'owner') && (
                  <button
                    onClick={cancelBooking}
                    className="mt-2 w-full border border-rose text-rose-dark py-2.5 rounded-lg font-semibold hover:bg-rose/5"
                  >
                    取消預約
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-warmgray shrink-0">{label}</span>
      <span className={`text-right ${emphasis ? 'text-charcoal font-semibold' : 'text-charcoal'}`}>{value}</span>
    </div>
  )
}

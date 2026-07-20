'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import type { Branch, Stylist } from '@/lib/types'
import AppointmentCalendar, { CalBooking } from '@/components/checkout/AppointmentCalendar'
import { useCheckoutSession } from '@/components/checkout/session'
import { supabase } from '@/lib/supabase'

const STATUS_LABELS: Record<string, string> = {
  confirmed: '已確認',
  pending: '待確認',
  completed: '已完成',
  cancelled: '已取消',
}

export default function CalendarPage() {
  const { session } = useCheckoutSession()
  const router = useRouter()

  const [month, setMonth] = useState(() => new Date())
  const [branches, setBranches] = useState<Branch[]>([])
  const [stylists, setStylists] = useState<Stylist[]>([])
  const [branchId, setBranchId] = useState('')
  const [stylistId, setStylistId] = useState('')
  const [allBookings, setAllBookings] = useState<CalBooking[]>([])
  const [selected, setSelected] = useState<CalBooking | null>(null)
  const [importing, setImporting] = useState(false)
  // 整店 = whole branch (all stylists) | 個人 = one selected stylist.
  const [view, setView] = useState<'branch' | 'individual'>('branch')

  const role = session?.role
  const canToggleView = role === 'owner' || role === 'manager'
  const branchView = canToggleView && view === 'branch'

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

  // Both views are slices of ONE fetch: always pull the WHOLE branch (never a
  // per-stylist query). The individual view is that same data filtered to one
  // stylist client-side, so it can only ever be a subset of the branch view —
  // the two can never diverge, regardless of transfers or timing.
  const load = useCallback(async () => {
    const params = new URLSearchParams({ month: format(month, 'yyyy-MM') })
    if (role !== 'stylist') {
      if (!activeBranchId) {
        setAllBookings([])
        return
      }
      params.set('branch_id', activeBranchId)
    }
    // stylist: no branch param — the API self-scopes to their own stylist_id.
    const res = await fetch(`/api/checkout/bookings?${params.toString()}`, { cache: 'no-store' })
    setAllBookings(res.ok ? await res.json() : [])
  }, [month, role, activeBranchId])

  // Latest load() without making the websocket resubscribe on every change.
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  }, [load])

  useEffect(() => {
    load()
  }, [load])

  // Realtime: the server writes a PII-free row to booking_events on every change,
  // and Supabase pushes it over a websocket. On arrival we re-fetch through the
  // redacting API — so other devices update instantly without polling, and no
  // customer data ever travels over the socket.
  const watchBranchId = role === 'stylist' ? session?.branchId ?? '' : activeBranchId
  useEffect(() => {
    if (!supabase || !watchBranchId) return
    const channel = supabase
      .channel(`booking-events-${watchBranchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'booking_events', filter: `branch_id=eq.${watchBranchId}` },
        () => {
          loadRef.current()
        },
      )
      .subscribe()
    return () => {
      supabase?.removeChannel(channel)
    }
  }, [watchBranchId])

  // 整店 shows the whole branch; 個人 is the identical data filtered to one stylist.
  const displayed = useMemo(() => {
    if (role === 'stylist' || branchView) return allBookings
    return stylistId ? allBookings.filter((b) => b.stylist_id === stylistId) : []
  }, [allBookings, role, branchView, stylistId])

  // Whether we have enough selections to render the calendar.
  const ready = branchView
    ? role === 'manager' || (role === 'owner' && !!branchId)
    : role === 'stylist' ||
      (role === 'manager' && !!stylistId) ||
      (role === 'owner' && !!branchId && !!stylistId)

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
        toast.success('已取消預約')
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

      {ready ? (
        <AppointmentCalendar
          month={month}
          bookings={displayed}
          onMonthChange={setMonth}
          onSelect={setSelected}
          branchName={role === 'owner' ? branchName : undefined}
          stylistName={branchView ? '整店' : stylistName}
          stylistNames={branchView ? stylistNames : undefined}
        />
      ) : (
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
              {branchView && selected.stylist_id && stylistNames[selected.stylist_id] && (
                <Row label="美甲師" value={stylistNames[selected.stylist_id]} />
              )}
              <Row label="客戶" value={selected.customer_name || '—'} />
              {selected.phone && <Row label="電話" value={selected.phone} />}
              <Row label="服務" value={(selected.selected_services || []).map((s) => s.service_name || s.service_id).join('、') || '—'} />
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-warmgray shrink-0">{label}</span>
      <span className="text-charcoal text-right">{value}</span>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import type { Branch, Stylist } from '@/lib/types'
import AppointmentCalendar, { CalBooking } from '@/components/checkout/AppointmentCalendar'
import { useCheckoutSession } from '@/components/checkout/session'

const STATUS_LABELS: Record<string, string> = {
  confirmed: '已確認',
  pending: '待確認',
  completed: '已完成',
}

export default function CalendarPage() {
  const { session } = useCheckoutSession()
  const router = useRouter()

  const [month, setMonth] = useState(() => new Date())
  const [branches, setBranches] = useState<Branch[]>([])
  const [stylists, setStylists] = useState<Stylist[]>([])
  const [branchId, setBranchId] = useState('')
  const [stylistId, setStylistId] = useState('')
  const [bookings, setBookings] = useState<CalBooking[]>([])
  const [selected, setSelected] = useState<CalBooking | null>(null)
  const [importing, setImporting] = useState(false)

  const role = session?.role

  // Load the filter option lists.
  useEffect(() => {
    if (role === 'owner') {
      fetch('/api/branches').then((r) => (r.ok ? r.json() : [])).then(setBranches).catch(() => {})
    } else if (role === 'manager' && session?.branchId) {
      fetch(`/api/stylists?branch_id=${session.branchId}&active=true`)
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
    fetch(`/api/stylists?branch_id=${branchId}&active=true`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setStylists)
      .catch(() => {})
  }, [role, branchId])

  // Do we have enough filter selections to render a calendar?
  const ready =
    role === 'stylist' ||
    (role === 'manager' && !!stylistId) ||
    (role === 'owner' && !!branchId && !!stylistId)

  const load = useCallback(async () => {
    if (!ready) return
    const params = new URLSearchParams({ month: format(month, 'yyyy-MM') })
    if (role === 'owner') {
      params.set('branch_id', branchId)
      params.set('stylist_id', stylistId)
    } else if (role === 'manager') {
      params.set('stylist_id', stylistId)
    }
    const res = await fetch(`/api/checkout/bookings?${params.toString()}`, { cache: 'no-store' })
    setBookings(res.ok ? await res.json() : [])
  }, [ready, month, role, branchId, stylistId])

  useEffect(() => {
    load()
  }, [load])

  const branchName = useMemo(() => branches.find((b) => b.id === branchId)?.name, [branches, branchId])
  const stylistName = useMemo(
    () => (role === 'stylist' ? session?.displayName : stylists.find((s) => s.id === stylistId)?.name),
    [role, session?.displayName, stylists, stylistId],
  )

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

  const selectCls = 'rounded-lg border border-blush px-3 py-2 text-sm'

  return (
    <div className="space-y-4">
      <h1 className="font-playfair text-2xl text-charcoal">行事曆</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {role === 'owner' && (
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectCls}>
            <option value="">— 選擇分店 —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        {(role === 'owner' || role === 'manager') && (
          <select
            value={stylistId}
            onChange={(e) => setStylistId(e.target.value)}
            className={selectCls}
            disabled={role === 'owner' && !branchId}
          >
            <option value="">— 選擇美甲師 —</option>
            {stylists.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {ready ? (
        <AppointmentCalendar
          month={month}
          bookings={bookings}
          onMonthChange={setMonth}
          onSelect={setSelected}
          branchName={role === 'owner' ? branchName : undefined}
          stylistName={stylistName}
        />
      ) : (
        <p className="text-warmgray text-sm">
          {role === 'owner' ? '請先選擇分店與美甲師以顯示行事曆。' : '請先選擇美甲師以顯示行事曆。'}
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
              <Row label="客戶" value={selected.customer_name || '—'} />
              {selected.phone && <Row label="電話" value={selected.phone} />}
              <Row label="服務" value={(selected.selected_services || []).map((s) => s.service_name || s.service_id).join('、') || '—'} />
              <Row label="時間" value={`${selected.date} ${selected.start_time}`} />
              <Row label="預估時長" value={selected.total_duration ? `${selected.total_duration} 分鐘` : '—'} />
              <Row label="狀態" value={STATUS_LABELS[selected.status] || selected.status} />
            </div>
            <button
              onClick={importBooking}
              disabled={importing}
              className="mt-4 w-full bg-rose text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {importing ? '匯入中...' : '匯入結帳'}
            </button>
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

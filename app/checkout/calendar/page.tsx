'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const todayStr = () => new Date().toISOString().slice(0, 10)

interface CalBooking {
  id: string
  customer_name: string
  phone?: string | null
  start_time: string
  end_time: string
  category?: string | null
  selected_services?: Array<{ service_id: string; service_name?: string }>
}

export default function CalendarImportPage() {
  const router = useRouter()
  const [date, setDate] = useState(todayStr())
  const [bookings, setBookings] = useState<CalBooking[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/checkout/bookings?date=${date}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setBookings)
      .catch(() => setBookings([]))
      .finally(() => setLoading(false))
  }, [date])

  const importBooking = async (b: CalBooking) => {
    setBusyId(b.id)
    try {
      const res = await fetch('/api/checkout/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'calendar', booking_id: b.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '匯入失敗')
        return
      }
      toast.success('已匯入，請確認金額後送出')
      router.push(`/checkout/orders/${data.id}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-playfair text-2xl text-charcoal">行事曆匯入</h1>
      <p className="text-sm text-warmgray">點選預約即可帶入客戶與服務項目，價格依服務單價自動帶入。</p>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-lg border border-blush px-3 py-2 text-sm"
      />

      {loading ? (
        <p className="text-warmgray">載入中...</p>
      ) : bookings.length === 0 ? (
        <p className="text-warmgray">此日期沒有預約</p>
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="rounded-xl border border-blush bg-white p-4 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-charcoal font-semibold">
                  {b.start_time}–{b.end_time}・{b.customer_name}
                </p>
                <p className="text-xs text-warmgray">
                  {(b.selected_services || []).map((s) => s.service_name || s.service_id).join('、') || '—'}
                </p>
              </div>
              <button
                disabled={busyId === b.id}
                onClick={() => importBooking(b)}
                className="bg-rose text-white px-4 py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50 shrink-0"
              >
                {busyId === b.id ? '匯入中...' : '匯入結帳'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

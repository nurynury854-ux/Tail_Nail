'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Booking } from '@/lib/types'

type Option = {
  stylist_id: string
  name: string
  ok: boolean
  reason: string | null
  end_time: string
  is_current: boolean
}

/** What the admin should do before moving this booking, based on what the customer chose. */
export function preferenceHint(booking: Booking): { text: string; askFirst: boolean } {
  if (booking.stylist_requested === false) return { text: '客人選「不指定」，可直接改派', askFirst: false }
  if (booking.stylist_requested === true) return { text: '客人指定了這位美甲師，請先聯絡客人再改派', askFirst: true }
  return { text: '不確定客人當初是否指定，建議先聯絡客人', askFirst: true }
}

export default function ReassignBookingModal({
  booking,
  currentStylistName,
  needsReassign,
  onClose,
  onDone,
}: {
  booking: Booking
  currentStylistName?: string
  /** Her stylist has left — show why this booking is flagged. */
  needsReassign: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [date, setDate] = useState(booking.date)
  const [time, setTime] = useState(booking.start_time.slice(0, 5))
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState('')
  const [notify, setNotify] = useState(Boolean(booking.line_id))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!date || !time) return
    let cancelled = false
    setLoading(true)
    setLoadError('')
    fetch(`/api/bookings/${booking.id}/reassign?date=${date}&start_time=${time}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setOptions([])
          setLoadError(data.error || '讀取可安排的美甲師失敗')
          return
        }
        setOptions(data.options || [])
        setSelected((prev) => (data.options || []).some((o: Option) => o.stylist_id === prev && o.ok) ? prev : '')
      })
      .catch(() => !cancelled && setLoadError('讀取可安排的美甲師失敗'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [booking.id, date, time])

  const hint = preferenceHint(booking)
  const timeChanged = date !== booking.date || time !== booking.start_time.slice(0, 5)

  const submit = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stylist_id: selected, date, start_time: time, notify }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '改派失敗')
        return
      }
      toast.success('預約已改派')
      if (notify && booking.line_id) {
        if (data.line_notification_sent) toast.success('已用 LINE 通知客人')
        else toast.error('LINE 通知沒有送達，請另外聯絡客人')
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-medium w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-playfair text-2xl text-charcoal font-bold">改派預約</h2>
            <button onClick={onClose} className="p-2 hover:bg-blush rounded-full transition-colors">
              <X className="w-5 h-5 text-warmgray" />
            </button>
          </div>

          <div className="rounded-xl bg-cream p-4 text-sm text-charcoal space-y-1 mb-4">
            <p className="font-semibold">{booking.customer_name}{booking.phone ? `　${booking.phone}` : ''}</p>
            <p className="text-warmgray">
              目前：{booking.date} {booking.start_time.slice(0, 5)}–{booking.end_time.slice(0, 5)}・{currentStylistName || '無美甲師'}
            </p>
          </div>

          {needsReassign && (
            <div className={`rounded-xl border p-3 text-sm mb-4 flex gap-2 ${hint.askFirst ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>原美甲師已離職。{hint.text}。</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">日期</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">開始時間</label>
              <input
                type="time"
                step={300}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
              />
            </div>
          </div>

          <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">美甲師</label>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-warmgray py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> 檢查可安排的美甲師...
            </div>
          ) : loadError ? (
            <p className="text-sm text-red-500 py-2">{loadError}</p>
          ) : options.length === 0 ? (
            <p className="text-sm text-warmgray py-2">這間分店目前沒有在職的美甲師</p>
          ) : (
            <div className="space-y-2">
              {options.map((o) => (
                <label
                  key={o.stylist_id}
                  className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-2.5 text-sm ${
                    o.ok ? 'cursor-pointer border-blush hover:border-rose' : 'border-gray-100 bg-gray-50 text-gray-400'
                  } ${selected === o.stylist_id ? 'border-rose bg-rose/5' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="reassign-stylist"
                      disabled={!o.ok}
                      checked={selected === o.stylist_id}
                      onChange={() => setSelected(o.stylist_id)}
                    />
                    <span className="font-medium">{o.name}</span>
                    {o.is_current && <span className="text-[11px] text-warmgray">(目前)</span>}
                  </span>
                  <span className="text-xs">{o.ok ? `可安排，至 ${o.end_time}` : o.reason}</span>
                </label>
              ))}
              {!options.some((o) => o.ok) && (
                <p className="text-xs text-warmgray pt-1">這個時段沒有人可以接，請和客人改約其他日期或時間。</p>
              )}
            </div>
          )}

          {booking.line_id && (
            <label className="flex items-center gap-2 text-sm text-charcoal mt-5">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              以 LINE 傳送變更通知給客人{timeChanged ? '（日期／時間已變更）' : ''}
            </label>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border-2 border-blush text-sm font-semibold text-charcoal hover:bg-blush transition-colors">
              取消
            </button>
            <button
              onClick={submit}
              disabled={!selected || saving}
              className="flex-1 py-3 rounded-xl bg-rose text-white text-sm font-semibold hover:bg-rose-dark transition-colors disabled:opacity-40"
            >
              {saving ? '改派中...' : '確認改派'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

export interface CalBooking {
  id: string
  branch_id?: string
  stylist_id?: string | null
  customer_name?: string | null
  phone?: string | null
  selected_services?: Array<{ service_id: string; service_name?: string }>
  category?: string | null
  date: string
  start_time: string
  end_time: string
  total_duration?: number | null
  status: string
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] // Monday-first

function serviceLabel(b: CalBooking): string {
  const names = (b.selected_services || []).map((s) => s.service_name || s.service_id)
  return names[0] || '—'
}

export default function AppointmentCalendar({
  month,
  bookings,
  onMonthChange,
  onSelect,
  branchName,
  stylistName,
}: {
  month: Date
  bookings: CalBooking[]
  onMonthChange: (m: Date) => void
  onSelect: (b: CalBooking) => void
  branchName?: string
  stylistName?: string
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const byDate = useMemo(() => {
    const map: Record<string, CalBooking[]> = {}
    for (const b of bookings) (map[b.date] ||= []).push(b)
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.start_time.localeCompare(b.start_time))
    return map
  }, [bookings])

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start, end })
    const rows: Date[][] = []
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7))
    return rows
  }, [month])

  const toggle = (dateStr: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr)
      return next
    })

  return (
    <div className="rounded-2xl border border-blush bg-white p-3 sm:p-4">
      {/* Header: month nav + whose calendar */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onMonthChange(addMonths(month, -1))} className="p-2 rounded-lg hover:bg-blush text-charcoal" aria-label="上個月">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="font-playfair text-lg text-charcoal">{format(month, 'yyyy 年 M 月')}</p>
          {(branchName || stylistName) && (
            <p className="text-xs text-warmgray">{[branchName, stylistName].filter(Boolean).join('・')}</p>
          )}
        </div>
        <button onClick={() => onMonthChange(addMonths(month, 1))} className="p-2 rounded-lg hover:bg-blush text-charcoal" aria-label="下個月">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 text-center text-xs text-warmgray mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Weeks */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const appts = byDate[dateStr] || []
          const inMonth = isSameMonth(day, month)
          const isExpanded = expanded.has(dateStr)
          const shown = isExpanded ? appts : appts.slice(0, 3)
          return (
            <div
              key={dateStr}
              className={`min-h-[76px] rounded-lg border p-1 text-left align-top ${
                inMonth ? 'border-blush bg-white' : 'border-transparent bg-blush/20'
              }`}
            >
              <div className={`text-xs mb-0.5 ${inMonth ? 'text-charcoal' : 'text-warmgray/50'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {shown.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onSelect(b)}
                    className="w-full rounded bg-rose/10 hover:bg-rose/20 px-1 py-0.5 text-left transition"
                  >
                    <span className="block text-[10px] leading-tight text-rose-dark font-semibold">{b.start_time}</span>
                    <span className="block text-[10px] leading-tight text-charcoal truncate">{serviceLabel(b)}</span>
                    {b.customer_name && (
                      <span className="block text-[10px] leading-tight text-warmgray truncate">{b.customer_name}</span>
                    )}
                  </button>
                ))}
                {appts.length > 3 && (
                  <button onClick={() => toggle(dateStr)} className="text-[10px] text-rose-dark hover:underline">
                    {isExpanded ? '收合' : `+${appts.length - 3} 更多`}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {bookings.length === 0 && (
        <p className="text-center text-sm text-warmgray mt-4">本月無預約</p>
      )}
    </div>
  )
}

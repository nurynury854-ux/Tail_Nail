'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Lock, Trash2 } from 'lucide-react'
import type { Branch, Stylist } from '@/lib/types'
import type { StylistLeave } from '@/lib/checkoutTypes'
import { useCheckoutSession } from '@/components/checkout/session'
import { taipeiToday } from '@/lib/dateTW'

export default function LeavePage() {
  const { session } = useCheckoutSession()
  const isOwner = session?.role === 'owner'

  const [branchId, setBranchId] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [stylists, setStylists] = useState<Stylist[]>([])
  const [leaves, setLeaves] = useState<StylistLeave[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [stylistId, setStylistId] = useState('')
  const [date, setDate] = useState(taipeiToday())
  const [reason, setReason] = useState('')

  // Kenny picks a store; a manager never sees a branch control at all — theirs
  // comes from the session, and the API ignores any branch they send.
  useEffect(() => {
    if (isOwner) {
      fetch('/api/branches')
        .then((r) => (r.ok ? r.json() : []))
        .then((b: Branch[]) => {
          setBranches(b)
          if (b[0]) setBranchId((prev) => prev || b[0].id)
        })
        .catch(() => setBranches([]))
    } else if (session?.branchId) {
      setBranchId(session.branchId)
    }
  }, [isOwner, session])

  useEffect(() => {
    if (!branchId) return
    fetch(`/api/stylists?branch_id=${branchId}&active=true`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setStylists)
      .catch(() => setStylists([]))
    setStylistId('')
  }, [branchId])

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/checkout/leave?branch_id=${branchId}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '讀取排休失敗')
        setLeaves([])
        return
      }
      setLeaves(data.leaves || [])
    } catch {
      toast.error('讀取排休失敗')
      setLeaves([])
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    if (!stylistId) {
      toast.error('請選擇美甲師')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/checkout/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: branchId, stylist_id: stylistId, date, reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '排休失敗')
        return
      }
      // Leave never cancels an appointment — the manager has to call those
      // customers, so say it loudly rather than burying it in the list.
      if (data.booking_count > 0) {
        toast(`已排休，但 ${data.stylist_name} 當日仍有 ${data.booking_count} 筆已確認預約，請聯絡客人改期`, {
          icon: '⚠️',
          duration: 8000,
        })
      } else {
        toast.success(`已為 ${data.stylist_name} 排休 ${date}`)
      }
      setReason('')
      load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (leave: StylistLeave) => {
    const res = await fetch(`/api/checkout/leave?id=${leave.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || '取消排休失敗')
      return
    }
    toast.success('已取消排休')
    load()
  }

  const grouped = useMemo(() => {
    const byDate = new Map<string, StylistLeave[]>()
    for (const leave of leaves) {
      const list = byDate.get(leave.date) || []
      list.push(leave)
      byDate.set(leave.date, list)
    }
    return Array.from(byDate.entries())
  }, [leaves])

  const inputCls = 'rounded-lg border border-blush px-3 py-2 text-sm'

  // Nav already hides this from technicians and the API rejects them; this just
  // avoids a failed fetch for anyone who types the URL.
  if (session && !isOwner && session.role !== 'manager') {
    return <p className="text-warmgray">此頁面僅限老闆與店長。</p>
  }

  return (
    <div className="space-y-5">
      <h1 className="font-playfair text-2xl text-charcoal">排休</h1>

      {isOwner && (
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}

      <p className="text-sm text-warmgray">
        {isOwner
          ? '老闆可檢視與調整所有分店的排休，包含店長設定的紀錄。'
          : '店長可為本店美甲師安排整天休假。排休後該美甲師當日不接受預約、不排值日生，也不會被「不指定」的隨機派單選到。所有異動都會記錄給老闆。'}
      </p>

      <div className="rounded-2xl border border-blush bg-white p-5 space-y-3">
        <h2 className="font-playfair text-lg text-charcoal">新增排休</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={stylistId} onChange={(e) => setStylistId(e.target.value)} className={inputCls}>
            <option value="">— 選擇美甲師 —</option>
            {stylists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="原因（選填）"
            maxLength={100}
            className={`${inputCls} flex-1 min-w-[10rem]`}
          />
          <button
            onClick={add}
            disabled={!stylistId || saving}
            className="bg-rose text-white px-4 py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
          >
            {saving ? '儲存中…' : '排休'}
          </button>
        </div>
        <p className="text-xs text-warmgray">整天休假。若當天已有預約，系統不會自動取消，需另行聯絡客人。</p>
      </div>

      <div className="rounded-2xl border border-blush bg-white p-5">
        <h2 className="font-playfair text-lg text-charcoal mb-3">未來排休</h2>
        {loading ? (
          <p className="text-warmgray text-sm">載入中…</p>
        ) : grouped.length === 0 ? (
          <p className="text-warmgray text-sm">未來 60 天內尚無排休</p>
        ) : (
          <div className="space-y-4">
            {grouped.map(([day, entries]) => (
              <div key={day}>
                <p className="text-xs text-warmgray mb-1">{day}</p>
                <ul className="divide-y divide-blush/60">
                  {entries.map((leave) => (
                    <li key={leave.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="text-charcoal font-medium">{leave.stylist_name}</span>
                      {leave.reason && <span className="text-warmgray">{leave.reason}</span>}
                      {leave.booking_count > 0 && (
                        <span className="text-xs text-rose-dark bg-rose/10 rounded-full px-2 py-0.5">
                          當日尚有 {leave.booking_count} 筆預約
                        </span>
                      )}
                      <span className="ml-auto text-xs text-warmgray">
                        {leave.created_by_name
                          ? `${leave.created_by_name}（${leave.created_by_role === 'owner' ? '老闆' : '店長'}）`
                          : '老闆'}
                      </span>
                      {leave.locked ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-warmgray"
                          title="此排休由老闆設定，店長無法修改"
                        >
                          <Lock size={13} /> 鎖定
                        </span>
                      ) : (
                        <button
                          onClick={() => remove(leave)}
                          className="inline-flex items-center gap-1 text-xs text-rose-dark hover:underline"
                        >
                          <Trash2 size={13} /> 取消
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

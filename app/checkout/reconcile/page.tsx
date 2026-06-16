'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { Branch } from '@/lib/types'
import type { ActualAmountAdjustment } from '@/lib/checkoutTypes'
import { formatNTD, useCheckoutSession } from '@/components/checkout/session'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function ReconcilePage() {
  const { session } = useCheckoutSession()
  const [date, setDate] = useState(todayStr())
  const [branchId, setBranchId] = useState<string>('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [systemTotal, setSystemTotal] = useState(0)
  const [adjustments, setAdjustments] = useState<ActualAmountAdjustment[]>([])
  const [actual, setActual] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session?.role === 'owner') {
      fetch('/api/branches').then((r) => (r.ok ? r.json() : [])).then((b: Branch[]) => {
        setBranches(b)
        if (b[0]) setBranchId((prev) => prev || b[0].id)
      })
    } else if (session?.branchId) {
      setBranchId(session.branchId)
    }
  }, [session])

  const load = useCallback(async () => {
    if (!branchId) return
    const res = await fetch(`/api/checkout/reconcile?date=${date}&branch_id=${branchId}`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      setSystemTotal(data.system_total)
      setAdjustments(data.adjustments || [])
    }
  }, [date, branchId])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!reason.trim()) {
      toast.error('請填寫調整原因')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/checkout/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, branch_id: branchId, actual_total: Number(actual), reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '儲存失敗')
        return
      }
      toast.success('已記錄')
      setActual('')
      setReason('')
      load()
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'rounded-lg border border-blush px-3 py-2 text-sm'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-playfair text-2xl text-charcoal">對帳（實收金額）</h1>

      <div className="flex flex-wrap gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        {session?.role === 'owner' && (
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded-2xl border border-blush bg-white p-5 space-y-3">
        <div className="flex justify-between">
          <span className="text-warmgray">系統營業額</span>
          <span className="text-charcoal font-semibold">{formatNTD(systemTotal)}</span>
        </div>
        <div>
          <label className="block text-sm text-charcoal mb-1">實際金額（收銀機）</label>
          <input type="number" value={actual} onChange={(e) => setActual(e.target.value)} className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className="block text-sm text-charcoal mb-1">調整原因（必填）</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={`${inputCls} w-full`} />
        </div>
        <button onClick={save} disabled={busy} className="w-full bg-rose text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50">
          記錄調整
        </button>
      </div>

      {adjustments.length > 0 && (
        <div className="rounded-2xl border border-blush bg-white p-5">
          <h2 className="font-playfair text-lg text-charcoal mb-3">調整記錄</h2>
          <ul className="space-y-2 text-sm">
            {adjustments.map((a) => (
              <li key={a.id} className="border-b border-blush/60 pb-2 last:border-0">
                <div className="flex justify-between text-charcoal">
                  <span>實收 {formatNTD(a.actual_total)}</span>
                  <span className={a.difference === 0 ? 'text-warmgray' : a.difference > 0 ? 'text-green-600' : 'text-rose-dark'}>
                    差額 {formatNTD(a.difference)}
                  </span>
                </div>
                <p className="text-warmgray text-xs mt-0.5">{a.account_name}・{a.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

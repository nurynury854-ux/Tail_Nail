'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { Branch, Stylist } from '@/lib/types'
import type { CleaningDuty } from '@/lib/checkoutTypes'
import { useCheckoutSession } from '@/components/checkout/session'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function CleaningPage() {
  const { session } = useCheckoutSession()
  const [branchId, setBranchId] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [stylists, setStylists] = useState<Stylist[]>([])
  const [duties, setDuties] = useState<CleaningDuty[]>([])
  const [date, setDate] = useState(todayStr())
  const [manualId, setManualId] = useState('')

  const canAssign = session?.role === 'owner' || session?.role === 'manager'

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

  useEffect(() => {
    if (branchId) fetch(`/api/stylists?branch_id=${branchId}&active=true`).then((r) => (r.ok ? r.json() : [])).then(setStylists)
  }, [branchId])

  const load = useCallback(async () => {
    if (!branchId) return
    const res = await fetch(`/api/checkout/cleaning?branch_id=${branchId}`, { cache: 'no-store' })
    setDuties(res.ok ? await res.json() : [])
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  const assign = async (stylistId?: string) => {
    const res = await fetch('/api/checkout/cleaning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: branchId, date, stylist_id: stylistId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || '指派失敗')
      return
    }
    toast.success(`已指派 ${data.stylist_name_snapshot}`)
    setManualId('')
    load()
  }

  const inputCls = 'rounded-lg border border-blush px-3 py-2 text-sm'

  return (
    <div className="space-y-5">
      <h1 className="font-playfair text-2xl text-charcoal">每日清潔輪值</h1>

      {session?.role === 'owner' && (
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}

      {canAssign && (
        <div className="rounded-2xl border border-blush bg-white p-5 space-y-3">
          <h2 className="font-playfair text-lg text-charcoal">指派</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            <button onClick={() => assign()} className="bg-rose text-white px-4 py-2 rounded-lg text-sm hover:opacity-90">
              自動指派
            </button>
            <span className="text-warmgray text-sm">或手動：</span>
            <select value={manualId} onChange={(e) => setManualId(e.target.value)} className={inputCls}>
              <option value="">— 美甲師 —</option>
              {stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button
              onClick={() => manualId && assign(manualId)}
              disabled={!manualId}
              className="border border-rose text-rose-dark px-4 py-2 rounded-lg text-sm hover:bg-rose/5 disabled:opacity-50"
            >
              指派
            </button>
          </div>
          <p className="text-xs text-warmgray">自動指派會排除當天休假的美甲師，並盡量避免連續重複同一人。</p>
        </div>
      )}

      <div className="rounded-2xl border border-blush bg-white p-5">
        <h2 className="font-playfair text-lg text-charcoal mb-3">近期輪值</h2>
        {duties.length === 0 ? (
          <p className="text-warmgray text-sm">尚無排班</p>
        ) : (
          <ul className="divide-y divide-blush/60">
            {duties.map((d) => (
              <li key={d.id} className="flex justify-between py-2 text-sm">
                <span className="text-warmgray">{d.duty_date}</span>
                <span className="text-charcoal font-medium">{d.stylist_name_snapshot || '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

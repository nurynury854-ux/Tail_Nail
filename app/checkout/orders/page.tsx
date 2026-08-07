'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import type { CheckoutOrder } from '@/lib/checkoutTypes'
import type { Branch, Stylist } from '@/lib/types'
import OrderStatusBadge from '@/components/checkout/OrderStatusBadge'
import { formatNTD, useCheckoutSession } from '@/components/checkout/session'
import { taipeiToday } from '@/lib/dateTW'

export default function OrdersPage() {
  const { session } = useCheckoutSession()
  const [date, setDate] = useState(taipeiToday())
  const [orders, setOrders] = useState<CheckoutOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [stylists, setStylists] = useState<Stylist[]>([])
  const [branchId, setBranchId] = useState('')
  const [stylistId, setStylistId] = useState('')
  // 整店 = every stylist in scope | 個人 = one selected stylist.
  const [view, setView] = useState<'branch' | 'individual'>('branch')

  const role = session?.role
  const canFilter = role === 'owner' || role === 'manager'
  const branchView = !canFilter || view === 'branch'

  // Filter option lists. Fetch ALL stylists (active=false) so 整店 can still name
  // an inactive stylist who has orders on this date.
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
    if (role !== 'owner') return
    setStylistId('')
    if (!branchId) {
      setStylists([])
      return
    }
    fetch(`/api/stylists?branch_id=${branchId}&active=false`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setStylists)
      .catch(() => {})
  }, [role, branchId])

  // Only the branch narrows the query; the stylist filter is applied client-side
  // below, so 個人 is always a strict subset of what 整店 shows.
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ date })
      if (branchId) params.set('branch_id', branchId)
      const res = await fetch(`/api/checkout/orders?${params.toString()}`, { cache: 'no-store' })
      setOrders(res.ok ? await res.json() : [])
    } finally {
      setLoading(false)
    }
  }, [date, branchId])

  useEffect(() => {
    load()
  }, [load])

  const displayed = useMemo(() => {
    if (branchView) return orders
    return stylistId ? orders.filter((o) => o.stylist_id_snapshot === stylistId) : []
  }, [orders, branchView, stylistId])

  const confirm = async (id: string) => {
    const res = await fetch(`/api/checkout/orders/${id}/confirm`, { method: 'POST' })
    if (res.ok) {
      toast.success('已確認鎖定')
      load()
    } else {
      const e = await res.json().catch(() => ({}))
      toast.error(e.error || '確認失敗')
    }
  }

  const submit = async (id: string) => {
    const res = await fetch(`/api/checkout/orders/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    })
    if (res.ok) {
      toast.success('已送出')
      load()
    } else {
      const e = await res.json().catch(() => ({}))
      toast.error(e.error || '送出失敗')
    }
  }

  const canConfirm = role === 'owner' || role === 'manager'
  // 個人 needs a stylist picked (and, for the owner, a branch to pick them from).
  const needsStylist = !branchView && !stylistId
  // Only worth naming the branch on each row when several are mixed together.
  // It rides under the stylist name rather than taking a 7th column — at phone
  // width a column of its own squeezes the table until the actions fall off.
  const showBranch = role === 'owner' && !branchId
  const selectCls = 'rounded-lg border border-blush px-3 py-2 text-sm'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-playfair text-2xl text-charcoal">訂單</h1>
        <Link
          href="/checkout/orders/new"
          className="inline-flex items-center gap-1 bg-rose text-white px-4 py-2 rounded-lg text-sm hover:opacity-90"
        >
          <Plus size={16} /> 手動結帳
        </Link>
      </div>

      {/* View toggle + filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={selectCls} />

        {canFilter && (
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
            <option value="">— 全部分店 —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        {/* Stylist selector only in 個人 view — 整店 shows every stylist. */}
        {canFilter && !branchView && (
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

      <p className="text-xs text-warmgray">
        訂單需經店長確認後才會計入營業額與業績；未確認的訂單標示為「未計入」。
      </p>

      {loading ? (
        <p className="text-warmgray">載入中...</p>
      ) : needsStylist ? (
        <p className="text-warmgray text-sm">
          {role === 'owner' && !branchId ? '請先選擇分店與美甲師以顯示訂單。' : '請先選擇美甲師以顯示訂單。'}
        </p>
      ) : displayed.length === 0 ? (
        <p className="text-warmgray">此日期沒有訂單</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-blush bg-white">
          <table className="w-full text-sm">
            <thead className="text-warmgray border-b border-blush">
              <tr className="text-left">
                <th className="px-3 py-2">狀態</th>
                <th className="px-3 py-2">客戶</th>
                {role !== 'stylist' && <th className="px-3 py-2">美甲師</th>}
                <th className="px-3 py-2 text-right">營業額</th>
                <th className="px-3 py-2 text-right">業績</th>
                <th className="px-3 py-2">付款</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((o) => (
                <tr key={o.id} className="border-b border-blush/60 last:border-0">
                  <td className="px-3 py-2"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-3 py-2 text-charcoal">{o.customer_name || '—'}</td>
                  {role !== 'stylist' && (
                    <td className="px-3 py-2 text-charcoal whitespace-nowrap">
                      {o.stylist_name_snapshot}
                      {showBranch && (
                        <span className="block text-[10px] text-warmgray">{o.branch_name_snapshot}</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right">
                    <span className={o.status === 'confirmed' ? 'text-charcoal' : 'text-warmgray'}>
                      {formatNTD(o.revenue)}
                    </span>
                    {o.status !== 'confirmed' && (
                      <span className="block text-[10px] text-warmgray">未計入</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={o.status === 'confirmed' ? 'text-rose-dark' : 'text-warmgray'}>
                      {formatNTD(o.stylist_income)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-warmgray">
                    {o.payment_method === 'cash' ? '現金' : o.payment_method === 'transfer' ? '匯款' : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 justify-end">
                      <Link href={`/checkout/orders/${o.id}`} className="text-rose-dark hover:underline">
                        檢視
                      </Link>
                      {o.status === 'draft' && (
                        <button onClick={() => submit(o.id)} className="text-charcoal hover:underline">
                          送出
                        </button>
                      )}
                      {o.status === 'submitted' && canConfirm && (
                        <button onClick={() => confirm(o.id)} className="text-charcoal hover:underline">
                          確認
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

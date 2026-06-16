'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import type { CheckoutOrder } from '@/lib/checkoutTypes'
import OrderStatusBadge from '@/components/checkout/OrderStatusBadge'
import { formatNTD, useCheckoutSession } from '@/components/checkout/session'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function OrdersPage() {
  const { session } = useCheckoutSession()
  const [date, setDate] = useState(todayStr())
  const [orders, setOrders] = useState<CheckoutOrder[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/checkout/orders?date=${date}`, { cache: 'no-store' })
      setOrders(res.ok ? await res.json() : [])
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    load()
  }, [load])

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

  const canConfirm = session?.role === 'owner' || session?.role === 'manager'

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

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-lg border border-blush px-3 py-2 text-sm"
      />

      {loading ? (
        <p className="text-warmgray">載入中...</p>
      ) : orders.length === 0 ? (
        <p className="text-warmgray">此日期沒有訂單</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-blush bg-white">
          <table className="w-full text-sm">
            <thead className="text-warmgray border-b border-blush">
              <tr className="text-left">
                <th className="px-3 py-2">狀態</th>
                <th className="px-3 py-2">客戶</th>
                {session?.role !== 'stylist' && <th className="px-3 py-2">美甲師</th>}
                <th className="px-3 py-2 text-right">營業額</th>
                <th className="px-3 py-2 text-right">業績</th>
                <th className="px-3 py-2">付款</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-blush/60 last:border-0">
                  <td className="px-3 py-2"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-3 py-2 text-charcoal">{o.customer_name || '—'}</td>
                  {session?.role !== 'stylist' && (
                    <td className="px-3 py-2 text-charcoal">{o.stylist_name_snapshot}</td>
                  )}
                  <td className="px-3 py-2 text-right text-charcoal">{formatNTD(o.revenue)}</td>
                  <td className="px-3 py-2 text-right text-rose-dark">{formatNTD(o.stylist_income)}</td>
                  <td className="px-3 py-2 text-warmgray">
                    {o.payment_method === 'cash' ? '現金' : o.payment_method === 'transfer' ? '轉帳' : '—'}
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

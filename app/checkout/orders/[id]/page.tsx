'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { CheckoutOrder, OrderEditLog } from '@/lib/checkoutTypes'
import type { PriceItem } from '@/lib/checkoutPricing'
import OrderForm, { OrderFormPayload } from '@/components/checkout/OrderForm'
import OrderStatusBadge from '@/components/checkout/OrderStatusBadge'
import { formatNTD, useCheckoutSession, type ClientSession } from '@/components/checkout/session'

function canEdit(session: ClientSession | null, order: CheckoutOrder): boolean {
  if (!session) return false
  if (session.role === 'owner') return true
  if (order.status === 'confirmed') return false
  if (session.role === 'manager') return session.branchId === order.branch_id_snapshot
  return order.status === 'draft' && order.stylist_id_snapshot === session.stylistId
}

const ACTION_LABELS: Record<string, string> = {
  create: '建立',
  edit: '修改',
  submit: '送出',
  confirm: '確認鎖定',
  blocked_edit_attempt: '嘗試修改（已鎖定）',
  delete: '刪除',
  actual_amount_adjust: '實收調整',
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { session } = useCheckoutSession()
  const [order, setOrder] = useState<CheckoutOrder | null>(null)
  const [priceItems, setPriceItems] = useState<PriceItem[]>([])
  const [logs, setLogs] = useState<OrderEditLog[]>([])
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const res = await fetch(`/api/checkout/orders/${id}`, { cache: 'no-store' })
    if (res.ok) setOrder(await res.json())
    else setOrder(null)
  }

  useEffect(() => {
    load()
    fetch('/api/checkout/prices').then((r) => (r.ok ? r.json() : [])).then(setPriceItems).catch(() => {})
  }, [id])

  useEffect(() => {
    if (session && session.role !== 'stylist') {
      fetch(`/api/checkout/logs?order_id=${id}`).then((r) => (r.ok ? r.json() : [])).then(setLogs).catch(() => {})
    }
  }, [session, id, order])

  if (!order) return <p className="text-warmgray">載入中...</p>

  const editable = canEdit(session, order)

  const saveEdit = async (payload: OrderFormPayload) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/checkout/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '儲存失敗')
        return
      }
      toast.success('已儲存')
      setEditing(false)
      load()
    } finally {
      setBusy(false)
    }
  }

  const doAction = async (path: string, body?: object) => {
    const res = await fetch(`/api/checkout/orders/${id}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.ok) {
      toast.success('完成')
      load()
    } else {
      const e = await res.json().catch(() => ({}))
      toast.error(e.error || '操作失敗')
    }
  }

  const remove = async () => {
    if (!confirm('確定刪除此訂單？')) return
    const res = await fetch(`/api/checkout/orders/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('已刪除')
      router.push('/checkout/orders')
    } else {
      const e = await res.json().catch(() => ({}))
      toast.error(e.error || '刪除失敗')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="font-playfair text-2xl text-charcoal">訂單明細</h1>
        <OrderStatusBadge status={order.status} />
      </div>

      {editing ? (
        <div className="rounded-2xl border border-blush bg-white p-5">
          <OrderForm
            priceItems={priceItems}
            mode="edit"
            busy={busy}
            initial={{
              customer_name: order.customer_name,
              customer_phone: order.customer_phone,
              payment_method: order.payment_method,
              review_discount: order.review_discount,
              birthday_discount: order.birthday_discount,
              items: order.items,
            }}
            onSubmit={saveEdit}
          />
          <button onClick={() => setEditing(false)} className="mt-3 text-sm text-warmgray hover:underline">
            取消編輯
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-blush bg-white p-5 space-y-3">
          <Row label="客戶" value={order.customer_name || '—'} />
          <Row label="電話" value={order.customer_phone || '—'} />
          <Row label="美甲師" value={order.stylist_name_snapshot} />
          <Row label="分店" value={order.branch_name_snapshot} />
          <Row label="來源" value={order.source === 'calendar' ? '行事曆匯入' : '手動'} />
          <div className="border-t border-blush pt-3 space-y-1">
            {(order.items || []).map((it) => (
              <div key={it.id} className="flex justify-between text-sm">
                <span className="text-charcoal">
                  {it.service_name_snapshot} × {it.quantity}
                  {it.discount ? <span className="text-warmgray"> (折 {formatNTD(it.discount)})</span> : null}
                </span>
                <span className="text-charcoal">{formatNTD(it.line_total)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-blush pt-3 space-y-1">
            {(order.birthday_discount || order.review_discount) && (
              <Row
                label="優惠"
                value={[order.birthday_discount ? '壽星9折' : '', order.review_discount ? '好評−$50' : '']
                  .filter(Boolean)
                  .join('、')}
              />
            )}
            <Row label="營業額" value={formatNTD(order.revenue)} strong />
            <Row label="業績（50%）" value={formatNTD(order.stylist_income)} />
            <Row label="付款" value={order.payment_method === 'cash' ? '現金' : order.payment_method === 'transfer' ? '匯款' : '—'} />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {editable && (
              <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-lg border border-rose text-rose-dark text-sm hover:bg-rose/5">
                編輯
              </button>
            )}
            {order.status === 'draft' && (
              <button onClick={() => doAction('submit', { confirmed: true })} className="px-4 py-2 rounded-lg bg-rose text-white text-sm hover:opacity-90">
                送出
              </button>
            )}
            {order.status === 'submitted' && (session?.role === 'owner' || session?.role === 'manager') && (
              <button onClick={() => doAction('confirm')} className="px-4 py-2 rounded-lg bg-rose text-white text-sm hover:opacity-90">
                確認鎖定
              </button>
            )}
            {editable && (
              <button onClick={remove} className="px-4 py-2 rounded-lg border border-blush text-warmgray text-sm hover:text-rose-dark">
                刪除
              </button>
            )}
          </div>
        </div>
      )}

      {session?.role !== 'stylist' && logs.length > 0 && (
        <div className="rounded-2xl border border-blush bg-white p-5">
          <h2 className="font-playfair text-lg text-charcoal mb-3">修改記錄</h2>
          <ul className="space-y-2 text-sm">
            {logs.map((log) => (
              <li key={log.id} className="text-warmgray">
                <span className="text-charcoal">{log.actor_name}</span> {ACTION_LABELS[log.action] || log.action}
                {log.created_at ? `・${new Date(log.created_at).toLocaleString('zh-TW')}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-warmgray">{label}</span>
      <span className={strong ? 'text-charcoal font-semibold' : 'text-charcoal'}>{value}</span>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Service } from '@/lib/types'
import { computeOrderTotals } from '@/lib/checkoutCalc'
import {
  DEFAULT_INCOME_RATE,
  PaymentMethod,
  REVIEW_INCENTIVE_AMOUNT,
} from '@/lib/checkoutTypes'
import { formatNTD } from './session'

interface FormLine {
  key: string
  service_id: string | null
  service_name: string
  unit_price: number
  quantity: number
  discount: number
  review_incentive: boolean
}

export interface OrderFormPayload {
  customer_name: string
  customer_phone: string
  payment_method: PaymentMethod | null
  items: Array<{
    service_id: string | null
    service_name: string
    unit_price: number
    quantity: number
    discount: number
    discount_type: 'manual' | 'review_incentive' | null
  }>
}

interface InitialData {
  customer_name?: string | null
  customer_phone?: string | null
  payment_method?: PaymentMethod | null
  items?: Array<{
    service_id?: string | null
    service_name_snapshot?: string
    service_name?: string
    unit_price: number
    quantity: number
    discount: number
    discount_type?: string | null
  }>
}

let counter = 0
const newKey = () => `line-${counter++}`

function emptyLine(): FormLine {
  return { key: newKey(), service_id: null, service_name: '', unit_price: 0, quantity: 1, discount: 0, review_incentive: false }
}

export default function OrderForm({
  services,
  mode = 'create',
  initial,
  busy = false,
  onSubmit,
}: {
  services: Service[]
  mode?: 'create' | 'edit'
  initial?: InitialData
  busy?: boolean
  onSubmit: (payload: OrderFormPayload, finalize: boolean) => void
}) {
  const [customerName, setCustomerName] = useState(initial?.customer_name || '')
  const [customerPhone, setCustomerPhone] = useState(initial?.customer_phone || '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(initial?.payment_method || null)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [lines, setLines] = useState<FormLine[]>(() => {
    if (initial?.items?.length) {
      return initial.items.map((it) => ({
        key: newKey(),
        service_id: it.service_id || null,
        service_name: it.service_name_snapshot || it.service_name || '',
        unit_price: it.unit_price,
        quantity: it.quantity,
        discount: it.discount,
        review_incentive: it.discount_type === 'review_incentive',
      }))
    }
    return [emptyLine()]
  })

  const updateLine = (key: string, patch: Partial<FormLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const onPickService = (key: string, serviceId: string) => {
    if (!serviceId) {
      updateLine(key, { service_id: null }) // custom line; keep name/price editable
      return
    }
    const svc = services.find((s) => s.id === serviceId)
    if (svc) {
      // Tapping a standard service auto-fills its fixed price (single source of truth).
      updateLine(key, { service_id: svc.id, service_name: svc.name, unit_price: svc.price || 0 })
    }
  }

  const toggleReview = (key: string, on: boolean) =>
    updateLine(key, { review_incentive: on, discount: on ? REVIEW_INCENTIVE_AMOUNT : 0 })

  const totals = useMemo(
    () =>
      computeOrderTotals(
        lines.map((l) => ({ unit_price: l.unit_price, quantity: l.quantity, discount: l.discount })),
        DEFAULT_INCOME_RATE,
      ),
    [lines],
  )

  const buildPayload = (): OrderFormPayload => ({
    customer_name: customerName.trim(),
    customer_phone: customerPhone.trim(),
    payment_method: paymentMethod,
    items: lines
      .filter((l) => l.service_name.trim())
      .map((l) => ({
        service_id: l.service_id,
        service_name: l.service_name.trim(),
        unit_price: l.unit_price,
        quantity: l.quantity,
        discount: l.discount,
        discount_type: l.review_incentive ? 'review_incentive' : l.discount > 0 ? 'manual' : null,
      })),
  })

  const hasItems = lines.some((l) => l.service_name.trim())

  const inputCls = 'w-full rounded-lg border border-blush px-3 py-2 text-sm focus:ring-2 focus:ring-rose/40 outline-none'

  return (
    <div className="space-y-5">
      {/* Customer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-charcoal mb-1">客戶姓名</label>
          <input className={inputCls} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-charcoal mb-1">電話</label>
          <input className={inputCls} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-playfair text-lg text-charcoal">服務項目</h3>
          <button
            type="button"
            onClick={() => setLines((p) => [...p, emptyLine()])}
            className="inline-flex items-center gap-1 text-sm text-rose-dark hover:opacity-80"
          >
            <Plus size={16} /> 新增項目
          </button>
        </div>

        {lines.map((line) => (
          <div key={line.key} className="rounded-xl border border-blush p-3 space-y-2 bg-white/60">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-start">
              <select
                className={inputCls}
                value={line.service_id || ''}
                onChange={(e) => onPickService(line.key, e.target.value)}
              >
                <option value="">— 自訂項目 / 選擇服務 —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.price ? `（${formatNTD(s.price)}）` : ''}
                  </option>
                ))}
              </select>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLines((p) => p.filter((l) => l.key !== line.key))}
                  className="p-2 text-warmgray hover:text-rose-dark"
                  aria-label="刪除項目"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {!line.service_id && (
              <input
                className={inputCls}
                placeholder="自訂項目名稱"
                value={line.service_name}
                onChange={(e) => updateLine(line.key, { service_name: e.target.value })}
              />
            )}

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-warmgray mb-1">單價</label>
                <input
                  type="number"
                  className={inputCls}
                  value={line.unit_price}
                  // Standard services have a fixed price; only custom lines are editable.
                  disabled={Boolean(line.service_id)}
                  onChange={(e) => updateLine(line.key, { unit_price: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-xs text-warmgray mb-1">數量</label>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
              <div>
                <label className="block text-xs text-warmgray mb-1">折扣</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={line.discount}
                  disabled={line.review_incentive}
                  onChange={(e) => updateLine(line.key, { discount: Math.max(0, Number(e.target.value) || 0) })}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-warmgray">
              <input
                type="checkbox"
                checked={line.review_incentive}
                onChange={(e) => toggleReview(line.key, e.target.checked)}
              />
              好評折扣 −{formatNTD(REVIEW_INCENTIVE_AMOUNT)}
            </label>
          </div>
        ))}
      </div>

      {/* Payment method */}
      <div>
        <label className="block text-sm text-charcoal mb-1">付款方式</label>
        <div className="flex gap-2">
          {([
            ['cash', '現金'],
            ['transfer', '轉帳'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPaymentMethod(value)}
              className={`px-4 py-2 rounded-lg text-sm border transition ${
                paymentMethod === value
                  ? 'bg-rose text-white border-rose'
                  : 'bg-white text-charcoal border-blush hover:border-rose/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-xl bg-blush/60 border border-blush p-4 space-y-1 text-sm">
        <div className="flex justify-between text-warmgray">
          <span>小計</span>
          <span>{formatNTD(totals.gross)}</span>
        </div>
        <div className="flex justify-between text-warmgray">
          <span>折扣</span>
          <span>−{formatNTD(totals.discountTotal)}</span>
        </div>
        <div className="flex justify-between text-charcoal font-semibold text-base">
          <span>營業額</span>
          <span>{formatNTD(totals.revenue)}</span>
        </div>
        <div className="flex justify-between text-rose-dark font-semibold">
          <span>業績（50%）</span>
          <span>{formatNTD(totals.stylistIncome)}</span>
        </div>
      </div>

      {/* Actions */}
      {mode === 'create' ? (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
            我確認以上結帳資料正確（送出後無法修改）
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !hasItems}
              onClick={() => onSubmit(buildPayload(), false)}
              className="flex-1 py-2.5 rounded-lg border border-rose text-rose-dark font-semibold hover:bg-rose/5 disabled:opacity-50"
            >
              儲存草稿
            </button>
            <button
              type="button"
              disabled={busy || !hasItems || !confirmChecked}
              onClick={() => onSubmit(buildPayload(), true)}
              className="flex-1 py-2.5 rounded-lg bg-rose text-white font-semibold hover:opacity-90 disabled:opacity-50"
            >
              確認結帳並送出
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || !hasItems}
          onClick={() => onSubmit(buildPayload(), false)}
          className="w-full py-2.5 rounded-lg bg-rose text-white font-semibold hover:opacity-90 disabled:opacity-50"
        >
          儲存修改
        </button>
      )}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { computeOrderTotals } from '@/lib/checkoutCalc'
import { PriceItem, PricedItemInput, resolveUnitPrice } from '@/lib/checkoutPricing'
import { DEFAULT_INCOME_RATE, PaymentMethod, REVIEW_INCENTIVE_AMOUNT } from '@/lib/checkoutTypes'
import { formatNTD } from './session'

interface FormLine {
  key: string
  price_key: string // catalog key, '' = custom off-catalog line
  category: 'hand' | 'foot'
  tier_index: number
  unit_count: number
  manual_price: number
  accent_count: number
  custom_name: string
  discount: number
  review_incentive: boolean
}

export type OrderFormPayload = {
  customer_name: string
  customer_phone: string
  payment_method: PaymentMethod | null
  items: PricedItemInput[]
}

interface InitialData {
  customer_name?: string | null
  customer_phone?: string | null
  payment_method?: PaymentMethod | null
  items?: Array<{
    price_key?: string | null
    service_name_snapshot?: string
    category?: 'hand' | 'foot' | null
    tier_index?: number | null
    unit_count?: number | null
    accent_count?: number | null
    unit_price: number
    discount: number
    discount_type?: string | null
  }>
}

let counter = 0
const newKey = () => `line-${counter++}`

function emptyLine(): FormLine {
  return { key: newKey(), price_key: '', category: 'hand', tier_index: 0, unit_count: 1, manual_price: 0, accent_count: 0, custom_name: '', discount: 0, review_incentive: false }
}

export default function OrderForm({
  priceItems,
  mode = 'create',
  initial,
  busy = false,
  onSubmit,
}: {
  priceItems: PriceItem[]
  mode?: 'create' | 'edit'
  initial?: InitialData
  busy?: boolean
  onSubmit: (payload: OrderFormPayload, finalize: boolean) => void
}) {
  const catalog = useMemo(() => new Map(priceItems.map((p) => [p.key, p])), [priceItems])

  const [customerName, setCustomerName] = useState(initial?.customer_name || '')
  const [customerPhone, setCustomerPhone] = useState(initial?.customer_phone || '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(initial?.payment_method || null)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [lines, setLines] = useState<FormLine[]>(() => {
    if (initial?.items?.length) {
      return initial.items.map((it) => ({
        key: newKey(),
        price_key: it.price_key || '',
        category: (it.category as 'hand' | 'foot') || 'hand',
        tier_index: it.tier_index ?? 0,
        unit_count: it.unit_count ?? 1,
        manual_price: it.unit_price,
        accent_count: it.accent_count ?? 0,
        custom_name: it.price_key ? '' : it.service_name_snapshot || '',
        discount: it.discount,
        review_incentive: it.discount_type === 'review_incentive',
      }))
    }
    return [emptyLine()]
  })

  const update = (key: string, patch: Partial<FormLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const lineUnitPrice = (line: FormLine): number => {
    const item = catalog.get(line.price_key)
    if (!item) return Math.max(0, line.manual_price)
    return resolveUnitPrice(item, {
      category: line.category,
      tierIndex: line.tier_index,
      unitCount: line.unit_count,
      manualPrice: line.manual_price,
      accentCount: line.accent_count,
    })
  }

  const toggleReview = (key: string, on: boolean) =>
    update(key, { review_incentive: on, discount: on ? REVIEW_INCENTIVE_AMOUNT : 0 })

  const totals = useMemo(
    () =>
      computeOrderTotals(
        lines.map((l) => ({ unit_price: lineUnitPrice(l), quantity: 1, discount: l.discount })),
        DEFAULT_INCOME_RATE,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, catalog],
  )

  const buildPayload = (): OrderFormPayload => ({
    customer_name: customerName.trim(),
    customer_phone: customerPhone.trim(),
    payment_method: paymentMethod,
    items: lines
      .filter((l) => l.price_key || l.custom_name.trim())
      .map((l) => ({
        price_key: l.price_key || null,
        service_name: l.custom_name.trim(),
        category: l.category,
        tier_index: l.tier_index,
        unit_count: l.unit_count,
        manual_price: l.manual_price,
        accent_count: l.accent_count,
        discount: l.discount,
        discount_type: l.review_incentive ? 'review_incentive' : l.discount > 0 ? 'manual' : null,
      })),
  })

  const hasItems = lines.some((l) => l.price_key || l.custom_name.trim())
  const inputCls = 'w-full rounded-lg border border-blush px-3 py-2 text-sm focus:ring-2 focus:ring-rose/40 outline-none'

  const main = priceItems.filter((p) => p.service_type === 'main')
  const addon = priceItems.filter((p) => p.service_type === 'addon')

  return (
    <div className="space-y-5">
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-playfair text-lg text-charcoal">服務項目</h3>
          <button type="button" onClick={() => setLines((p) => [...p, emptyLine()])} className="inline-flex items-center gap-1 text-sm text-rose-dark hover:opacity-80">
            <Plus size={16} /> 新增項目
          </button>
        </div>

        {lines.map((line) => {
          const item = catalog.get(line.price_key)
          const price = lineUnitPrice(line)
          const tiers = item?.pricing_mode === 'tier' ? (line.category === 'foot' ? item.tiers_foot : item.tiers_hand) || [] : []
          const perUnitMax = item?.unit_full_qty || 10
          const perUnitCorrected =
            item?.pricing_mode === 'per_unit' &&
            (item.unit_full_price || 0) > 0 &&
            line.unit_count * (item.unit_price || 0) >= (item.unit_full_price || 0)
          return (
            <div key={line.key} className="rounded-xl border border-blush p-3 space-y-2 bg-white/60">
              <div className="flex gap-2 items-start">
                <select
                  className={inputCls}
                  value={line.price_key}
                  onChange={(e) => update(line.key, { price_key: e.target.value, tier_index: 0, unit_count: 1, manual_price: 0, accent_count: 0 })}
                >
                  <option value="">— 自訂項目 —</option>
                  <optgroup label="手部 / 足部服務">
                    {main.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                  </optgroup>
                  <optgroup label="附加服務">
                    {addon.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                  </optgroup>
                </select>
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines((p) => p.filter((l) => l.key !== line.key))} className="p-2 text-warmgray hover:text-rose-dark" aria-label="刪除項目">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Hand / Foot toggle (catalog items) */}
              {item && (
                <div className="flex gap-2">
                  {([['hand', '手部'], ['foot', '足部']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => update(line.key, { category: val })}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition ${line.category === val ? 'bg-rose text-white border-rose' : 'bg-white text-charcoal border-blush'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* 跳色 add-on — only appears on services with an accent rate (單色 / 貓眼) */}
              {item?.accent_price ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="text-warmgray">跳色</label>
                  <select
                    className="w-24 rounded-lg border border-blush px-3 py-2 text-sm"
                    value={line.accent_count}
                    onChange={(e) => update(line.key, { accent_count: Number(e.target.value) })}
                  >
                    {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                      <option key={n} value={n}>{n === 0 ? '無' : `${n} 指`}</option>
                    ))}
                  </select>
                  <span className="text-warmgray text-xs">每指 +{formatNTD(item.accent_price)}</span>
                </div>
              ) : null}

              {/* Custom line: name + price */}
              {!item && (
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputCls} placeholder="自訂項目名稱" value={line.custom_name} onChange={(e) => update(line.key, { custom_name: e.target.value })} />
                  <input className={inputCls} type="number" placeholder="價格" value={line.manual_price} onChange={(e) => update(line.key, { manual_price: Number(e.target.value) || 0 })} />
                </div>
              )}

              {/* Tier picker */}
              {item?.pricing_mode === 'tier' && (
                <div className="flex flex-wrap gap-2">
                  {tiers.map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => update(line.key, { tier_index: idx })}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition ${line.tier_index === idx ? 'bg-rose text-white border-rose' : 'bg-white text-charcoal border-blush'}`}
                    >
                      {formatNTD(t)}
                    </button>
                  ))}
                </div>
              )}

              {/* Per-unit (extension): finger-count selector with auto flat-rate. */}
              {item?.pricing_mode === 'per_unit' && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="text-warmgray">指／趾數</label>
                  <select
                    className="w-24 rounded-lg border border-blush px-3 py-2 text-sm"
                    value={line.unit_count}
                    onChange={(e) => update(line.key, { unit_count: Number(e.target.value) })}
                  >
                    {Array.from({ length: perUnitMax }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n} 指</option>
                    ))}
                  </select>
                  {perUnitCorrected ? (
                    <span className="text-rose-dark text-xs">已自動套用滿額價 {formatNTD(item.unit_full_price || 0)}</span>
                  ) : (
                    <span className="text-warmgray text-xs">每指 {formatNTD(item.unit_price || 0)}</span>
                  )}
                </div>
              )}

              {/* Manual-price catalog item (custom-design / repair) */}
              {item?.pricing_mode === 'manual' && (
                <div>
                  <label className="block text-xs text-warmgray mb-1">價格（手動輸入）</label>
                  <input className={inputCls} type="number" value={line.manual_price} onChange={(e) => update(line.key, { manual_price: Number(e.target.value) || 0 })} />
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-warmgray">
                  <input type="checkbox" checked={line.review_incentive} onChange={(e) => toggleReview(line.key, e.target.checked)} />
                  好評折扣 −{formatNTD(REVIEW_INCENTIVE_AMOUNT)}
                </label>
                {!line.review_incentive && (
                  <div className="flex items-center gap-1 text-xs text-warmgray">
                    <span>折扣</span>
                    <input type="number" min={0} className="w-20 rounded-lg border border-blush px-2 py-1 text-sm" value={line.discount} onChange={(e) => update(line.key, { discount: Math.max(0, Number(e.target.value) || 0) })} />
                  </div>
                )}
                <span className="text-sm font-semibold text-charcoal">{formatNTD(Math.max(0, price - line.discount))}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div>
        <label className="block text-sm text-charcoal mb-1">付款方式</label>
        <div className="flex gap-2">
          {([['cash', '現金'], ['transfer', '轉帳']] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setPaymentMethod(value)} className={`px-4 py-2 rounded-lg text-sm border transition ${paymentMethod === value ? 'bg-rose text-white border-rose' : 'bg-white text-charcoal border-blush hover:border-rose/50'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-blush/60 border border-blush p-4 space-y-1 text-sm">
        <div className="flex justify-between text-warmgray"><span>小計</span><span>{formatNTD(totals.gross)}</span></div>
        <div className="flex justify-between text-warmgray"><span>折扣</span><span>−{formatNTD(totals.discountTotal)}</span></div>
        <div className="flex justify-between text-charcoal font-semibold text-base"><span>營業額</span><span>{formatNTD(totals.revenue)}</span></div>
        <div className="flex justify-between text-rose-dark font-semibold"><span>業績（50%）</span><span>{formatNTD(totals.stylistIncome)}</span></div>
      </div>

      {mode === 'create' ? (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
            我確認以上結帳資料正確（送出後無法修改）
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy || !hasItems} onClick={() => onSubmit(buildPayload(), false)} className="flex-1 py-2.5 rounded-lg border border-rose text-rose-dark font-semibold hover:bg-rose/5 disabled:opacity-50">
              儲存草稿
            </button>
            <button type="button" disabled={busy || !hasItems || !confirmChecked} onClick={() => onSubmit(buildPayload(), true)} className="flex-1 py-2.5 rounded-lg bg-rose text-white font-semibold hover:opacity-90 disabled:opacity-50">
              確認結帳並送出
            </button>
          </div>
        </div>
      ) : (
        <button type="button" disabled={busy || !hasItems} onClick={() => onSubmit(buildPayload(), false)} className="w-full py-2.5 rounded-lg bg-rose text-white font-semibold hover:opacity-90 disabled:opacity-50">
          儲存修改
        </button>
      )}
    </div>
  )
}

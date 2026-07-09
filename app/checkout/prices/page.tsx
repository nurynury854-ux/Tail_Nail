'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { PriceItem } from '@/lib/checkoutPricing'

const MODE_LABELS: Record<string, string> = {
  fixed: '固定價',
  tier: '分級價',
  per_unit: '單指計價',
  manual: '手動輸入',
}

export default function PricesPage() {
  const [items, setItems] = useState<PriceItem[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => fetch('/api/checkout/prices').then((r) => (r.ok ? r.json() : [])).then(setItems)
  useEffect(() => {
    load()
  }, [])

  const patch = async (id: string, payload: object) => {
    setBusyId(id)
    try {
      const res = await fetch('/api/checkout/prices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      })
      if (res.ok) {
        toast.success('已更新價格')
        load()
      } else {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || '更新失敗')
      }
    } finally {
      setBusyId(null)
    }
  }

  const numCls = 'w-24 rounded-lg border border-blush px-2 py-1 text-sm'

  return (
    <div className="space-y-4">
      <h1 className="font-playfair text-2xl text-charcoal">價格設定</h1>
      <p className="text-sm text-warmgray">僅老闆可調整。修改後立即套用於新訂單；已結帳訂單金額不受影響。</p>

      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="rounded-xl border border-blush bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-charcoal">
                {it.name} <span className="text-xs text-warmgray">（{MODE_LABELS[it.pricing_mode]}）</span>
              </span>
            </div>

            {it.pricing_mode === 'fixed' && (
              <FixedEditor
                item={it}
                busy={busyId === it.id}
                numCls={numCls}
                accentName={it.accent_service_key ? items.find((x) => x.key === it.accent_service_key)?.name : undefined}
                onSave={(p) => patch(it.id, p)}
              />
            )}
            {it.pricing_mode === 'tier' && (
              <TierEditor item={it} busy={busyId === it.id} onSave={(p) => patch(it.id, p)} />
            )}
            {it.pricing_mode === 'per_unit' && (
              <PerUnitEditor item={it} busy={busyId === it.id} numCls={numCls} onSave={(p) => patch(it.id, p)} />
            )}
            {it.pricing_mode === 'manual' && (
              <p className="text-sm text-warmgray">此項目由美甲師於結帳時手動輸入價格。</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FixedEditor({ item, busy, numCls, accentName, onSave }: { item: PriceItem; busy: boolean; numCls: string; accentName?: string; onSave: (p: object) => void }) {
  const [hand, setHand] = useState(String(item.price_hand ?? ''))
  const [foot, setFoot] = useState(String(item.price_foot ?? ''))
  const hasAccent = item.accent_price != null
  const [accent, setAccent] = useState(String(item.accent_price ?? ''))
  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <label className="text-warmgray">手部 <input className={numCls} type="number" value={hand} onChange={(e) => setHand(e.target.value)} /></label>
      <label className="text-warmgray">足部 <input className={numCls} type="number" value={foot} onChange={(e) => setFoot(e.target.value)} /></label>
      {hasAccent && (
        <label className="text-warmgray">
          跳色{accentName ? `（${accentName}）` : ''}/指{' '}
          <input className={numCls} type="number" value={accent} onChange={(e) => setAccent(e.target.value)} />
        </label>
      )}
      <button
        disabled={busy}
        onClick={() => onSave({ price_hand: Number(hand), price_foot: Number(foot), ...(hasAccent ? { accent_price: Number(accent) } : {}) })}
        className="bg-rose text-white px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
      >
        儲存
      </button>
    </div>
  )
}

function TierEditor({ item, busy, onSave }: { item: PriceItem; busy: boolean; onSave: (p: object) => void }) {
  const [hand, setHand] = useState((item.tiers_hand || []).join(','))
  const [foot, setFoot] = useState((item.tiers_foot || []).join(','))
  const parse = (s: string) => s.split(',').map((n) => Number(n.trim())).filter((n) => Number.isFinite(n))
  return (
    <div className="space-y-2 text-sm">
      <label className="block text-warmgray">手部分級（逗號分隔）<input className="w-full rounded-lg border border-blush px-2 py-1 text-sm" value={hand} onChange={(e) => setHand(e.target.value)} /></label>
      <label className="block text-warmgray">足部分級（逗號分隔）<input className="w-full rounded-lg border border-blush px-2 py-1 text-sm" value={foot} onChange={(e) => setFoot(e.target.value)} /></label>
      <button disabled={busy} onClick={() => onSave({ tiers_hand: parse(hand), tiers_foot: parse(foot) })} className="bg-rose text-white px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50">儲存</button>
    </div>
  )
}

function PerUnitEditor({ item, busy, numCls, onSave }: { item: PriceItem; busy: boolean; numCls: string; onSave: (p: object) => void }) {
  const [unit, setUnit] = useState(String(item.unit_price ?? ''))
  const [qty, setQty] = useState(String(item.unit_full_qty ?? ''))
  const [full, setFull] = useState(String(item.unit_full_price ?? ''))
  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <label className="text-warmgray">每指 <input className={numCls} type="number" value={unit} onChange={(e) => setUnit(e.target.value)} /></label>
      <label className="text-warmgray">滿幾指 <input className={numCls} type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
      <label className="text-warmgray">滿額價 <input className={numCls} type="number" value={full} onChange={(e) => setFull(e.target.value)} /></label>
      <button disabled={busy} onClick={() => onSave({ unit_price: Number(unit), unit_full_qty: Number(qty), unit_full_price: Number(full) })} className="bg-rose text-white px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50">儲存</button>
    </div>
  )
}

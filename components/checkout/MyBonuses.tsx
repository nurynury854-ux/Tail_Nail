'use client'

import { useEffect, useState } from 'react'
import type { FixedBonus, PerformanceBonus } from '@/lib/checkoutTypes'
import { formatNTD, useCheckoutSession } from './session'

/**
 * Read-only bonus summary for 店長 and 美甲師.
 *
 * The API scopes the payload to the signed-in account and returns only active
 * rows, so everything rendered here is a bonus the viewer currently holds.
 * There is deliberately no control that writes: only the owner sets bonuses.
 */
export default function MyBonuses() {
  const { session } = useCheckoutSession()
  const [fixed, setFixed] = useState<FixedBonus[]>([])
  const [performance, setPerformance] = useState<PerformanceBonus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/checkout/bonuses', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { fixed: [], performance: [] }))
      .then((d) => {
        setFixed(d.fixed || [])
        setPerformance(d.performance || [])
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  // 業績獎金 is a store-manager payout, so the section is hidden entirely from
  // technicians rather than shown to them permanently empty.
  const showPerformance = session?.role === 'manager'

  return (
    <div className="space-y-6">
      <h1 className="font-playfair text-2xl text-charcoal">我的獎金</h1>
      <p className="text-xs text-warmgray">獎金由老闆設定，此頁僅供查看。</p>

      <section className="rounded-2xl border border-blush bg-white p-5 space-y-3">
        <h2 className="font-playfair text-lg text-charcoal">固定獎金</h2>
        {loading ? (
          <p className="text-sm text-warmgray">載入中…</p>
        ) : fixed.length === 0 ? (
          <p className="text-sm text-warmgray">尚未設置獎金</p>
        ) : (
          <ul className="divide-y divide-blush/60">
            {fixed.map((b) => (
              <li key={b.id} className="py-2">
                <p className="text-lg text-charcoal">{formatNTD(b.amount)}／月</p>
                <p className="text-xs text-warmgray">每月自動發放</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showPerformance && (
        <section className="rounded-2xl border border-blush bg-white p-5 space-y-3">
          <h2 className="font-playfair text-lg text-charcoal">業績獎金</h2>
          {loading ? (
            <p className="text-sm text-warmgray">載入中…</p>
          ) : performance.length === 0 ? (
            <p className="text-sm text-warmgray">尚未設置獎金</p>
          ) : (
            <ul className="divide-y divide-blush/60">
              {performance.map((b) => (
                <li key={b.id} className="py-2">
                  <p className="text-lg text-charcoal">{formatNTD(b.bonus_amount)}</p>
                  <p className="text-xs text-warmgray">
                    本店當月營業額達 {formatNTD(b.revenue_threshold)} 後發放
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

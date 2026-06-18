'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { PriceItem } from '@/lib/checkoutPricing'
import OrderForm, { OrderFormPayload } from '@/components/checkout/OrderForm'

export default function NewOrderPage() {
  const router = useRouter()
  const [priceItems, setPriceItems] = useState<PriceItem[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/checkout/prices', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setPriceItems)
      .catch(() => setPriceItems([]))
  }, [])

  const handleSubmit = async (payload: OrderFormPayload, finalize: boolean) => {
    setBusy(true)
    try {
      const res = await fetch('/api/checkout/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'manual', ...payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '建立失敗')
        return
      }
      if (finalize) {
        const sub = await fetch(`/api/checkout/orders/${data.id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmed: true }),
        })
        if (!sub.ok) {
          const e = await sub.json().catch(() => ({}))
          toast.error(e.error || '送出失敗（已存為草稿）')
          router.push('/checkout/orders')
          return
        }
        toast.success('已結帳送出')
      } else {
        toast.success('已存為草稿')
      }
      router.push('/checkout/orders')
    } catch {
      toast.error('發生錯誤')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-playfair text-2xl text-charcoal mb-4">手動結帳</h1>
      <div className="rounded-2xl border border-blush bg-white p-5">
        <OrderForm priceItems={priceItems} mode="create" busy={busy} onSubmit={handleSubmit} />
      </div>
    </div>
  )
}

import type { OrderStatus } from '@/lib/checkoutTypes'

const MAP: Record<OrderStatus, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-warmgray/15 text-warmgray' },
  submitted: { label: '已送出', className: 'bg-champagne/30 text-charcoal' },
  confirmed: { label: '已鎖定', className: 'bg-rose/15 text-rose-dark' },
}

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const cfg = MAP[status] || MAP.draft
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

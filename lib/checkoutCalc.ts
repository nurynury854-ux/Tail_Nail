// Single source of truth for order money math.
// Revenue (营业额) = sum of line totals.
// Stylist income (业绩) = round(revenue * income_rate), default 50%.

import { DEFAULT_INCOME_RATE, OrderItemInput } from './checkoutTypes'

export interface LineTotals {
  unit_price: number
  quantity: number
  discount: number
  line_total: number
}

export interface OrderTotals {
  gross: number
  discountTotal: number
  revenue: number
  stylistIncome: number
}

function toInt(value: unknown, fallback = 0): number {
  const n = Math.trunc(Number(value))
  return Number.isFinite(n) ? n : fallback
}

/** Compute a single line item's total: (unit_price * quantity) - discount, clamped at 0. */
export function computeLineTotal(item: Pick<OrderItemInput, 'unit_price' | 'quantity' | 'discount'>): number {
  const unit = Math.max(0, toInt(item.unit_price))
  const qty = Math.max(1, toInt(item.quantity, 1))
  const discount = Math.max(0, toInt(item.discount))
  return Math.max(0, unit * qty - discount)
}

/** Compute order-level totals from its line items. */
export function computeOrderTotals(
  items: Array<Pick<OrderItemInput, 'unit_price' | 'quantity' | 'discount'>>,
  incomeRate: number = DEFAULT_INCOME_RATE,
): OrderTotals {
  let gross = 0
  let discountTotal = 0
  let revenue = 0

  for (const item of items) {
    const unit = Math.max(0, toInt(item.unit_price))
    const qty = Math.max(1, toInt(item.quantity, 1))
    const discount = Math.max(0, toInt(item.discount))
    gross += unit * qty
    discountTotal += discount
    revenue += computeLineTotal(item)
  }

  const rate = Number.isFinite(incomeRate) ? incomeRate : DEFAULT_INCOME_RATE
  const stylistIncome = Math.round(revenue * rate)

  return { gross, discountTotal, revenue, stylistIncome }
}

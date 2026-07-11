// Single source of truth for order money math.
// Revenue (营业额) = sum of line totals.
// Stylist income (业绩) = round(revenue * income_rate), default 50%.

import { BIRTHDAY_DISCOUNT_RATE, DEFAULT_INCOME_RATE, OrderItemInput, REVIEW_INCENTIVE_AMOUNT } from './checkoutTypes'

export interface OrderDiscounts {
  review?: boolean // 客人留好評 — flat NT$50 off the total
  birthday?: boolean // 壽星優惠 — 10% off the total
}

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

/**
 * Compute order-level totals from its line items plus the two checkout discounts.
 * Order of operations for the discounts: 10% off first (壽星), then −NT$50 (好評).
 * `discountTotal` is the full gap between gross and the final revenue.
 */
export function computeOrderTotals(
  items: Array<Pick<OrderItemInput, 'unit_price' | 'quantity' | 'discount'>>,
  incomeRate: number = DEFAULT_INCOME_RATE,
  discounts: OrderDiscounts = {},
): OrderTotals {
  let gross = 0
  let subtotal = 0 // after per-line discounts

  for (const item of items) {
    const unit = Math.max(0, toInt(item.unit_price))
    const qty = Math.max(1, toInt(item.quantity, 1))
    gross += unit * qty
    subtotal += computeLineTotal(item)
  }

  let revenue = subtotal
  if (discounts.birthday) revenue = Math.round(revenue * BIRTHDAY_DISCOUNT_RATE)
  if (discounts.review) revenue = Math.max(0, revenue - REVIEW_INCENTIVE_AMOUNT)

  const discountTotal = gross - revenue
  const rate = Number.isFinite(incomeRate) ? incomeRate : DEFAULT_INCOME_RATE
  const stylistIncome = Math.round(revenue * rate)

  return { gross, discountTotal, revenue, stylistIncome }
}

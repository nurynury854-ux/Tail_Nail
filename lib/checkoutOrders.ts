// Shared persistence helpers for checkout orders.

import type { SupabaseClient } from '@supabase/supabase-js'
import { computeLineTotal } from './checkoutCalc'
import type { CheckoutOrder, DiscountType, OrderItemInput } from './checkoutTypes'

export interface NormalizedItem {
  service_id: string | null
  service_name_snapshot: string
  unit_price: number
  quantity: number
  discount: number
  discount_type: DiscountType | null
  line_total: number
}

/** Coerce raw item input into clean integer rows with computed line totals. */
export function normalizeItems(items: OrderItemInput[] | undefined): NormalizedItem[] {
  return (items || [])
    .map((it) => {
      const unit_price = Math.max(0, Math.trunc(Number(it.unit_price) || 0))
      const quantity = Math.max(1, Math.trunc(Number(it.quantity) || 1))
      const discount = Math.max(0, Math.trunc(Number(it.discount) || 0))
      const discount_type: DiscountType | null =
        it.discount_type || (discount > 0 ? 'manual' : null)
      return {
        service_id: it.service_id || null,
        service_name_snapshot: (it.service_name || '').trim(),
        unit_price,
        quantity,
        discount,
        discount_type,
        line_total: computeLineTotal({ unit_price, quantity, discount }),
      }
    })
    .filter((it) => it.service_name_snapshot.length > 0)
}

/** Fetch one order with its line items attached. */
export async function fetchOrderWithItems(
  admin: SupabaseClient,
  id: string,
): Promise<CheckoutOrder | null> {
  const { data: order } = await admin.from('checkout_orders').select('*').eq('id', id).maybeSingle()
  if (!order) return null
  const { data: items } = await admin
    .from('checkout_order_items')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: true })
  return { ...(order as CheckoutOrder), items: items || [] }
}

/** Replace an order's line items wholesale. */
export async function replaceOrderItems(
  admin: SupabaseClient,
  orderId: string,
  items: object[],
): Promise<void> {
  await admin.from('checkout_order_items').delete().eq('order_id', orderId)
  if (items.length) {
    await admin
      .from('checkout_order_items')
      .insert(items.map((it) => ({ ...it, order_id: orderId })))
  }
}

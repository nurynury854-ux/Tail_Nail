// Checkout pricing catalog: types + price resolution.
// Pure functions (no Supabase import) so both the client form and the server
// can resolve the authoritative price the same way.

import { computeLineTotal } from './checkoutCalc'
import type { DiscountType } from './checkoutTypes'

export type PricingMode = 'fixed' | 'tier' | 'per_unit' | 'manual'
export type PriceCategory = 'hand' | 'foot'

export interface PriceItem {
  id: string
  key: string
  name: string
  service_type: 'main' | 'addon'
  pricing_mode: PricingMode
  price_hand?: number | null
  price_foot?: number | null
  tiers_hand?: number[] | null
  tiers_foot?: number[] | null
  unit_price?: number | null
  unit_full_qty?: number | null
  unit_full_price?: number | null
  booking_service_id?: string | null
  sort_order?: number
  is_active?: boolean
}

export interface PriceSelection {
  category?: PriceCategory | null
  tierIndex?: number | null
  unitCount?: number | null
  manualPrice?: number | null
}

/** Authoritative unit price for a catalog item given the technician's selection. */
export function resolveUnitPrice(item: PriceItem, sel: PriceSelection): number {
  switch (item.pricing_mode) {
    case 'fixed':
      return Math.max(0, (sel.category === 'foot' ? item.price_foot : item.price_hand) || 0)
    case 'tier': {
      const tiers = (sel.category === 'foot' ? item.tiers_foot : item.tiers_hand) || []
      const idx = sel.tierIndex ?? 0
      return Math.max(0, tiers[idx] || 0)
    }
    case 'per_unit': {
      const n = Math.max(0, Math.trunc(sel.unitCount || 0))
      const fullQty = item.unit_full_qty || 0
      if (fullQty && n >= fullQty) return Math.max(0, item.unit_full_price || 0)
      return Math.max(0, n * (item.unit_price || 0))
    }
    case 'manual':
      return Math.max(0, Math.trunc(sel.manualPrice || 0))
    default:
      return 0
  }
}

// One line as submitted by the form.
export interface PricedItemInput {
  price_key?: string | null
  service_name?: string
  category?: PriceCategory | null
  tier_index?: number | null
  unit_count?: number | null
  manual_price?: number | null
  discount?: number
  discount_type?: DiscountType | null
}

// Normalized row ready to persist into checkout_order_items.
export interface BuiltOrderItem {
  service_id: string | null
  price_key: string | null
  service_name_snapshot: string
  category: PriceCategory | null
  unit_price: number
  quantity: number
  discount: number
  discount_type: DiscountType | null
  unit_count: number | null
  tier_index: number | null
  line_total: number
}

/**
 * Build persistable line items from form input + the price catalog.
 * The server calls this so the technician can never submit an off-catalog price
 * for a fixed/tier/per_unit item — only 'manual' items honor a typed price.
 */
export function buildOrderItems(
  catalog: Map<string, PriceItem>,
  inputs: PricedItemInput[] | undefined,
): BuiltOrderItem[] {
  return (inputs || [])
    .map((input) => {
      const item = input.price_key ? catalog.get(input.price_key) : undefined
      const discount = Math.max(0, Math.trunc(Number(input.discount) || 0))
      const discount_type: DiscountType | null =
        input.discount_type || (discount > 0 ? 'manual' : null)

      if (item) {
        const sel: PriceSelection = {
          category: input.category ?? 'hand',
          tierIndex: input.tier_index ?? 0,
          unitCount: input.unit_count ?? 0,
          manualPrice: input.manual_price ?? 0,
        }
        const unit_price = resolveUnitPrice(item, sel)
        return {
          service_id: item.booking_service_id || null,
          price_key: item.key,
          service_name_snapshot: item.name,
          category: sel.category ?? null,
          unit_price,
          quantity: 1,
          discount,
          discount_type,
          unit_count: item.pricing_mode === 'per_unit' ? sel.unitCount ?? 0 : null,
          tier_index: item.pricing_mode === 'tier' ? sel.tierIndex ?? 0 : null,
          line_total: computeLineTotal({ unit_price, quantity: 1, discount }),
        }
      }

      // Fully custom line (no catalog entry): honor the typed price.
      const unit_price = Math.max(0, Math.trunc(Number(input.manual_price) || 0))
      return {
        service_id: null,
        price_key: null,
        service_name_snapshot: (input.service_name || '').trim(),
        category: input.category ?? null,
        unit_price,
        quantity: 1,
        discount,
        discount_type,
        unit_count: null,
        tier_index: null,
        line_total: computeLineTotal({ unit_price, quantity: 1, discount }),
      }
    })
    .filter((it) => it.service_name_snapshot.length > 0)
}

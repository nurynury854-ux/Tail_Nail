// Server-only pricing helpers (imports the Supabase client type).
// Re-exports the pure pricing lib so routes can import from one place.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriceItem } from './checkoutPricing'

export * from './checkoutPricing'

/** Load the price catalog keyed by its stable `key`. */
export async function fetchPriceCatalog(admin: SupabaseClient): Promise<Map<string, PriceItem>> {
  const { data } = await admin.from('checkout_service_prices').select('*')
  const map = new Map<string, PriceItem>()
  for (const row of data || []) map.set(row.key, row as PriceItem)
  return map
}

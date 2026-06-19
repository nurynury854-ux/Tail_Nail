// Edit-logging for checkout orders. Every mutating route writes a row here so
// the owner gets a full audit trail (including blocked edit attempts).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CheckoutOrder, CheckoutSession, EditLogAction } from './checkoutTypes'

export interface FieldChange {
  field: string
  old: unknown
  new: unknown
}

// Order header fields worth diffing for the audit log.
// Customer identity fields are intentionally excluded so PII is never stored in
// the (manager-visible, long-lived) audit log.
const TRACKED_FIELDS: (keyof CheckoutOrder)[] = [
  'payment_method',
  'gross_amount',
  'discount_total',
  'revenue',
  'stylist_income',
  'status',
  'stylist_confirmed',
]

/** Produce a list of {field, old, new} for fields that actually changed. */
export function diffOrder(
  before: Partial<CheckoutOrder>,
  after: Partial<CheckoutOrder>,
): FieldChange[] {
  const changes: FieldChange[] = []
  for (const field of TRACKED_FIELDS) {
    const oldVal = before[field] ?? null
    const newVal = after[field] ?? null
    if (oldVal !== newVal) {
      changes.push({ field: String(field), old: oldVal, new: newVal })
    }
  }
  return changes
}

interface LogOrderEventArgs {
  orderId?: string | null
  orderIdText?: string | null
  branchId?: string | null
  actor: CheckoutSession
  action: EditLogAction
  fieldChanges?: FieldChange[] | null
  reason?: string | null
}

/** Insert a single audit-log row. Failures are swallowed (logging must never break a request). */
export async function logOrderEvent(
  admin: SupabaseClient,
  { orderId, orderIdText, branchId, actor, action, fieldChanges, reason }: LogOrderEventArgs,
): Promise<void> {
  try {
    await admin.from('order_edit_logs').insert({
      order_id: orderId ?? null,
      order_id_text: orderIdText ?? orderId ?? null,
      branch_id_snapshot: branchId ?? null,
      actor_account_id: actor.accountId === 'owner-bootstrap' ? null : actor.accountId,
      actor_name: actor.displayName,
      actor_role: actor.role,
      action,
      field_changes: fieldChanges && fieldChanges.length ? fieldChanges : null,
      reason: reason ?? null,
    })
  } catch (err) {
    console.error('logOrderEvent failed', err)
  }
}

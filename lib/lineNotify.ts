import type { SupabaseClient } from '@supabase/supabase-js'
import { getBranchLineConfig } from './lineConfig'
import { BRANCHES } from './types'

/**
 * Push a single text message to one LINE user through one branch's OA.
 * Throws on any non-2xx so callers can fall through to the next candidate.
 */
export async function sendLinePushMessage(
  userId: string,
  message: string,
  accessToken: string,
): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: message }],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`LINE push failed (${response.status}): ${errorBody}`)
  }
}

export type CustomerPushResult = {
  sent: boolean
  viaBranchId?: string
  errors: string[]
}

/**
 * Order the branch OAs to try for one customer, most likely first.
 *
 * A push only reaches a customer through an OA they have actually added as a
 * friend. They befriended the OA whose link they clicked, which is not
 * necessarily the branch they booked — so no single branch id is trustworthy on
 * its own. Pass the known hints in order of confidence (e.g. the OA a previous
 * message actually went out through, then the booking's source branch, then the
 * booked branch); every remaining configured branch is appended as a fallback.
 */
export function buildCandidateBranchIds(
  ...preferred: (string | null | undefined)[]
): string[] {
  return Array.from(
    new Set([
      ...preferred.filter((id): id is string => typeof id === 'string' && id.length > 0),
      ...BRANCHES.map((b) => b.id),
    ]),
  )
}

/**
 * Send one message to a customer, walking the candidate OAs until one succeeds.
 *
 * A push through an OA the customer hasn't added fails with 400 and the customer
 * silently gets nothing, so every customer-facing message must walk the list
 * rather than assume the booked branch's channel works.
 */
export async function sendCustomerPush(
  userId: string,
  message: string,
  candidateBranchIds: string[],
): Promise<CustomerPushResult> {
  const errors: string[] = []
  for (const branchId of candidateBranchIds) {
    const config = getBranchLineConfig(branchId)
    if (!config) continue
    try {
      await sendLinePushMessage(userId, message, config.channelAccessToken)
      return { sent: true, viaBranchId: branchId, errors }
    } catch (err) {
      errors.push(`branch ${branchId}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return { sent: false, errors }
}

/**
 * Best-effort read of the OA branch a previous message to this booking's
 * customer actually went out through.
 *
 * Tolerant by design: the `line_oa_branch_id` column may not exist yet on a
 * database that hasn't run supabase/line_oa_branch.sql. Returning null just
 * means the caller walks the full candidate list, exactly as before.
 */
export async function lookupOaBranch(
  admin: SupabaseClient,
  bookingId: string,
): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from('bookings')
      .select('line_oa_branch_id')
      .eq('id', bookingId)
      .maybeSingle()
    if (error) return null
    const value = (data as { line_oa_branch_id?: string | null } | null)?.line_oa_branch_id
    return value && value.trim() ? value : null
  } catch {
    return null
  }
}

/**
 * Best-effort record of the OA that just reached this customer, so the next
 * message to them starts with a channel known to work. Never throws: failing to
 * remember must not fail the message that already went out.
 */
export async function rememberOaBranch(
  admin: SupabaseClient,
  bookingId: string,
  branchId: string,
): Promise<void> {
  try {
    const { error } = await admin
      .from('bookings')
      .update({ line_oa_branch_id: branchId })
      .eq('id', bookingId)
    if (error) {
      console.warn(`Could not record line_oa_branch_id for ${bookingId}: ${error.message}`)
    }
  } catch (err) {
    console.warn('Could not record line_oa_branch_id:', err)
  }
}

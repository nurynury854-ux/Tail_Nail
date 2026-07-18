// Daily cleaning-duty (值日生) auto-assignment.
//
// Rules (per spec):
//  - Eligibility first: only active stylists at the branch, minus anyone off that
//    day (weekly day-off or a day-off override) — excluded regardless of rotation.
//  - Rotation: pick from whoever has gone the LONGEST without a turn (never-assigned
//    first, then oldest last-assignment), random tiebreak. Not strict fairness.
//  - Active-only means removed/transferred stylists drop out and new ones join
//    the rotation automatically.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface CleaningDutyRow {
  id: string
  branch_id: string
  duty_date: string
  stylist_id: string | null
  stylist_name_snapshot: string | null
  assigned_at?: string
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Eligible stylists for a branch on a date: active, minus anyone off that day. */
async function eligibleStylists(
  admin: SupabaseClient,
  branchId: string,
  date: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data: stylists } = await admin
    .from('stylists')
    .select('id, name')
    .eq('branch_id', branchId)
    .eq('is_active', true)
  const candidates = stylists || []
  if (candidates.length === 0) return []

  const dow = new Date(`${date}T00:00:00`).getDay() // 0=Sunday
  const ids = candidates.map((c) => c.id)
  const [{ data: weekly }, { data: overrides }] = await Promise.all([
    admin.from('stylist_weekly_hours').select('stylist_id, is_working').eq('day_of_week', dow).in('stylist_id', ids),
    admin.from('stylist_day_overrides').select('stylist_id, is_off').eq('date', date).in('stylist_id', ids),
  ])
  const offIds = new Set<string>()
  for (const w of weekly || []) if (w.is_working === false) offIds.add(w.stylist_id)
  for (const o of overrides || []) if (o.is_off === true) offIds.add(o.stylist_id)

  return candidates.filter((c) => !offIds.has(c.id))
}

/** Choose the eligible stylist who has gone longest without duty; null if none eligible. */
export async function pickCleaningStylist(
  admin: SupabaseClient,
  branchId: string,
  date: string,
): Promise<{ id: string; name: string } | null> {
  const available = await eligibleStylists(admin, branchId, date)
  if (available.length === 0) return null

  // Most recent past duty date per stylist (look back 180 days).
  const { data: recent } = await admin
    .from('cleaning_duty')
    .select('stylist_id, duty_date')
    .eq('branch_id', branchId)
    .gte('duty_date', addDays(date, -180))
    .lt('duty_date', date)
  const lastDuty = new Map<string, string>()
  for (const r of recent || []) {
    if (!r.stylist_id) continue
    const prev = lastDuty.get(r.stylist_id)
    if (!prev || r.duty_date > prev) lastDuty.set(r.stylist_id, r.duty_date)
  }

  // '' sorts before any date => never-assigned rank first (longest without a turn).
  const keyOf = (id: string) => lastDuty.get(id) ?? ''
  let minKey = '9999-99-99'
  for (const c of available) {
    const k = keyOf(c.id)
    if (k < minKey) minKey = k
  }
  const pool = available.filter((c) => keyOf(c.id) === minKey)
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Auto-assign (or reassign) duty for a branch/date. Returns the row, or null if nobody eligible. */
export async function autoAssignCleaning(
  admin: SupabaseClient,
  branchId: string,
  date: string,
): Promise<CleaningDutyRow | null> {
  const chosen = await pickCleaningStylist(admin, branchId, date)
  if (!chosen) return null
  const { data } = await admin
    .from('cleaning_duty')
    .upsert(
      {
        branch_id: branchId,
        duty_date: date,
        stylist_id: chosen.id,
        stylist_name_snapshot: chosen.name,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: 'branch_id,duty_date' },
    )
    .select()
    .single()
  return (data as CleaningDutyRow) ?? null
}

/** Ensure a branch has an assignment for a date — auto-assign only if one doesn't exist. */
export async function ensureCleaningAssigned(
  admin: SupabaseClient,
  branchId: string,
  date: string,
): Promise<CleaningDutyRow | null> {
  const { data: existing } = await admin
    .from('cleaning_duty')
    .select('*')
    .eq('branch_id', branchId)
    .eq('duty_date', date)
    .maybeSingle()
  if (existing) return existing as CleaningDutyRow
  return autoAssignCleaning(admin, branchId, date)
}

/** Ensure every branch has today's assignment (used by the daily cron). */
export async function ensureAllBranchesAssigned(
  admin: SupabaseClient,
  date: string,
): Promise<{ branch_id: string; assigned: string | null }[]> {
  const { data: branches } = await admin.from('branches').select('id')
  const results: { branch_id: string; assigned: string | null }[] = []
  for (const b of branches || []) {
    const row = await ensureCleaningAssigned(admin, b.id, date)
    results.push({ branch_id: b.id, assigned: row?.stylist_name_snapshot ?? null })
  }
  return results
}

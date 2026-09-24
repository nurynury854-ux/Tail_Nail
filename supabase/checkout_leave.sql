-- =====================================================================
-- Tail & Nail — Store Manager staff-leave scheduling
-- Run AFTER schema.sql and checkout_schema.sql. Safe to re-run.
--
-- Leave deliberately reuses the EXISTING stylist_day_overrides table rather
-- than adding a parallel one. That table is already the single source the
-- three required side-effects read from, so a manager's entry takes effect
-- immediately with no change to any of them:
--   • calendar availability — resolveStylistWindow() returns null on is_off,
--     so /api/slots and /api/bookings drop the technician for that date;
--   • 值日生 — eligibleStylists() in lib/cleaning.ts filters out is_off;
--   • 概率系統 — the unassigned-booking pool is built from the technicians
--     who still have a window, so an off technician is never a candidate
--     (probability 0) rather than being drawn and then rejected.
--
-- What is new is ATTRIBUTION: who created the entry, so a manager can be
-- stopped from touching one of Kenny's.
-- =====================================================================

ALTER TABLE stylist_day_overrides ADD COLUMN IF NOT EXISTS created_by_role       TEXT;
ALTER TABLE stylist_day_overrides ADD COLUMN IF NOT EXISTS created_by_account_id UUID;
ALTER TABLE stylist_day_overrides ADD COLUMN IF NOT EXISTS created_by_name       TEXT;

COMMENT ON COLUMN stylist_day_overrides.created_by_role IS
  'owner | manager. NULL = pre-dates leave scheduling, or was set from Kenny''s /admin panel; treated as owner-owned, so managers cannot modify it.';

-- Managers list their own branch's entries by date; the existing index is on
-- (stylist_id, date), which does not serve that.
CREATE INDEX IF NOT EXISTS idx_stylist_day_overrides_date
  ON stylist_day_overrides (date);

-- ── Audit ────────────────────────────────────────────────────────────
-- Every manager add/remove is written to order_edit_logs so it reaches the
-- Owner's 修改記錄 feed, same as cleaning overrides and cancellations.
ALTER TABLE order_edit_logs DROP CONSTRAINT IF EXISTS order_edit_logs_action_check;

ALTER TABLE order_edit_logs ADD CONSTRAINT order_edit_logs_action_check
  CHECK (action IN (
    'create', 'edit', 'submit', 'confirm',
    'blocked_edit_attempt', 'delete', 'actual_amount_adjust',
    'cancel_appointment', 'cleaning_override',
    'leave_add', 'leave_remove'
  ));

-- ── Verify ───────────────────────────────────────────────────────────
-- SELECT o.date, s.name, o.is_off, o.created_by_role, o.created_by_name
--   FROM stylist_day_overrides o JOIN stylists s ON s.id = o.stylist_id
--  WHERE o.is_off ORDER BY o.date DESC LIMIT 20;

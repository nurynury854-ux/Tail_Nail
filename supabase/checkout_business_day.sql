-- =====================================================================
-- Tail & Nail — 04:00 business-day cutoff (historical backfill)
-- Run AFTER checkout_schema.sql and checkout_pii.sql. Safe to re-run.
--
-- The salon day runs 04:00 -> 04:00: an order rung up at 03:00 on Aug 27
-- belongs to the Aug 26 shift. New orders are stamped correctly by the app
-- (lib/dateTW.ts -> taipeiBusinessDate). This script fixes rows written
-- BEFORE that change, which used the plain Taipei calendar date.
--
-- Raw timestamps (created_at, confirmed_at, submitted_at) are NEVER touched —
-- they remain the true clock time for audit. Only the business_date grouping
-- key moves, and only for orders created between 00:00 and 03:59 Taipei.
--
-- Financial fields are untouched, but note that monthly totals WILL shift for
-- any order created 00:00-03:59 on the 1st of a month: it moves into the
-- previous month's report. Take a backup before running.
-- =====================================================================

-- Preview first — run this SELECT and eyeball the rows before the UPDATE.
--
--   SELECT id, created_at, business_date,
--          ((created_at AT TIME ZONE 'Asia/Taipei') - INTERVAL '4 hours')::date AS new_business_date
--   FROM checkout_orders
--   WHERE EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Asia/Taipei')) < 4
--     AND business_date = (created_at AT TIME ZONE 'Asia/Taipei')::date
--   ORDER BY created_at;

BEGIN;

-- 1. Shift the grouping key back a day for pre-04:00 orders.
--    The second predicate skips any row whose business_date was corrected by
--    hand, so only untouched auto-stamped rows are rewritten.
UPDATE checkout_orders
SET business_date = ((created_at AT TIME ZONE 'Asia/Taipei') - INTERVAL '4 hours')::date
WHERE EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Asia/Taipei')) < 4
  AND business_date = (created_at AT TIME ZONE 'Asia/Taipei')::date;

-- 2. Re-derive the PII visibility anchor for manual walk-ins, whose
--    service_end_at is defined as the end of their business day. Calendar
--    imports take service_end_at from the booking's own end time, so they are
--    excluded; so is any row whose value no longer matches the old formula
--    (hand-edited), which is left exactly as it is.
UPDATE checkout_orders
SET service_end_at = ((business_date + INTERVAL '1 day' + INTERVAL '3 hours 59 minutes 59 seconds')
                       AT TIME ZONE 'Asia/Taipei')
WHERE source = 'manual'
  AND service_end_at IS NOT NULL
  AND (service_end_at AT TIME ZONE 'Asia/Taipei')::time = TIME '23:59:59';

COMMIT;

-- =====================================================================
-- Tail & Nail — Customer PII visibility support
-- Run AFTER checkout_schema.sql. Safe to re-run.
--
-- Adds a snapshot of when the service ends, so the API can gate customer
-- identity visibility per role/timer:
--   stylist  — phone never; name only until service_end_at
--   manager  — name + phone until service_end_at + 1 day
--   owner    — always (admin, permanent)
--
-- Financial fields (revenue, stylist_income, items) are never affected,
-- so monthly revenue/performance totals stay accurate.
-- =====================================================================

ALTER TABLE checkout_orders ADD COLUMN IF NOT EXISTS service_end_at TIMESTAMPTZ;

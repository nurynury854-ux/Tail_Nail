-- =====================================================================
-- Tail & Nail — remember which OA actually reached each customer
-- Run AFTER schema.sql. Safe to re-run.
--
-- A LINE push only lands through an Official Account the customer has added as
-- a friend. Customers befriend the OA whose link they clicked, which is often
-- NOT the branch they end up booking — so the booking's own branch_id is not a
-- reliable channel to message them through.
--
-- At booking time we walk every configured OA until one accepts the push. This
-- column records the one that worked, so later messages (cancellations,
-- reminders) start with a channel already proven to reach this customer instead
-- of guessing and silently failing with a 400.
--
-- NULL simply means "not known yet" — callers fall back to walking the list.
-- =====================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS line_oa_branch_id TEXT;

-- =====================================================================
-- Tail & Nail — order-level checkout discounts
-- Run AFTER checkout_schema.sql. Safe to re-run.
--
-- Two independent checkboxes at checkout, applied to the order total:
--   birthday_discount (壽星優惠)  -> total × 0.9
--   review_discount   (客人留好評) -> total − NT$50
-- When both apply, 0.9 is applied first, then −50 (revenue is stored discounted).
-- =====================================================================

ALTER TABLE checkout_orders ADD COLUMN IF NOT EXISTS review_discount   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE checkout_orders ADD COLUMN IF NOT EXISTS birthday_discount BOOLEAN NOT NULL DEFAULT FALSE;

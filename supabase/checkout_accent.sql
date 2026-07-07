-- =====================================================================
-- Tail & Nail — 跳色 (color-contrast) add-on
-- Run AFTER checkout_pricing.sql. Safe to re-run.
--
-- 跳色 is a per-finger add-on available only on 單色 / 貓眼. The rate is
-- stored on those base-service rows; other services have NULL (no 跳色).
-- Line price = base price + (跳色 fingers × accent_price).
-- =====================================================================

ALTER TABLE checkout_service_prices ADD COLUMN IF NOT EXISTS accent_price INT;

UPDATE checkout_service_prices SET accent_price = 50  WHERE key = 'solid';    -- 單色 +NT$50/指
UPDATE checkout_service_prices SET accent_price = 100 WHERE key = 'cat-eye';  -- 貓眼 +NT$100/指

-- How many fingers had 跳色 on a given order line.
ALTER TABLE checkout_order_items ADD COLUMN IF NOT EXISTS accent_count INT;

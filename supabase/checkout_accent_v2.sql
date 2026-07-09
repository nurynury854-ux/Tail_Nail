-- =====================================================================
-- Tail & Nail — 跳色 becomes bidirectional between 單色 and 貓眼
-- Run AFTER checkout_accent.sql. Safe to re-run.
--
-- The per-finger 跳色 rate is set by the service the accent fingers BECOME,
-- not by the base service:
--   base 單色 -> accent fingers are 貓眼 -> +NT$100 per finger
--   base 貓眼 -> accent fingers are 單色 -> +NT$50  per finger
--
-- accent_service_key names the accent service so the UI can label it.
-- Historical orders snapshot their own unit_price, so they are unaffected.
-- =====================================================================

ALTER TABLE checkout_service_prices ADD COLUMN IF NOT EXISTS accent_service_key TEXT;

UPDATE checkout_service_prices
   SET accent_price = 100, accent_service_key = 'cat-eye'
 WHERE key = 'solid';

UPDATE checkout_service_prices
   SET accent_price = 50, accent_service_key = 'solid'
 WHERE key = 'cat-eye';

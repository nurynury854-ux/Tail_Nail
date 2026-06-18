-- =====================================================================
-- Tail & Nail — Checkout pricing catalog
-- Run AFTER checkout_schema.sql. Safe to re-run (idempotent).
--
-- Per-category (hand/foot) fixed prices, plus special pricing modes:
--   fixed    — price_hand / price_foot
--   tier     — tiers_hand / tiers_foot (technician picks a tier)
--   per_unit — unit_price each, auto-switch to unit_full_price at unit_full_qty
--   manual   — technician enters the price at point of sale (no fixed price)
--
-- Only the Owner edits these (enforced in the API layer).
-- =====================================================================

CREATE TABLE IF NOT EXISTS checkout_service_prices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key               TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  service_type      TEXT NOT NULL CHECK (service_type IN ('main', 'addon')),
  pricing_mode      TEXT NOT NULL CHECK (pricing_mode IN ('fixed', 'tier', 'per_unit', 'manual')),
  price_hand        INT,
  price_foot        INT,
  tiers_hand        JSONB,            -- e.g. [599, 799, 990]
  tiers_foot        JSONB,            -- e.g. [699, 899, 1090]
  unit_price        INT,             -- per_unit: price per finger/toe
  unit_full_qty     INT,             -- per_unit: count at which the flat rate kicks in
  unit_full_price   INT,             -- per_unit: flat rate for a full set
  booking_service_id TEXT,           -- links to services(id) for calendar import
  sort_order        INT NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_prices_sort ON checkout_service_prices (sort_order);

-- Extra detail columns on order items for the new pricing modes.
ALTER TABLE checkout_order_items ADD COLUMN IF NOT EXISTS price_key   TEXT;
ALTER TABLE checkout_order_items ADD COLUMN IF NOT EXISTS category    TEXT;
ALTER TABLE checkout_order_items ADD COLUMN IF NOT EXISTS unit_count  INT;
ALTER TABLE checkout_order_items ADD COLUMN IF NOT EXISTS tier_index  INT;

-- RLS (permissive, matches existing demo posture; auth enforced in API).
ALTER TABLE checkout_service_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checkout_service_prices_all ON checkout_service_prices;
CREATE POLICY checkout_service_prices_all ON checkout_service_prices FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- Seed the catalog. ON CONFLICT DO NOTHING so re-running never clobbers
-- prices the Owner has since edited.
-- ---------------------------------------------------------------------
INSERT INTO checkout_service_prices
  (key, name, service_type, pricing_mode, price_hand, price_foot, tiers_hand, tiers_foot, unit_price, unit_full_qty, unit_full_price, booking_service_id, sort_order)
VALUES
  ('solid',           '單色',         'main',  'fixed',    300, 400, NULL, NULL, NULL, NULL, NULL, 'svc-main-solid',        1),
  ('cat-eye',         '貓眼',         'main',  'fixed',    599, 699, NULL, NULL, NULL, NULL, NULL, 'svc-main-cat-eye',      2),
  ('gradient',        '漸層',         'main',  'fixed',    899, 999, NULL, NULL, NULL, NULL, NULL, 'svc-main-gradient',     3),
  ('french',          '法式',         'main',  'fixed',    899, 999, NULL, NULL, NULL, NULL, NULL, 'svc-main-french',       4),
  ('mirror',          '鏡面',         'main',  'fixed',    799, 899, NULL, NULL, NULL, NULL, NULL, 'svc-main-mirror',       5),
  ('store-style',     '店內款式',     'main',  'tier',     NULL, NULL, '[599,799,990]'::jsonb, '[699,899,1090]'::jsonb, NULL, NULL, NULL, 'svc-main-store-style', 6),
  ('custom-design',   '自帶圖款式',   'main',  'manual',   NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'svc-main-custom-style', 7),
  ('remove-continued','卸甲續作',     'addon', 'fixed',    200, 200, NULL, NULL, NULL, NULL, NULL, 'svc-addon-remove',      8),
  ('remove-only',     '純卸甲',       'addon', 'fixed',    400, 400, NULL, NULL, NULL, NULL, NULL, NULL,                    9),
  ('care',            '保養＊',       'addon', 'fixed',    399, 599, NULL, NULL, NULL, NULL, NULL, 'svc-addon-care',       10),
  ('shape',           '純修甲＊',     'addon', 'fixed',    129, 199, NULL, NULL, NULL, NULL, NULL, 'svc-addon-shape',      11),
  ('thicken',         '加厚',         'addon', 'fixed',    200, 200, NULL, NULL, NULL, NULL, NULL, 'svc-addon-thicken',    12),
  ('extension',       '延甲（單指／十指）', 'addon', 'per_unit', NULL, NULL, NULL, NULL, 120, 10, 900, 'svc-addon-extension', 13),
  ('repair',          '補甲',         'addon', 'manual',   NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'svc-addon-repair',     14)
ON CONFLICT (key) DO NOTHING;

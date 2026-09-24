-- =====================================================================
-- Tail & Nail — spec update
--   1) 美甲師「點點」renamed to「不點」
--   2) 自帶圖款式 estimated duration 120 → 150 minutes (2.5 hours)
--
-- Run in Supabase SQL Editor AFTER schema.sql / seed.sql. Safe to re-run.
--
-- The app also carries these values in code:
--   lib/serviceDurations.ts  (UNIVERSAL_DURATIONS — authoritative for the
--                             end time written on every new booking)
--   lib/types.ts             (SERVICES fallback catalog)
--   app/api/stylists/route.ts(defaults applied to newly created stylists)
--   supabase/seed.sql        (不點 + the 150-minute rows)
-- This file only brings an already-deployed database in line with them.
-- =====================================================================

-- ── 1. Stylist rename ────────────────────────────────────────────────
-- Matched by name as well as by id: the row may have been created from
-- /admin rather than from seed.sql, in which case its id is a UUID.
UPDATE stylists SET name = '不點' WHERE name = '點點';
UPDATE stylists SET name = '不點' WHERE id = 'sty-budian' AND name <> '不點';

-- ── 2. 自帶圖款式 = 150 minutes ──────────────────────────────────────
-- Housekeeping only, and safe to skip: service_durations is currently
-- write-only (seeded here, written by /api/stylists when a stylist is
-- created, read by nothing). Both /api/service-durations and /api/bookings
-- resolve the duration from UNIVERSAL_DURATIONS in code, so 2.5h is already
-- live without this. Applied to every stylist, hand and foot alike, so the
-- table does not go stale if it is ever read again.
UPDATE service_durations
   SET duration_minutes = 150,
       is_pending = false
 WHERE service_id = 'svc-main-custom-style';

-- Any stylist missing the row entirely (created before this service, or
-- inserted without the duration defaults) gets it at the new value.
INSERT INTO service_durations (stylist_id, service_id, category, duration_minutes, is_pending)
SELECT s.id, 'svc-main-custom-style', c.category, 150, false
  FROM stylists s
 CROSS JOIN (SELECT 'hand' AS category UNION ALL SELECT 'foot') c
ON CONFLICT (stylist_id, service_id, category) DO UPDATE SET
  duration_minutes = EXCLUDED.duration_minutes,
  is_pending = EXCLUDED.is_pending;

-- ── Verify ───────────────────────────────────────────────────────────
-- SELECT name FROM stylists WHERE name IN ('點點', '不點');
-- SELECT stylist_id, category, duration_minutes FROM service_durations
--  WHERE service_id = 'svc-main-custom-style' ORDER BY stylist_id, category;

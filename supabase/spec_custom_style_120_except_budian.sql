-- =====================================================================
-- Tail & Nail — spec update
--   自帶圖款式 estimated duration 150 → 120 minutes (2 hours) for every
--   stylist EXCEPT 不點, who stays at 150 minutes (2.5 hours).
--
-- Supersedes spec_budian_custom_style_150.sql, which put everyone at 150.
-- Run in Supabase SQL Editor AFTER schema.sql / seed.sql. Safe to re-run.
--
-- The app also carries these values in code:
--   lib/serviceDurations.ts   (UNIVERSAL_DURATIONS = 120, plus the 不點
--                              override — authoritative for the end time
--                              written on every new booking)
--   lib/types.ts              (SERVICES fallback catalog)
--   app/api/stylists/route.ts (defaults applied to newly created stylists)
--   supabase/seed.sql         (per-stylist rows)
-- This file only brings an already-deployed database in line with them.
-- Existing bookings keep the end time they were written with.
-- =====================================================================

-- ── Everyone drops to 2 hours ────────────────────────────────────────
-- Housekeeping only, and safe to skip: service_durations is currently
-- write-only (seeded here, written by /api/stylists when a stylist is
-- created, read by nothing). Both /api/service-durations and /api/bookings
-- resolve the duration from lib/serviceDurations.ts, so 2h is already live
-- without this. Applied anyway so the table does not go stale.
UPDATE service_durations
   SET duration_minutes = 120,
       is_pending = false
 WHERE service_id = 'svc-main-custom-style';

-- Any stylist missing the row entirely (created before this service, or
-- inserted without the duration defaults) gets it at the new value.
INSERT INTO service_durations (stylist_id, service_id, category, duration_minutes, is_pending)
SELECT s.id, 'svc-main-custom-style', c.category, 120, false
  FROM stylists s
 CROSS JOIN (SELECT 'hand' AS category UNION ALL SELECT 'foot') c
ON CONFLICT (stylist_id, service_id, category) DO UPDATE SET
  duration_minutes = EXCLUDED.duration_minutes,
  is_pending = EXCLUDED.is_pending;

-- ── 不點 keeps 2.5 hours ─────────────────────────────────────────────
-- Matched by name as well as by id: the row may have been created from
-- /admin rather than from seed.sql, in which case its id is a UUID. The
-- code override in lib/serviceDurations.ts matches the same two ways.
UPDATE service_durations
   SET duration_minutes = 150,
       is_pending = false
 WHERE service_id = 'svc-main-custom-style'
   AND stylist_id IN (SELECT id FROM stylists WHERE id = 'sty-budian' OR name = '不點');

-- ── Verify ───────────────────────────────────────────────────────────
-- SELECT s.name, d.category, d.duration_minutes
--   FROM service_durations d JOIN stylists s ON s.id = d.stylist_id
--  WHERE d.service_id = 'svc-main-custom-style' ORDER BY s.name, d.category;

-- Bookings showing up with no stylist (stylist_id IS NULL).
--
-- The booking API always assigns a technician (不指定 just means the system
-- picks one), so a NULL stylist_id is never created by a booking. It was
-- produced by the database: bookings.stylist_id and accounts.stylist_id were
-- FOREIGN KEY ... ON DELETE SET NULL, so deleting a stylist in /admin
-- silently blanked every booking she ever had and unlinked her checkout login.
--
-- The API now deactivates a stylist that has bookings/an account instead of
-- deleting her. This migration makes the database enforce the same thing, so
-- no other path (SQL editor, Supabase dashboard, future code) can do it again.
--
-- Run in the Supabase SQL editor. Safe to re-run.

-- ── 1. Diagnose (read-only) ────────────────────────────────────────────────
-- How many bookings / logins have lost their stylist, and since when:
--
-- SELECT status, COUNT(*), MIN(date), MAX(date), MIN(created_at), MAX(created_at)
--   FROM bookings WHERE stylist_id IS NULL GROUP BY status;
--
-- SELECT id, username, display_name, role, branch_id
--   FROM accounts WHERE stylist_id IS NULL AND role IN ('stylist', 'manager');

-- ── 2. Recover what can be recovered (review before running the UPDATE) ───
-- A booking that was checked out has an order that snapshotted the
-- technician's NAME. Match that name to a current stylist row in the same
-- branch to see what each orphaned booking should point at:
--
-- SELECT b.id, b.date, b.start_time, b.branch_id, o.stylist_name_snapshot, s.id AS current_stylist_id
--   FROM bookings b
--   JOIN checkout_orders o ON o.booking_id = b.id
--   LEFT JOIN stylists s ON s.name = o.stylist_name_snapshot AND s.branch_id = b.branch_id
--  WHERE b.stylist_id IS NULL
--  ORDER BY b.date;
--
-- If those matches look right:
--
-- UPDATE bookings b SET stylist_id = s.id
--   FROM checkout_orders o, stylists s
--  WHERE o.booking_id = b.id
--    AND s.name = o.stylist_name_snapshot AND s.branch_id = b.branch_id
--    AND b.stylist_id IS NULL;
--
-- Upcoming confirmed bookings with no order yet cannot be inferred from data;
-- reassign those by hand (the branch's LINE 新預約 notification names the
-- technician the system picked).

-- ── 3. Make it impossible to orphan a booking again ────────────────────────
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_stylist_id_fkey,
  ADD CONSTRAINT bookings_stylist_id_fkey
  FOREIGN KEY (stylist_id) REFERENCES stylists(id) ON DELETE RESTRICT;

ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_stylist_id_fkey,
  ADD CONSTRAINT accounts_stylist_id_fkey
  FOREIGN KEY (stylist_id) REFERENCES stylists(id) ON DELETE RESTRICT;

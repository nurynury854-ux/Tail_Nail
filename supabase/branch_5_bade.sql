-- =====================================================================
-- Tail & Nail — add 八德興仁店 as branch id '5'
-- Run in Supabase SQL Editor AFTER schema.sql. Safe to re-run.
--
-- The app also has this branch in the hardcoded BRANCHES seed (lib/types.ts)
-- and a LINE config slot reading LINE_BRANCH_5_* env vars (lib/lineConfig.ts).
-- The DB row is still required: bookings.branch_id / stylists.branch_id /
-- accounts.branch_id all reference branches(id), and /api/branches serves
-- the branch list from this table.
-- =====================================================================

INSERT INTO branches (id, name, address, staff_count, phone, image_url) VALUES
  ('5', '八德興仁店', '桃園市八德區興仁里', 2, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  staff_count = EXCLUDED.staff_count;

-- Default opening hours, same as the other branches (11:00–21:00 daily).
-- Change later from /admin if this store runs different hours.
INSERT INTO branch_working_hours (
  branch_id,
  monday_open, monday_close,
  tuesday_open, tuesday_close,
  wednesday_open, wednesday_close,
  thursday_open, thursday_close,
  friday_open, friday_close,
  saturday_open, saturday_close,
  sunday_open, sunday_close
) VALUES
  ('5', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00')
ON CONFLICT (branch_id) DO NOTHING;

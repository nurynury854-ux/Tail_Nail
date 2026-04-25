-- ============================================================
-- Ttail Nail — Supabase Database Schema
-- Run this in Supabase SQL Editor to create the tables
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- BRANCHES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  name        TEXT NOT NULL,
  address     TEXT NOT NULL,
  staff_count INTEGER NOT NULL DEFAULT 2,
  phone       TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- SERVICES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  name              TEXT NOT NULL,
  service_type      TEXT NOT NULL DEFAULT 'main' CHECK (service_type IN ('main', 'addon')),
  is_addon          BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  duration_minutes  INTEGER,
  price             INTEGER DEFAULT 0,  -- in NTD
  description       TEXT,
  category          TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- backward-compatible migration for older databases
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'main';
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_addon BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE services ALTER COLUMN duration_minutes DROP NOT NULL;

-- ────────────────────────────────────────────────────────────
-- BOOKINGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  service_id      TEXT REFERENCES services(id) ON DELETE SET NULL,
  stylist_id      TEXT,
  customer_name   TEXT NOT NULL,
  line_id         TEXT NOT NULL,
  phone           TEXT,
  selected_services JSONB NOT NULL DEFAULT '[]'::JSONB,
  category        TEXT CHECK (category IN ('hand', 'foot')),
  total_duration  INTEGER NOT NULL DEFAULT 0,
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  status          TEXT NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stylist_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS selected_services JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_duration INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_category_check;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_category_check
  CHECK (category IN ('hand', 'foot') OR category IS NULL);

-- ────────────────────────────────────────────────────────────
-- STYLISTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stylists (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  branch_id   TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  bio         TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_stylist_id_fkey,
  ADD CONSTRAINT bookings_stylist_id_fkey
  FOREIGN KEY (stylist_id) REFERENCES stylists(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- SERVICE DURATIONS (per stylist + hand/foot)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_durations (
  id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  stylist_id        TEXT NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  service_id        TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  category          TEXT NOT NULL CHECK (category IN ('hand', 'foot')),
  duration_minutes  INTEGER NOT NULL,
  duration_note     TEXT,
  is_pending        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stylist_id, service_id, category)
);

-- ────────────────────────────────────────────────────────────
-- BRANCH WEEKLY HOURS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branch_working_hours (
  branch_id        TEXT PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  monday_open      TIME,
  monday_close     TIME,
  tuesday_open     TIME,
  tuesday_close    TIME,
  wednesday_open   TIME,
  wednesday_close  TIME,
  thursday_open    TIME,
  thursday_close   TIME,
  friday_open      TIME,
  friday_close     TIME,
  saturday_open    TIME,
  saturday_close   TIME,
  sunday_open      TIME,
  sunday_close     TIME,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- STYLIST WEEKLY HOURS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stylist_weekly_hours (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  stylist_id   TEXT NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME,
  end_time     TIME,
  is_working   BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stylist_id, day_of_week)
);

-- ────────────────────────────────────────────────────────────
-- BRANCH DAY OVERRIDES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branch_day_overrides (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  branch_id   TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  open_time   TIME,
  close_time  TIME,
  is_closed   BOOLEAN NOT NULL DEFAULT false,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, date)
);

-- ────────────────────────────────────────────────────────────
-- STYLIST DAY OVERRIDES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stylist_day_overrides (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  stylist_id  TEXT NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TIME,
  end_time    TIME,
  is_off      BOOLEAN NOT NULL DEFAULT false,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stylist_id, date)
);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_branch_date
  ON bookings (branch_id, date);

CREATE INDEX IF NOT EXISTS idx_bookings_date
  ON bookings (date);

CREATE INDEX IF NOT EXISTS idx_bookings_status
  ON bookings (status);

CREATE INDEX IF NOT EXISTS idx_bookings_stylist_date
  ON bookings (stylist_id, date);

CREATE INDEX IF NOT EXISTS idx_bookings_category
  ON bookings (category);

CREATE INDEX IF NOT EXISTS idx_stylists_branch
  ON stylists (branch_id, is_active);

CREATE INDEX IF NOT EXISTS idx_stylist_weekly_hours_day
  ON stylist_weekly_hours (stylist_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_branch_day_overrides
  ON branch_day_overrides (branch_id, date);

CREATE INDEX IF NOT EXISTS idx_stylist_day_overrides
  ON stylist_day_overrides (stylist_id, date);

CREATE INDEX IF NOT EXISTS idx_service_durations_lookup
  ON service_durations (stylist_id, service_id, category);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

-- Branches: public read
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches_public_read" ON branches
  FOR SELECT USING (true);

-- Services: public read
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_public_read" ON services
  FOR SELECT USING (true);

CREATE POLICY "services_public_write" ON services
  FOR ALL USING (true) WITH CHECK (true);

-- Bookings: public insert + read (demo mode - no auth needed)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_public_insert" ON bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "bookings_public_read" ON bookings
  FOR SELECT USING (true);

CREATE POLICY "bookings_public_update" ON bookings
  FOR UPDATE USING (true);

CREATE POLICY "bookings_public_delete" ON bookings
  FOR DELETE USING (true);

-- Stylists: public read/write (demo mode)
ALTER TABLE stylists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stylists_public_read" ON stylists
  FOR SELECT USING (true);
CREATE POLICY "stylists_public_write" ON stylists
  FOR ALL USING (true) WITH CHECK (true);

-- Service durations: public read/write (demo mode)
ALTER TABLE service_durations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_durations_public_read" ON service_durations
  FOR SELECT USING (true);
CREATE POLICY "service_durations_public_write" ON service_durations
  FOR ALL USING (true) WITH CHECK (true);

-- Branch working hours: public read/write (demo mode)
ALTER TABLE branch_working_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branch_hours_public_read" ON branch_working_hours
  FOR SELECT USING (true);
CREATE POLICY "branch_hours_public_write" ON branch_working_hours
  FOR ALL USING (true) WITH CHECK (true);

-- Stylist weekly hours: public read/write (demo mode)
ALTER TABLE stylist_weekly_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stylist_weekly_public_read" ON stylist_weekly_hours
  FOR SELECT USING (true);
CREATE POLICY "stylist_weekly_public_write" ON stylist_weekly_hours
  FOR ALL USING (true) WITH CHECK (true);

-- Branch day overrides: public read/write (demo mode)
ALTER TABLE branch_day_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branch_override_public_read" ON branch_day_overrides
  FOR SELECT USING (true);
CREATE POLICY "branch_override_public_write" ON branch_day_overrides
  FOR ALL USING (true) WITH CHECK (true);

-- Stylist day overrides: public read/write (demo mode)
ALTER TABLE stylist_day_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stylist_override_public_read" ON stylist_day_overrides
  FOR SELECT USING (true);
CREATE POLICY "stylist_override_public_write" ON stylist_day_overrides
  FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- HELPER FUNCTION: check slot availability
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_slot_availability(
  p_branch_id TEXT,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME
)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM bookings
  WHERE branch_id = p_branch_id
    AND date = p_date
    AND status = 'confirmed'
    AND start_time < p_end_time
    AND end_time > p_start_time;
$$ LANGUAGE SQL;

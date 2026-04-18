-- ============================================================
-- Lumière Nails — Supabase Database Schema
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
  duration_minutes  INTEGER NOT NULL,
  price             INTEGER NOT NULL,  -- in NTD
  description       TEXT,
  category          TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- BOOKINGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  service_id      TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  customer_name   TEXT NOT NULL,
  line_id         TEXT NOT NULL,
  phone           TEXT,
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  status          TEXT NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
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

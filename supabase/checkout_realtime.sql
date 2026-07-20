-- =====================================================================
-- Tail & Nail — realtime calendar updates
-- Run AFTER checkout_schema.sql. Safe to re-run.
--
-- Clients need a websocket push when an appointment changes so every open
-- calendar updates instantly. They must NOT subscribe to `bookings` directly:
-- Supabase Realtime would deliver the full row (customer name + phone) to every
-- browser, bypassing the role/timer redaction we enforce server-side.
--
-- Instead the server writes a PII-FREE signal row here. Clients subscribe to
-- this table and, on a change, re-fetch through the redacting API. Websocket
-- push (not polling), with no customer data on the wire.
-- =====================================================================

CREATE TABLE IF NOT EXISTS booking_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID,
  branch_id  TEXT,
  action     TEXT NOT NULL,   -- 'cancelled' | 'created' | 'updated'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_branch ON booking_events (branch_id, created_at);

ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS booking_events_all ON booking_events;
CREATE POLICY booking_events_all ON booking_events FOR ALL USING (true) WITH CHECK (true);

-- Publish to Supabase Realtime (guarded so re-running doesn't error).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'booking_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE booking_events;
  END IF;
END $$;

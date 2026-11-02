-- Close the database to the public anon key.
--
-- NEXT_PUBLIC_SUPABASE_ANON_KEY is inlined into the browser bundle (it has to
-- be, for realtime), and every table had RLS policies granting the anon role
-- full access (USING (true)) — so anyone could read every customer's name,
-- phone and LINE id, rewrite or delete bookings and orders, and edit staff
-- accounts (roles, password hashes) straight through the Supabase REST API.
--
-- The server never needed those policies: every API route now uses the
-- service-role client, which bypasses RLS. The browser only needs to receive
-- realtime INSERTs on booking_events (ids/branch/action, no customer data).
--
-- ORDER MATTERS: run this only after the deploy that moved the API routes to
-- the service-role client is live, or the site loses access to its data.
-- Safe to re-run.

-- Record whether the customer chose her stylist (vs 不指定). NULL for bookings
-- made before this existed. Used by admin reassignment when a stylist leaves.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stylist_requested BOOLEAN;

DO $$
DECLARE
  p record;
  t record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;

  -- RLS on with no policy = closed to anon/authenticated; service role unaffected.
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

CREATE POLICY booking_events_realtime_read ON booking_events FOR SELECT USING (true);

-- Check: the only policy left should be booking_events_realtime_read.
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';

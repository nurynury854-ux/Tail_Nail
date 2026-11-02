-- Failed admin/checkout logins, shared across all server instances so the
-- per-IP and per-username caps in lib/loginThrottle.ts hold on Vercel (the
-- in-memory limiter only sees one instance). Rows older than a day are pruned
-- by the app. RLS on, no policies: only the service-role client touches it.
-- Safe to re-run. Until this exists, logins still work (the throttle fails open).

CREATE TABLE IF NOT EXISTS login_failures (
  id         BIGSERIAL PRIMARY KEY,
  key        TEXT NOT NULL,           -- '<admin|checkout>:ip:<ip>' or '<admin|checkout>:user:<username>'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_failures_key_time ON login_failures (key, created_at);

ALTER TABLE login_failures ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Tail & Nail — Checkout / POS system schema
-- Separate from schema.sql so the booking app schema stays untouched.
-- Money is stored as integers (NTD, no cents) to match services.price.
-- RLS is left permissive (true) to match the existing demo posture —
-- authorization is enforced in the API layer (lib/checkoutAuth.ts), NOT the DB.
--
-- CORE RULE: every order SNAPSHOTS branch/stylist/names at creation.
-- All reporting groups by *_snapshot columns and NEVER joins to the live
-- stylists.branch_id. This is what keeps revenue with the original store
-- when a technician is transferred or deleted.
-- =====================================================================

-- gen_random_uuid() comes from pgcrypto; ensure it is available.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- accounts — login identities for the checkout system
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,                 -- PBKDF2-SHA256 hex digest
  password_salt TEXT NOT NULL,                 -- per-account random salt (hex)
  role          TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'stylist')),
  -- current assignment (referenced, NOT snapshotted): used for scoping views/login
  branch_id     TEXT REFERENCES branches(id) ON DELETE SET NULL,
  -- optional link to a technician row (managers & stylists who take clients)
  stylist_id    TEXT REFERENCES stylists(id) ON DELETE SET NULL,
  display_name  TEXT NOT NULL,
  subtitle      TEXT,                           -- owner-editable one-line note under name
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID,                           -- accounts.id of creator (soft ref)
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_branch ON accounts (branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_stylist ON accounts (stylist_id);

-- ---------------------------------------------------------------------
-- checkout_orders — one settled (or in-progress) transaction
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkout_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SNAPSHOT fields (frozen at creation, never derived from live rows) ---
  branch_id_snapshot    TEXT NOT NULL,
  branch_name_snapshot  TEXT NOT NULL,
  stylist_id_snapshot   TEXT,                   -- nullable: account may later be deleted
  stylist_name_snapshot TEXT NOT NULL,          -- always present, even after deletion
  account_id_snapshot   UUID,                   -- who created it (soft ref)

  -- reference link (convenience; may dangle) ---
  booking_id            UUID REFERENCES bookings(id) ON DELETE SET NULL,
  source                TEXT NOT NULL CHECK (source IN ('calendar', 'manual')),

  -- customer ---
  customer_name         TEXT,
  customer_phone        TEXT,

  -- money (auto-calculated, see lib/checkoutCalc.ts) ---
  gross_amount          INT NOT NULL DEFAULT 0,   -- sum of line (unit_price * qty)
  discount_total        INT NOT NULL DEFAULT 0,   -- sum of line discounts
  revenue               INT NOT NULL DEFAULT 0,   -- 营业额 = gross - discount
  stylist_income        INT NOT NULL DEFAULT 0,   -- 业绩 = round(revenue * income_rate)
  income_rate           NUMERIC(4,3) NOT NULL DEFAULT 0.500,  -- frozen per order
  payment_method        TEXT CHECK (payment_method IN ('cash', 'transfer')),

  -- state machine: draft -> submitted -> confirmed (locked) ---
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'submitted', 'confirmed')),
  stylist_confirmed     BOOLEAN NOT NULL DEFAULT FALSE,  -- the "I confirm" checkbox
  submitted_at          TIMESTAMPTZ,
  submitted_by          UUID,
  confirmed_at          TIMESTAMPTZ,
  confirmed_by          UUID,

  business_date         DATE NOT NULL,            -- salon day for daily/monthly grouping
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_branch_date ON checkout_orders (branch_id_snapshot, business_date);
CREATE INDEX IF NOT EXISTS idx_orders_stylist_date ON checkout_orders (stylist_id_snapshot, business_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON checkout_orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_booking ON checkout_orders (booking_id);

-- ---------------------------------------------------------------------
-- checkout_order_items — line items (one order -> many)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkout_order_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES checkout_orders(id) ON DELETE CASCADE,
  service_id            TEXT REFERENCES services(id) ON DELETE SET NULL,  -- NULL for custom line
  service_name_snapshot TEXT NOT NULL,
  unit_price            INT NOT NULL DEFAULT 0,   -- snapshot of services.price at add time
  quantity              INT NOT NULL DEFAULT 1,
  discount              INT NOT NULL DEFAULT 0,
  discount_type         TEXT CHECK (discount_type IN ('manual', 'review_incentive')),
  line_total            INT NOT NULL DEFAULT 0,   -- (unit_price * quantity) - discount
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON checkout_order_items (order_id);

-- ---------------------------------------------------------------------
-- order_edit_logs — full audit trail for the owner
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_edit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID REFERENCES checkout_orders(id) ON DELETE SET NULL,
  order_id_text    TEXT,                          -- human ref kept even after deletion
  branch_id_snapshot TEXT,                        -- so managers can see own-store logs
  actor_account_id UUID,
  actor_name       TEXT NOT NULL,                 -- "[name] modified [order]..."
  actor_role       TEXT NOT NULL,
  action           TEXT NOT NULL CHECK (action IN (
                     'create', 'edit', 'submit', 'confirm',
                     'blocked_edit_attempt', 'delete', 'actual_amount_adjust')),
  field_changes    JSONB,                         -- [{ field, old, new }]
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edit_logs_order ON order_edit_logs (order_id);
CREATE INDEX IF NOT EXISTS idx_edit_logs_branch ON order_edit_logs (branch_id_snapshot, created_at);

-- ---------------------------------------------------------------------
-- actual_amount_adjustments — manager till reconciliation
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actual_amount_adjustments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id_snapshot TEXT NOT NULL,
  business_date      DATE NOT NULL,
  system_total       INT NOT NULL,                -- computed revenue total for the day
  actual_total       INT NOT NULL,                -- real cash-register total
  difference         INT NOT NULL,                -- actual - system
  reason             TEXT NOT NULL,               -- REQUIRED note
  account_id         UUID,
  account_name       TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actual_amount_branch_date
  ON actual_amount_adjustments (branch_id_snapshot, business_date);

-- =====================================================================
-- Later-phase tables — defined now so the migration is one-shot.
-- Not referenced by Phase 1 code.
-- =====================================================================

-- Fixed bonus: owner sets once, auto-applies every month until removed.
CREATE TABLE IF NOT EXISTS fixed_bonuses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylist_id_snapshot   TEXT,
  stylist_name_snapshot TEXT,
  amount                INT NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from        DATE,
  set_by                UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance bonus: paid automatically once a revenue threshold is hit.
CREATE TABLE IF NOT EXISTS performance_bonuses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope                 TEXT NOT NULL CHECK (scope IN ('stylist', 'branch')),
  stylist_id_snapshot   TEXT,
  branch_id_snapshot    TEXT,
  revenue_threshold     INT NOT NULL,
  bonus_amount          INT NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  set_by                UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily cleaning duty rotation (excludes off-techs; weighted to reduce repeats).
CREATE TABLE IF NOT EXISTS cleaning_duty (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id             TEXT REFERENCES branches(id) ON DELETE CASCADE,
  duty_date             DATE NOT NULL,
  stylist_id            TEXT REFERENCES stylists(id) ON DELETE SET NULL,
  stylist_name_snapshot TEXT,
  assigned_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, duty_date)
);

-- Per-store private manager<->owner message board.
CREATE TABLE IF NOT EXISTS message_board (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        TEXT REFERENCES branches(id) ON DELETE CASCADE,
  author_account_id UUID,
  author_name      TEXT NOT NULL,
  author_role      TEXT NOT NULL,
  body             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_message_board_branch ON message_board (branch_id, created_at);

-- =====================================================================
-- Row Level Security — permissive to match existing demo posture.
-- =====================================================================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_edit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE actual_amount_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_duty ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_board ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts', 'checkout_orders', 'checkout_order_items', 'order_edit_logs',
    'actual_amount_adjustments', 'fixed_bonuses', 'performance_bonuses',
    'cleaning_duty', 'message_board'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_all ON %I;', t, t);
    EXECUTE format('CREATE POLICY %I_all ON %I FOR ALL USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;

-- =====================================================================
-- Optional: seed an owner account.
-- The login route also accepts the existing admin credentials
-- (ADMIN_USERNAME / ADMIN_PASSWORD) as an owner bootstrap, so this seed
-- is not strictly required to get in the first time.
-- Replace the hash/salt below with real PBKDF2 values if you want a
-- DB-backed owner. (See lib/checkoutAuth.ts hashPassword.)
-- =====================================================================
-- INSERT INTO accounts (username, password_hash, password_salt, role, display_name)
-- VALUES ('kenny', '<pbkdf2-hex>', '<salt-hex>', 'owner', 'Kenny')
-- ON CONFLICT (username) DO NOTHING;

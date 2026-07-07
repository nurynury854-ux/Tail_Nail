-- =====================================================================
-- Tail & Nail — allow logging appointment cancellations
-- Run AFTER checkout_schema.sql. Safe to re-run.
--
-- Store managers can cancel appointments at their own store; the action is
-- logged into order_edit_logs so it shows in the Owner's 修改記錄 feed.
-- This widens the action CHECK to include 'cancel_appointment'.
-- =====================================================================

ALTER TABLE order_edit_logs DROP CONSTRAINT IF EXISTS order_edit_logs_action_check;

ALTER TABLE order_edit_logs ADD CONSTRAINT order_edit_logs_action_check
  CHECK (action IN (
    'create', 'edit', 'submit', 'confirm',
    'blocked_edit_attempt', 'delete', 'actual_amount_adjust',
    'cancel_appointment'
  ));

-- =====================================================================
-- Tail & Nail — allow logging manual cleaning-duty overrides
-- Run AFTER checkout_schema.sql. Safe to re-run.
--
-- When a manager manually changes the auto-assigned 值日生, it is logged into
-- order_edit_logs so it shows in the Owner's 修改記錄 feed. Widen the action
-- CHECK to include 'cleaning_override'.
-- =====================================================================

ALTER TABLE order_edit_logs DROP CONSTRAINT IF EXISTS order_edit_logs_action_check;

ALTER TABLE order_edit_logs ADD CONSTRAINT order_edit_logs_action_check
  CHECK (action IN (
    'create', 'edit', 'submit', 'confirm',
    'blocked_edit_attempt', 'delete', 'actual_amount_adjust',
    'cancel_appointment', 'cleaning_override'
  ));

-- Buses America - Migration 009: vendor refunds against bus costs
--
-- A vendor refund is stored as a NEGATIVE cost_items row that points back at
-- the cost it refunds, so the original charge and the refund both stay
-- visible and cost totals net out. No sign constraint on amount: refund rows
-- are identified by refund_of_cost_id IS NOT NULL.
--
-- Safe to run repeatedly.

ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS refund_of_cost_id INTEGER REFERENCES cost_items(cost_id);
CREATE INDEX IF NOT EXISTS idx_cost_items_refund_of ON cost_items(refund_of_cost_id);

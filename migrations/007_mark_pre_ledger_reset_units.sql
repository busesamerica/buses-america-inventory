-- Buses America - Migration 007: mark units predating the accounting reset
--
-- At some point the accounting side of the system (accounts, transactions,
-- transaction_lines) was wiped and re-seeded with opening-balance entries;
-- inventory and cost_items were never touched. The opening balances already
-- summed in every existing unit's true purchase price + costs, so the Bus
-- Inventory GL account's aggregate balance is correct - what's missing is
-- purely per-unit attribution: no unit-level 'purchase'/'cost' transactions
-- survive the wipe to say how much of that lump sum belongs to which unit.
--
-- record_sale (backend_api_FINAL.py) already relieves inventory using each
-- unit's real purchase_price_usd + cost_items (get_true_cost_by_currency)
-- rather than the ledger, so this doesn't need reconstructing here - see
-- that function's comments. What backend_api_FINAL.py adds alongside this
-- migration is a guardrail: a unit can't be marked sold unless it has a
-- real 'purchase' transaction matching its current purchase_price_usd,
-- UNLESS it's flagged pre_ledger_reset below.
--
-- pre_ledger_reset marks exactly the units that, as of the deploy that
-- first runs this migration, have no 'purchase' transaction at all -
-- i.e. every unit affected by the wipe. This is a one-time historical
-- snapshot, not a live/recurring check: migrate.py re-applies every file
-- in this directory on every deploy, and a brand-new unit can legitimately
-- sit for a while with purchase_price_usd set but no purchase payment
-- recorded yet (mid data-entry) - if the backfill below re-evaluated "no
-- purchase transaction" on every deploy, it would silently and
-- permanently grandfather that unit out of the guardrail too, the first
-- time this migration happened to run before the payment was recorded.
-- The "NOT EXISTS (... pre_ledger_reset = TRUE)" guard makes the bulk
-- UPDATE fire only on the one deploy where no unit is flagged yet; every
-- run after that is a no-op, so units created later are never swept in.
--
-- Safe to run repeatedly (only ever does something the first time).

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS pre_ledger_reset BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE inventory i
SET pre_ledger_reset = TRUE
WHERE COALESCE(i.purchase_price_usd, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.reference_type = 'purchase' AND t.reference_id = i.inventory_id
  )
  AND NOT EXISTS (SELECT 1 FROM inventory WHERE pre_ledger_reset = TRUE);

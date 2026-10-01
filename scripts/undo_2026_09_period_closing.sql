-- One-off data fix: undo the ENTIRE Sept 2026 period closing (closing_id 1) so the period is
-- unlocked and can be re-closed after close_period is fixed.
--   - period_closings row 1 (this is what locks the period)
--   - txn 253 (period_close, 16 lines)
--   - txn 254 (revaluation, 2 lines: the bogus MXN 245,735 FX gain)
-- Run by hand, NOT via migrate.py:   psql "$DATABASE_URL" -f scripts/undo_2026_09_period_closing.sql
-- Ships as a dry run (ends in ROLLBACK). After checking the output at the bottom, change the
-- final ROLLBACK to COMMIT and run it again.

BEGIN;

-- 0. Guards: abort unless the DB is exactly what we inspected
DO $$
DECLARE closing_row period_closings%ROWTYPE; n253 int; n254 int;
BEGIN
  SELECT * INTO closing_row FROM period_closings WHERE closing_id = 1;
  IF NOT FOUND OR closing_row.period_start <> '2026-09-01' OR closing_row.period_end <> '2026-09-30'
     OR closing_row.closing_transaction_id <> 253 OR closing_row.revaluation_transaction_id <> 254 THEN
    RAISE EXCEPTION 'period_closings row 1 is not the expected Sept 2026 closing';
  END IF;
  IF (SELECT COUNT(*) FROM period_closings) <> 1 THEN
    RAISE EXCEPTION 'more than one closing exists; refusing to continue';
  END IF;
  SELECT COUNT(*) INTO n253 FROM transaction_lines WHERE transaction_id = 253;
  SELECT COUNT(*) INTO n254 FROM transaction_lines WHERE transaction_id = 254;
  IF n253 <> 16 OR n254 <> 2 THEN
    RAISE EXCEPTION 'unexpected line counts: 253=%, 254=%', n253, n254;
  END IF;
  IF (SELECT COUNT(*) FROM transactions WHERE transaction_id IN (253,254)
        AND reference_type IN ('period_close','revaluation')) <> 2 THEN
    RAISE EXCEPTION '253/254 are not the period_close/revaluation entries';
  END IF;
  IF EXISTS (SELECT 1 FROM profit_distributions WHERE transaction_id IN (253,254)) THEN
    RAISE EXCEPTION 'a profit distribution references 253/254';
  END IF;
END $$;

-- 1. Remember which account+currency balances the two entries touched
CREATE TEMP TABLE affected ON COMMIT DROP AS
  SELECT DISTINCT account_id, currency FROM transaction_lines WHERE transaction_id IN (253, 254);

-- 2. Remove the closing record (unlocks the period) and both entries
DELETE FROM period_closings   WHERE closing_id = 1;
DELETE FROM transaction_lines WHERE transaction_id IN (253, 254);
DELETE FROM transactions      WHERE transaction_id IN (253, 254);

-- 3. Recompute cached balances for every affected account+currency
--    (same formula as update_account_balances in backend_api_FINAL.py)
INSERT INTO account_balances (account_id, currency, balance, as_of_date)
SELECT af.account_id, af.currency,
       CASE WHEN a.account_type IN ('Asset','Expense')
            THEN COALESCE(SUM(tl.debit_amount),0) - COALESCE(SUM(tl.credit_amount),0)
            ELSE COALESCE(SUM(tl.credit_amount),0) - COALESCE(SUM(tl.debit_amount),0) END,
       CURRENT_DATE
  FROM affected af
  JOIN accounts a ON a.account_id = af.account_id
  LEFT JOIN transaction_lines tl ON tl.account_id = af.account_id AND tl.currency = af.currency
 GROUP BY af.account_id, af.currency, a.account_type
ON CONFLICT (account_id, currency)
DO UPDATE SET balance = EXCLUDED.balance, as_of_date = CURRENT_DATE;

-- 4. Verify before committing
SELECT COUNT(*) AS closings_left FROM period_closings;            -- expect 0
SELECT COUNT(*) AS closing_txns_left FROM transactions
 WHERE reference_type IN ('period_close','revaluation');           -- expect 0
SELECT a.account_code, a.account_name, ab.currency, ab.balance     -- expect Sept P&L balances back, 6500 = 0
  FROM account_balances ab JOIN accounts a USING (account_id)
 WHERE a.account_code IN ('3100','4000','4001','5000','5560','5710','5770','6210','6500')
 ORDER BY a.account_code, ab.currency;

ROLLBACK;   -- change to COMMIT once the output above looks right

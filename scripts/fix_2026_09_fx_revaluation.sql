-- One-off data fix: remove the bogus Sept 2026 FX revaluation (txn 254, MXN 245,735).
-- Run by hand, NOT via migrate.py:   psql "$DATABASE_URL" -f scripts/fix_2026_09_fx_revaluation.sql
-- Ships as a dry run (ends in ROLLBACK). After checking the three result sets at the
-- bottom, change the final ROLLBACK to COMMIT and run it again.

BEGIN;

-- 0. Guard: abort unless txn 254 is exactly what we expect
DO $$
DECLARE n int; d numeric; c numeric;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(debit_amount),0), COALESCE(SUM(credit_amount),0)
    INTO n, d, c FROM transaction_lines WHERE transaction_id = 254;
  IF n <> 2 OR d <> 245735.00 OR c <> 245735.00 THEN
    RAISE EXCEPTION 'txn 254 is not the expected revaluation entry (lines=%, dr=%, cr=%)', n, d, c;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM transactions WHERE transaction_id = 254 AND reference_type = 'revaluation') THEN
    RAISE EXCEPTION 'txn 254 is not a revaluation';
  END IF;
END $$;

-- 1. Unlink and zero the FX figure on the closing record
UPDATE period_closings
   SET revaluation_transaction_id = NULL, fx_gain_loss = 0
 WHERE closing_id = 1 AND revaluation_transaction_id = 254;

-- 2. Remove the entry
DELETE FROM transaction_lines WHERE transaction_id = 254;
DELETE FROM transactions      WHERE transaction_id = 254;

-- 3. Recompute cached balances for the two affected accounts (mirrors update_account_balances)
INSERT INTO account_balances (account_id, currency, balance, as_of_date)
SELECT a.account_id, 'MXN',
       CASE WHEN a.account_type IN ('Asset','Expense')
            THEN COALESCE(SUM(tl.debit_amount),0) - COALESCE(SUM(tl.credit_amount),0)
            ELSE COALESCE(SUM(tl.credit_amount),0) - COALESCE(SUM(tl.debit_amount),0) END,
       CURRENT_DATE
  FROM accounts a
  LEFT JOIN transaction_lines tl ON tl.account_id = a.account_id AND tl.currency = 'MXN'
 WHERE a.account_code IN ('6500','3100')
 GROUP BY a.account_id, a.account_type
ON CONFLICT (account_id, currency)
DO UPDATE SET balance = EXCLUDED.balance, as_of_date = CURRENT_DATE;

-- 4. Verify (expect: fx_gain_loss = 0 and NULL link; 6500 MXN = 0; txn_254_left = 0)
SELECT closing_id, fx_gain_loss, revaluation_transaction_id FROM period_closings;
SELECT a.account_code, ab.currency, ab.balance FROM account_balances ab
  JOIN accounts a USING (account_id) WHERE a.account_code IN ('6500','3100');
SELECT COUNT(*) AS txn_254_left FROM transactions WHERE transaction_id = 254;

ROLLBACK;   -- change to COMMIT once the output above looks right

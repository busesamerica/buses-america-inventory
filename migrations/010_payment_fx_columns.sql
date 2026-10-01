-- Buses America - Migration 010: store the FX rate and sale-currency amount on each payment
--
-- A customer can pay in a different currency than the sale (e.g. a USD sale paid in
-- MXN). The payment's rate and its value in the sale currency used to be recomputed
-- on every read with whatever rate happened to be passed in, so balance_due drifted
-- and the ledger credited the wrong AR account. They are now fixed at payment time:
--   payment_exchange_rate  USD->MXN rate used (NULL when no conversion was needed)
--   converted_amount       payment value in the sale currency
--
-- Backfills existing rows from the exchange_rates table (rate dated on/before the
-- payment date, else the closest later one). Safe to run repeatedly: it only
-- touches rows where converted_amount is still NULL.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_exchange_rate DECIMAL(10,4);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS converted_amount DECIMAL(12,2);

-- Same-currency payments: nothing to convert
UPDATE payments p
   SET converted_amount = p.payment_amount
  FROM inventory i
 WHERE i.inventory_id = p.inventory_id
   AND p.converted_amount IS NULL
   AND p.payment_currency = i.sale_currency;

-- Cross-currency payments (USD <-> MXN)
WITH calc AS (
    SELECT p.payment_id, i.sale_currency, p.payment_amount, r.rate
      FROM payments p
      JOIN inventory i ON i.inventory_id = p.inventory_id
      CROSS JOIN LATERAL (
           SELECT rate FROM exchange_rates
            WHERE from_currency = 'USD' AND to_currency = 'MXN' AND is_active = TRUE
            ORDER BY (effective_date <= p.payment_date) DESC,
                     ABS(effective_date - p.payment_date) ASC
            LIMIT 1
      ) r
     WHERE p.converted_amount IS NULL
       AND p.payment_currency <> i.sale_currency
       AND p.payment_currency IN ('USD', 'MXN')
       AND i.sale_currency IN ('USD', 'MXN')
)
UPDATE payments p
   SET payment_exchange_rate = c.rate,
       converted_amount = ROUND(
           CASE WHEN c.sale_currency = 'USD' THEN c.payment_amount / c.rate
                ELSE c.payment_amount * c.rate END, 2)
  FROM calc c
 WHERE p.payment_id = c.payment_id;

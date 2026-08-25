-- LOCAL DEVELOPMENT SEED DATA -- schema reconstruction is no longer needed
-- here.
--
-- This file used to hand-reconstruct clients/users/accounts/etc. by
-- reverse-engineering them from backend_api_FINAL.py's queries, because
-- those tables existed only in production and nowhere in this repo. That
-- gap is closed: migrations/000_core_tables.sql now creates the real
-- versions of all of them (captured from production, not guessed -- see its
-- header comment), and bus_inventory_schema_FINAL.sql no longer has the
-- broken generated columns that used to make CREATE TABLE inventory fail.
-- A fresh createdb + the steps below is enough on its own.
--
-- (One thing worth knowing if you compare against the old version of this
-- file: it added an `inventory.sale_notes` column that turned out not to
-- exist in production -- a guess that didn't survive contact with the real
-- schema. Not carried forward.)
--
-- Usage:
--   createdb buses_test
--   psql buses_test -f bus_inventory_schema_FINAL.sql
--   DATABASE_URL=postgres://.../buses_test python migrate_quotes.py
--   psql buses_test -f tests/dev_fixtures.sql   -- this file: seed data only
--   psql buses_test -f tests/seed_dev_data.sql

-- Minimal chart of accounts so sale postings have somewhere to land.
INSERT INTO accounts (account_code, account_name, account_type, account_subtype, currency)
SELECT * FROM (VALUES
    ('1100','Accounts Receivable (USD)','Asset','AR','USD'),
    ('1105','Accounts Receivable (MXN)','Asset','AR','MXN'),
    ('1300','Bus Inventory','Asset','Inventory','USD'),
    ('4000','Bus Sales (USD)','Income','Sales','USD'),
    ('4005','Bus Sales (MXN)','Income','Sales','MXN'),
    ('5000','Bus Purchases (COGS)','Expense','Cost of Goods','USD')
) AS v(account_code, account_name, account_type, account_subtype, currency)
WHERE NOT EXISTS (SELECT 1 FROM accounts);

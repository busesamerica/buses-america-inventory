-- LOCAL DEVELOPMENT / TEST FIXTURES ONLY — NOT THE PRODUCTION SCHEMA.
--
-- The production database contains several tables (clients, users, accounting)
-- that were created outside this repository, so bus_inventory_schema_FINAL.sql
-- alone is not enough to run the API locally. This file is a minimal
-- reconstruction of those tables, inferred from the queries in
-- backend_api_FINAL.py, sufficient to exercise the quoting endpoints against a
-- real Postgres. It is deliberately not wired into init_database.py.
--
-- Usage:
--   createdb buses_test
--   psql buses_test -f bus_inventory_schema_FINAL.sql
--   psql buses_test -f tests/dev_fixtures.sql
--   DATABASE_URL=postgres://.../buses_test python migrate_quotes.py

-- Columns the API expects on inventory but that the committed schema lacks
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS client_id INTEGER;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS sale_exchange_rate DECIMAL(10,4);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS sale_notes TEXT;

CREATE TABLE IF NOT EXISTS clients (
    client_id                 SERIAL PRIMARY KEY,
    client_name               VARCHAR(255) NOT NULL,
    client_company            VARCHAR(255),
    client_location           VARCHAR(255),
    client_use_case           TEXT,
    client_phone              VARCHAR(50),
    client_email              VARCHAR(255),
    billing_address           TEXT,
    tax_id                    VARCHAR(50),
    contact_person            VARCHAR(255),
    notes                     TEXT,
    credit_terms              VARCHAR(100),
    payment_reliability       VARCHAR(50),
    preferred_payment_method  VARCHAR(50),
    created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted                BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS users (
    user_id        SERIAL PRIMARY KEY,
    username       VARCHAR(100) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    full_name      VARCHAR(255),
    email          VARCHAR(255),
    role           VARCHAR(50) DEFAULT 'manager',
    is_active      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
    session_id     SERIAL PRIMARY KEY,
    user_id        INTEGER REFERENCES users(user_id),
    session_token  VARCHAR(255) UNIQUE NOT NULL,
    expires_at     TIMESTAMP NOT NULL,
    last_activity  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
    log_id      SERIAL PRIMARY KEY,
    user_id     INTEGER,
    username    VARCHAR(100),
    action      VARCHAR(50),
    table_name  VARCHAR(100),
    record_id   INTEGER,
    old_values  JSONB,
    new_values  JSONB,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
    account_id       SERIAL PRIMARY KEY,
    account_code     VARCHAR(20),
    account_name     VARCHAR(255) NOT NULL,
    account_type     VARCHAR(50) NOT NULL,   -- Asset, Liability, Equity, Income, Expense
    account_subtype  VARCHAR(50),            -- AR, AP, Cash, Inventory, Sales, Cost of Goods
    currency         VARCHAR(3) DEFAULT 'USD',
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id    SERIAL PRIMARY KEY,
    transaction_date  DATE NOT NULL,
    description       TEXT,
    reference_type    VARCHAR(50),
    reference_id      INTEGER,
    reference_number  VARCHAR(50),
    currency          VARCHAR(3) DEFAULT 'USD',
    created_by        VARCHAR(100),
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transaction_lines (
    line_id         SERIAL PRIMARY KEY,
    transaction_id  INTEGER REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    account_id      INTEGER REFERENCES accounts(account_id),
    debit_amount    DECIMAL(14,2) DEFAULT 0,
    credit_amount   DECIMAL(14,2) DEFAULT 0,
    currency        VARCHAR(3) DEFAULT 'USD',
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS account_balances (
    balance_id   SERIAL PRIMARY KEY,
    account_id   INTEGER REFERENCES accounts(account_id),
    currency     VARCHAR(3) NOT NULL,
    balance      DECIMAL(16,2) DEFAULT 0,
    as_of_date   DATE DEFAULT CURRENT_DATE,
    UNIQUE (account_id, currency)
);

CREATE TABLE IF NOT EXISTS period_closings (
    closing_id    SERIAL PRIMARY KEY,
    period_start  DATE,
    period_end    DATE NOT NULL,
    closed_by     VARCHAR(100),
    notes         TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Minimal chart of accounts so sale postings have somewhere to land
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

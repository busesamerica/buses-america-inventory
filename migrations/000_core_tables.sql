-- Buses America - Core tables captured from production
-- Migration 000: users, clients, and the accounting ledger
--
-- These tables have been running in production for a while but were created
-- outside this repository (by hand, directly against the database) and were
-- never added to bus_inventory_schema_FINAL.sql or migrations/. A fresh
-- clone could not reproduce production: the backend queries users, clients,
-- accounts, transactions, transaction_lines, account_balances,
-- period_closings, profit_distributions, payments, audit_log and
-- user_sessions, none of which existed anywhere in version control.
--
-- Captured from the live database's information_schema/pg_catalog, column
-- by column. Numbered 000 (before 001_quotes.sql) because quotes and its
-- later migrations already assume clients and users exist -- quotes.client_id
-- references clients(client_id), and 003_quote_prepared_by.sql backfills
-- from the users table. This has to run first.
--
-- Safe to run repeatedly, and safe to run against production: every
-- statement is IF NOT EXISTS / guarded, so on a database that already has
-- these tables (i.e. production) this is a no-op.

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id        SERIAL PRIMARY KEY,
    username       VARCHAR(50)  NOT NULL UNIQUE,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    full_name      VARCHAR(255) NOT NULL,
    role           VARCHAR(20)  NOT NULL,
    is_active      BOOLEAN DEFAULT TRUE,
    last_login     TIMESTAMP,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by     INTEGER REFERENCES users(user_id),
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
    client_id                 SERIAL PRIMARY KEY,
    client_name                VARCHAR(255),
    client_email                VARCHAR(255),
    client_phone                VARCHAR(50),
    client_company              VARCHAR(255),
    client_location              VARCHAR(255),
    client_contact               VARCHAR(255),
    client_use_case              TEXT,
    client_notes                 TEXT,
    is_deleted                   BOOLEAN DEFAULT FALSE,
    created_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by                   VARCHAR(100),
    billing_address              TEXT,
    tax_id                       VARCHAR(50),
    contact_person               VARCHAR(255),
    notes                        TEXT,
    credit_terms                 VARCHAR(100),
    payment_reliability          VARCHAR(50) DEFAULT 'Not Rated',
    preferred_payment_method     VARCHAR(100),
    updated_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by                   VARCHAR(100)
);

-- ============================================================
-- ACCOUNTS (chart of accounts)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
    account_id       SERIAL PRIMARY KEY,
    account_code     VARCHAR(20) NOT NULL UNIQUE,
    account_name     VARCHAR(200) NOT NULL,
    account_type     VARCHAR(50) NOT NULL,   -- Asset, Liability, Equity, Income, Expense
    account_subtype  VARCHAR(50),            -- AR, AP, Cash, Inventory, Sales, Cost of Goods
    currency         VARCHAR(10) NOT NULL DEFAULT 'USD',
    parent_account_id INTEGER REFERENCES accounts(account_id),
    is_active        BOOLEAN DEFAULT TRUE,
    description      TEXT,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TRANSACTIONS (journal entry header)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id    SERIAL PRIMARY KEY,
    transaction_date  DATE NOT NULL,
    description       TEXT NOT NULL,
    reference_type    VARCHAR(50),
    reference_id      INTEGER,
    currency          VARCHAR(10) NOT NULL DEFAULT 'USD',
    exchange_rate     DECIMAL(10,4),
    notes             TEXT,
    created_by        VARCHAR(100),
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reference_number  VARCHAR(50) UNIQUE
);

-- ============================================================
-- TRANSACTION_LINES (journal entry lines - debits/credits)
-- ============================================================
CREATE TABLE IF NOT EXISTS transaction_lines (
    line_id         SERIAL PRIMARY KEY,
    transaction_id  INTEGER NOT NULL REFERENCES transactions(transaction_id),
    account_id      INTEGER NOT NULL REFERENCES accounts(account_id),
    debit_amount    DECIMAL(15,2) DEFAULT 0,
    credit_amount   DECIMAL(15,2) DEFAULT 0,
    currency        VARCHAR(10) NOT NULL DEFAULT 'USD',
    notes           TEXT
);

-- ============================================================
-- ACCOUNT_BALANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS account_balances (
    balance_id   SERIAL PRIMARY KEY,
    account_id   INTEGER NOT NULL REFERENCES accounts(account_id),
    currency     VARCHAR(10) NOT NULL DEFAULT 'USD',
    balance      DECIMAL(15,2) NOT NULL DEFAULT 0,
    as_of_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (account_id, currency),
    UNIQUE (account_id, currency, as_of_date)
);

-- ============================================================
-- PERIOD_CLOSINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS period_closings (
    closing_id                  SERIAL PRIMARY KEY,
    period_start                DATE NOT NULL,
    period_end                  DATE NOT NULL UNIQUE,
    closing_date                DATE NOT NULL DEFAULT CURRENT_DATE,
    exchange_rate                DECIMAL(10,4) NOT NULL,
    net_income_usd                DECIMAL(12,2) DEFAULT 0,
    net_income_mxn                DECIMAL(12,2) DEFAULT 0,
    fx_gain_loss                   DECIMAL(12,2) DEFAULT 0,
    closing_transaction_id          INTEGER REFERENCES transactions(transaction_id),
    revaluation_transaction_id       INTEGER REFERENCES transactions(transaction_id),
    notes                             TEXT,
    created_by                         VARCHAR(100),
    created_at                          TIMESTAMP DEFAULT now()
);

-- ============================================================
-- PROFIT_DISTRIBUTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS profit_distributions (
    distribution_id   SERIAL PRIMARY KEY,
    distribution_date DATE NOT NULL,
    transaction_id    INTEGER REFERENCES transactions(transaction_id),
    inventory_id      INTEGER REFERENCES inventory(inventory_id) UNIQUE,
    total_profit      DECIMAL(15,2) NOT NULL,
    currency          VARCHAR(10) NOT NULL DEFAULT 'USD',
    erick_percentage  DECIMAL(5,2) NOT NULL DEFAULT 60.00,
    erick_amount      DECIMAL(15,2) NOT NULL,
    omar_percentage   DECIMAL(5,2) NOT NULL DEFAULT 40.00,
    omar_amount       DECIMAL(15,2) NOT NULL,
    notes             TEXT,
    created_by        VARCHAR(100),
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    payment_id        SERIAL PRIMARY KEY,
    inventory_id      INTEGER NOT NULL REFERENCES inventory(inventory_id),
    payment_amount    DECIMAL(12,2) NOT NULL,
    payment_currency  VARCHAR(10) NOT NULL DEFAULT 'USD',
    payment_date      DATE NOT NULL,
    payment_method    VARCHAR(50),
    payment_type      VARCHAR(50) NOT NULL DEFAULT 'Deposit',
    reference_number  VARCHAR(100),
    payment_notes     TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        VARCHAR(100)
);

-- ============================================================
-- AUDIT_LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    log_id      SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(user_id),
    username    VARCHAR(50),
    action      VARCHAR(50) NOT NULL,
    table_name  VARCHAR(100),
    record_id   INTEGER,
    old_values  JSONB,
    new_values  JSONB,
    ip_address  VARCHAR(50),
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- ============================================================
-- USER_SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id     SERIAL PRIMARY KEY,
    user_id        INTEGER REFERENCES users(user_id),
    session_token  VARCHAR(255) NOT NULL UNIQUE,
    ip_address     VARCHAR(50),
    user_agent     TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at     TIMESTAMP NOT NULL,
    last_activity  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_tax_id     ON clients(tax_id);
CREATE INDEX IF NOT EXISTS idx_clients_location   ON clients(client_location);
CREATE INDEX IF NOT EXISTS idx_clients_company    ON clients(client_company);
CREATE INDEX IF NOT EXISTS idx_clients_phone      ON clients(client_phone);
CREATE INDEX IF NOT EXISTS idx_clients_email      ON clients(client_email);
CREATE INDEX IF NOT EXISTS idx_clients_name       ON clients(client_name);

CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_type   ON accounts(account_type);

CREATE INDEX IF NOT EXISTS idx_transactions_date      ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_transaction_lines_account     ON transaction_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_transaction ON transaction_lines(transaction_id);

CREATE INDEX IF NOT EXISTS idx_account_balances_account ON account_balances(account_id);

CREATE INDEX IF NOT EXISTS idx_profit_distributions_date ON profit_distributions(distribution_date);

CREATE INDEX IF NOT EXISTS idx_payments_currency     ON payments(payment_currency);
CREATE INDEX IF NOT EXISTS idx_payments_date         ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_inventory_id ON payments(inventory_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_user          ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record  ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp     ON audit_log("timestamp");

CREATE INDEX IF NOT EXISTS idx_user_sessions_token   ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- ============================================================
-- Columns production added to tables that already existed in
-- bus_inventory_schema_FINAL.sql, discovered the same way as the tables
-- above. Added here (rather than editing the base schema in place) so this
-- migration is the single source of the "captured from production" catch-up
-- and stays easy to review as one unit.
-- ============================================================

-- suppliers: who created/last touched a supplier record
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(user_id);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(user_id);

-- cost_items: free-text notes
ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS notes TEXT;

-- work_plans: who last touched a plan
ALTER TABLE work_plans ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(user_id);

-- inventory: link to the client record (superseding the old denormalized
-- client_name/client_company/... columns above, which stay in place but are
-- no longer populated), the audit/display columns, and equipment/safety
-- fields that grew on the inspection form and were mirrored onto inventory.
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS client_id            INTEGER REFERENCES clients(client_id);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_by           INTEGER REFERENCES users(user_id);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS created_by_name      VARCHAR(255);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_by_name      VARCHAR(255);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS sale_exchange_rate   DECIMAL(10,4);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS brake_system         VARCHAR(50);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS air_conditioning     BOOLEAN;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS heater               BOOLEAN;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS seat_belts           INTEGER;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS emergency_exits      INTEGER;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS fire_extinguisher    BOOLEAN;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS first_aid_kit        BOOLEAN;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS ada_compliant        BOOLEAN;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS wheelchair_lift_ramp VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_inventory_client_id ON inventory(client_id);

-- pre_purchase_inspections: the form grew a full spec panel (mirroring
-- inventory's own spec fields, so a purchased unit's specs can be copied
-- straight across), seller info, and a purchase decision/tracking section.
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS updated_by             INTEGER REFERENCES users(user_id);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS odometer_unit          VARCHAR(10) DEFAULT 'miles';
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS passenger_capacity     INTEGER;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS wheelchair_capacity    INTEGER;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS engine_make            VARCHAR(100);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS engine_model           VARCHAR(100);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS engine_type            VARCHAR(50);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS transmission           VARCHAR(100);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS fuel_type              VARCHAR(50);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS gvwr                   INTEGER;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS length_feet            DECIMAL(5,2);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS exterior_color         VARCHAR(50);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS interior_color         VARCHAR(50);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS title_status           VARCHAR(50);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS body_style             VARCHAR(100);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS seller_name            VARCHAR(255);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS seller_asking_price    DECIMAL(12,2);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS seller_contact         VARCHAR(255);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS inspector_notes        TEXT;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS purchased              BOOLEAN DEFAULT FALSE;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS purchase_date          DATE;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS actual_purchase_price  DECIMAL(12,2);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS brake_system           VARCHAR(50);
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS air_conditioning       BOOLEAN;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS heater                 BOOLEAN;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS seat_belts             INTEGER;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS emergency_exits        INTEGER;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS fire_extinguisher      BOOLEAN;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS first_aid_kit          BOOLEAN;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS ada_compliant          BOOLEAN;
ALTER TABLE pre_purchase_inspections ADD COLUMN IF NOT EXISTS wheelchair_lift_ramp   VARCHAR(50);

-- ============================================================
-- Convenience views, captured verbatim from production (pg_views)
-- (open_quotes is created by 001_quotes.sql, not repeated here)
--
-- These list inventory's columns explicitly rather than `i.*`, on purpose:
-- inventory still carries the legacy client_name/client_company/... columns
-- above (kept for backward compatibility, no longer populated -- see the
-- comment above the inventory ALTER TABLE statements), and `i.*` would
-- collide with the client_name/etc. pulled from the new clients table below.
-- Production's real inventory has no such columns, so its views never hit
-- this; this is the one place the two repos' schemas have to diverge to
-- produce the same view output.
--
-- DROP + CREATE, not CREATE OR REPLACE: bus_inventory_schema_FINAL.sql
-- already creates stub versions of these 4 (SELECT * FROM inventory, no
-- clients join, and checking current_location = 'US Stock'/'Mexico Stock'
-- and warranty_status = 'Active' -- values the app has never actually
-- written; production uses 'US'/'Mexico' and just compares the date). A
-- CREATE OR REPLACE can't change an existing view's column order, which a
-- correction like this necessarily does, so the old stub has to be dropped
-- first.
-- ============================================================

DROP VIEW IF EXISTS us_inventory;
CREATE VIEW us_inventory AS
SELECT i.inventory_id, i.stock_number, i.vin, i.year, i.make, i.model,
       i.body_style, i.bus_type, i.passenger_capacity, i.wheelchair_capacity,
       i.engine_make, i.engine_model, i.engine_type, i.transmission, i.fuel_type,
       i.gvwr, i.length_feet, i.odometer, i.odometer_unit, i.condition,
       i.exterior_color, i.interior_color, i.title_status, i.supplier_id,
       i.purchase_date, i.purchase_price_usd, i.purchase_location,
       i.purchase_invoice_number, i.transport_to_stock_cost_usd,
       i.transport_to_stock_notes, i.initial_reconditioning_cost_usd,
       i.other_acquisition_costs_usd, i.cost_in_us_stock_usd, i.asking_price,
       i.asking_currency, i.minimum_price, i.minimum_currency, i.status,
       i.current_location, i.us_stock_location, i.mexico_stock_location,
       i.is_sold, i.sale_date, i.sale_price, i.sale_currency, i.sale_price_usd,
       i.sale_price_mxn, i.deposit_amount, i.deposit_currency, i.deposit_date,
       i.balance_due, i.balance_currency, i.payment_status, i.final_payment_date,
       i.preventive_maintenance_cost, i.preventive_maintenance_currency,
       i.preventive_maintenance_notes, i.preventive_maintenance_date,
       i.border_crossing, i.import_started_date, i.import_completed_date,
       i.customs_broker, i.import_cost_mxn, i.customs_cost_mxn,
       i.regulatory_cost_mxn, i.other_import_costs_mxn,
       i.import_documents_complete, i.import_notes,
       i.transport_to_client_cost_mxn, i.transport_to_client_notes,
       i.other_costs_after_sale, i.other_costs_currency, i.exchange_rate_used,
       i.total_cost_usd, i.total_cost_mxn, i.profit_usd, i.profit_mxn,
       i.delivery_date, i.delivery_method, i.delivery_notes,
       i.warranty_start_date, i.warranty_end_date, i.warranty_status,
       i.days_in_inventory, i.days_in_us_stock, i.days_in_mexico_stock,
       i.days_in_warranty, i.features, i.description, i.internal_notes,
       i.pre_inspection_id, i.created_by, i.created_at, i.updated_at,
       i.is_deleted, i.updated_by, i.created_by_name, i.updated_by_name,
       i.client_id, c.client_name, c.client_email, c.client_phone,
       c.client_company, c.client_location, c.client_contact, c.client_use_case
FROM inventory i
LEFT JOIN clients c ON i.client_id = c.client_id
WHERE i.current_location = 'US';

DROP VIEW IF EXISTS mexico_inventory;
CREATE VIEW mexico_inventory AS
SELECT i.inventory_id, i.stock_number, i.vin, i.year, i.make, i.model,
       i.body_style, i.bus_type, i.passenger_capacity, i.wheelchair_capacity,
       i.engine_make, i.engine_model, i.engine_type, i.transmission, i.fuel_type,
       i.gvwr, i.length_feet, i.odometer, i.odometer_unit, i.condition,
       i.exterior_color, i.interior_color, i.title_status, i.supplier_id,
       i.purchase_date, i.purchase_price_usd, i.purchase_location,
       i.purchase_invoice_number, i.transport_to_stock_cost_usd,
       i.transport_to_stock_notes, i.initial_reconditioning_cost_usd,
       i.other_acquisition_costs_usd, i.cost_in_us_stock_usd, i.asking_price,
       i.asking_currency, i.minimum_price, i.minimum_currency, i.status,
       i.current_location, i.us_stock_location, i.mexico_stock_location,
       i.is_sold, i.sale_date, i.sale_price, i.sale_currency, i.sale_price_usd,
       i.sale_price_mxn, i.deposit_amount, i.deposit_currency, i.deposit_date,
       i.balance_due, i.balance_currency, i.payment_status, i.final_payment_date,
       i.preventive_maintenance_cost, i.preventive_maintenance_currency,
       i.preventive_maintenance_notes, i.preventive_maintenance_date,
       i.border_crossing, i.import_started_date, i.import_completed_date,
       i.customs_broker, i.import_cost_mxn, i.customs_cost_mxn,
       i.regulatory_cost_mxn, i.other_import_costs_mxn,
       i.import_documents_complete, i.import_notes,
       i.transport_to_client_cost_mxn, i.transport_to_client_notes,
       i.other_costs_after_sale, i.other_costs_currency, i.exchange_rate_used,
       i.total_cost_usd, i.total_cost_mxn, i.profit_usd, i.profit_mxn,
       i.delivery_date, i.delivery_method, i.delivery_notes,
       i.warranty_start_date, i.warranty_end_date, i.warranty_status,
       i.days_in_inventory, i.days_in_us_stock, i.days_in_mexico_stock,
       i.days_in_warranty, i.features, i.description, i.internal_notes,
       i.pre_inspection_id, i.created_by, i.created_at, i.updated_at,
       i.is_deleted, i.updated_by, i.created_by_name, i.updated_by_name,
       i.client_id, c.client_name, c.client_email, c.client_phone,
       c.client_company, c.client_location, c.client_contact, c.client_use_case
FROM inventory i
LEFT JOIN clients c ON i.client_id = c.client_id
WHERE i.current_location = 'Mexico';

DROP VIEW IF EXISTS sold_pending_delivery;
CREATE VIEW sold_pending_delivery AS
SELECT i.inventory_id, i.stock_number, i.vin, i.year, i.make, i.model,
       i.body_style, i.bus_type, i.passenger_capacity, i.wheelchair_capacity,
       i.engine_make, i.engine_model, i.engine_type, i.transmission, i.fuel_type,
       i.gvwr, i.length_feet, i.odometer, i.odometer_unit, i.condition,
       i.exterior_color, i.interior_color, i.title_status, i.supplier_id,
       i.purchase_date, i.purchase_price_usd, i.purchase_location,
       i.purchase_invoice_number, i.transport_to_stock_cost_usd,
       i.transport_to_stock_notes, i.initial_reconditioning_cost_usd,
       i.other_acquisition_costs_usd, i.cost_in_us_stock_usd, i.asking_price,
       i.asking_currency, i.minimum_price, i.minimum_currency, i.status,
       i.current_location, i.us_stock_location, i.mexico_stock_location,
       i.is_sold, i.sale_date, i.sale_price, i.sale_currency, i.sale_price_usd,
       i.sale_price_mxn, i.deposit_amount, i.deposit_currency, i.deposit_date,
       i.balance_due, i.balance_currency, i.payment_status, i.final_payment_date,
       i.preventive_maintenance_cost, i.preventive_maintenance_currency,
       i.preventive_maintenance_notes, i.preventive_maintenance_date,
       i.border_crossing, i.import_started_date, i.import_completed_date,
       i.customs_broker, i.import_cost_mxn, i.customs_cost_mxn,
       i.regulatory_cost_mxn, i.other_import_costs_mxn,
       i.import_documents_complete, i.import_notes,
       i.transport_to_client_cost_mxn, i.transport_to_client_notes,
       i.other_costs_after_sale, i.other_costs_currency, i.exchange_rate_used,
       i.total_cost_usd, i.total_cost_mxn, i.profit_usd, i.profit_mxn,
       i.delivery_date, i.delivery_method, i.delivery_notes,
       i.warranty_start_date, i.warranty_end_date, i.warranty_status,
       i.days_in_inventory, i.days_in_us_stock, i.days_in_mexico_stock,
       i.days_in_warranty, i.features, i.description, i.internal_notes,
       i.pre_inspection_id, i.created_by, i.created_at, i.updated_at,
       i.is_deleted, i.updated_by, i.created_by_name, i.updated_by_name,
       i.client_id, c.client_name, c.client_email, c.client_phone,
       c.client_company, c.client_location, c.client_contact, c.client_use_case
FROM inventory i
LEFT JOIN clients c ON i.client_id = c.client_id
WHERE i.is_sold = TRUE AND i.status <> 'Delivered';

DROP VIEW IF EXISTS units_under_warranty;
CREATE VIEW units_under_warranty AS
SELECT i.inventory_id, i.stock_number, i.vin, i.year, i.make, i.model,
       i.body_style, i.bus_type, i.passenger_capacity, i.wheelchair_capacity,
       i.engine_make, i.engine_model, i.engine_type, i.transmission, i.fuel_type,
       i.gvwr, i.length_feet, i.odometer, i.odometer_unit, i.condition,
       i.exterior_color, i.interior_color, i.title_status, i.supplier_id,
       i.purchase_date, i.purchase_price_usd, i.purchase_location,
       i.purchase_invoice_number, i.transport_to_stock_cost_usd,
       i.transport_to_stock_notes, i.initial_reconditioning_cost_usd,
       i.other_acquisition_costs_usd, i.cost_in_us_stock_usd, i.asking_price,
       i.asking_currency, i.minimum_price, i.minimum_currency, i.status,
       i.current_location, i.us_stock_location, i.mexico_stock_location,
       i.is_sold, i.sale_date, i.sale_price, i.sale_currency, i.sale_price_usd,
       i.sale_price_mxn, i.deposit_amount, i.deposit_currency, i.deposit_date,
       i.balance_due, i.balance_currency, i.payment_status, i.final_payment_date,
       i.preventive_maintenance_cost, i.preventive_maintenance_currency,
       i.preventive_maintenance_notes, i.preventive_maintenance_date,
       i.border_crossing, i.import_started_date, i.import_completed_date,
       i.customs_broker, i.import_cost_mxn, i.customs_cost_mxn,
       i.regulatory_cost_mxn, i.other_import_costs_mxn,
       i.import_documents_complete, i.import_notes,
       i.transport_to_client_cost_mxn, i.transport_to_client_notes,
       i.other_costs_after_sale, i.other_costs_currency, i.exchange_rate_used,
       i.total_cost_usd, i.total_cost_mxn, i.profit_usd, i.profit_mxn,
       i.delivery_date, i.delivery_method, i.delivery_notes,
       i.warranty_start_date, i.warranty_end_date, i.warranty_status,
       i.days_in_inventory, i.days_in_us_stock, i.days_in_mexico_stock,
       i.days_in_warranty, i.features, i.description, i.internal_notes,
       i.pre_inspection_id, i.created_by, i.created_at, i.updated_at,
       i.is_deleted, i.updated_by, i.created_by_name, i.updated_by_name,
       i.client_id, c.client_name, c.client_email, c.client_phone,
       c.client_company, c.client_location, c.client_contact, c.client_use_case
FROM inventory i
LEFT JOIN clients c ON i.client_id = c.client_id
WHERE i.warranty_end_date > CURRENT_DATE;

-- current_exchange_rate is already defined correctly in
-- bus_inventory_schema_FINAL.sql (identical to production) -- not repeated
-- here.

CREATE OR REPLACE VIEW recent_activity AS
SELECT a.log_id, a.username, a.action, a.table_name, a.record_id,
       a.description, a."timestamp", u.full_name, u.role
FROM audit_log a
LEFT JOIN users u ON a.user_id = u.user_id
ORDER BY a."timestamp" DESC
LIMIT 100;

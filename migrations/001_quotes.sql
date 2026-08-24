-- Buses America - Quoting Module
-- Migration 001: quotes + quote_line_items
--
-- Safe to run repeatedly: every statement is IF NOT EXISTS / guarded.
-- Apply with:  python migrate_quotes.py
--       or:    POST /admin/migrate-quotes

-- ============================================================
-- QUOTES (header)
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
    quote_id            SERIAL PRIMARY KEY,
    quote_number        VARCHAR(50) UNIQUE NOT NULL,
    revision            INTEGER NOT NULL DEFAULT 1,

    -- Client: FK when the client exists in the database, plus a snapshot of
    -- the details as they were when the quote was issued, so a reprint of an
    -- old quote never changes because the client record was later edited.
    client_id           INTEGER REFERENCES clients(client_id),
    client_name         VARCHAR(255) NOT NULL,
    client_company      VARCHAR(255),
    client_contact      VARCHAR(255),
    client_email        VARCHAR(255),
    client_phone        VARCHAR(50),
    client_location     VARCHAR(255),
    client_tax_id       VARCHAR(50),
    billing_address     TEXT,

    quote_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until         DATE,

    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    exchange_rate       DECIMAL(10,4),      -- USD->MXN rate at time of quote

    -- Draft | Sent | Accepted | Rejected | Expired | Cancelled
    status              VARCHAR(20) NOT NULL DEFAULT 'Draft',
    sent_at             TIMESTAMP,
    responded_at        TIMESTAMP,
    status_reason       TEXT,

    -- Money. Recomputed server-side from the line items on every write;
    -- stored so historical quotes keep their numbers.
    subtotal            DECIMAL(14,2) NOT NULL DEFAULT 0,
    discount_amount     DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_rate            DECIMAL(6,3)  NOT NULL DEFAULT 0,   -- percent, e.g. 16.000
    tax_amount          DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount        DECIMAL(14,2) NOT NULL DEFAULT 0,

    deposit_required    DECIMAL(14,2),
    deposit_percent     DECIMAL(6,3),

    payment_terms       TEXT,
    delivery_terms      TEXT,
    warranty_terms      TEXT,
    notes               TEXT,               -- printed on the client document
    internal_notes      TEXT,               -- never printed

    -- Conversion to sale
    converted_at        TIMESTAMP,
    converted_sale_date DATE,
    superseded_by       INTEGER REFERENCES quotes(quote_id),

    created_by          VARCHAR(100),
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- QUOTE LINE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS quote_line_items (
    line_id             SERIAL PRIMARY KEY,
    quote_id            INTEGER NOT NULL REFERENCES quotes(quote_id) ON DELETE CASCADE,
    line_number         INTEGER NOT NULL DEFAULT 1,

    -- 'bus'    -> priced unit from inventory; becomes a sale on acceptance
    -- 'charge' -> transport, import, customs, prep, warranty extension, etc.
    --             a negative unit_price makes it a discount line
    line_type           VARCHAR(20) NOT NULL DEFAULT 'bus',

    inventory_id        INTEGER REFERENCES inventory(inventory_id),

    -- Snapshot of the unit at quote time
    stock_number        VARCHAR(50),
    vin                 VARCHAR(17),
    unit_year           INTEGER,
    make                VARCHAR(100),
    model               VARCHAR(100),
    body_style          VARCHAR(100),
    passenger_capacity  INTEGER,
    odometer            INTEGER,

    description         TEXT NOT NULL,
    quantity            DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price          DECIMAL(14,2) NOT NULL DEFAULT 0,
    line_total          DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    notes               TEXT,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Link a sale back to the quote it came from
-- ============================================================
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS quote_id INTEGER REFERENCES quotes(quote_id);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_quotes_status        ON quotes(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_quotes_client        ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_date          ON quotes(quote_date DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_number        ON quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_quote_lines_quote    ON quote_line_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_lines_inv      ON quote_line_items(inventory_id) WHERE line_type = 'bus';
CREATE INDEX IF NOT EXISTS idx_inventory_quote      ON inventory(quote_id);

-- ============================================================
-- Constraints (added separately so re-runs don't fail)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_status_check') THEN
        ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
            CHECK (status IN ('Draft','Sent','Accepted','Rejected','Expired','Cancelled'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_lines_type_check') THEN
        ALTER TABLE quote_line_items ADD CONSTRAINT quote_lines_type_check
            CHECK (line_type IN ('bus','charge'));
    END IF;
END $$;

-- ============================================================
-- updated_at trigger (reuses the function from the base schema)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_quotes_updated_at') THEN
        CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- Convenience view: open quotes with their unit count
-- ============================================================
CREATE OR REPLACE VIEW open_quotes AS
SELECT q.*,
       COUNT(li.line_id) FILTER (WHERE li.line_type = 'bus') AS unit_count,
       (q.valid_until IS NOT NULL AND q.valid_until < CURRENT_DATE) AS is_past_due
FROM quotes q
LEFT JOIN quote_line_items li ON li.quote_id = q.quote_id
WHERE q.is_deleted = FALSE
  AND q.status IN ('Draft','Sent')
GROUP BY q.quote_id
ORDER BY q.quote_date DESC;

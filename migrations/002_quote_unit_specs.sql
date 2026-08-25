-- Buses America - Quoting Module
-- Migration 002: richer unit snapshot on quote line items
--
-- The printed quote shows a full spec panel for single-unit quotes (marca,
-- modelo, año, color, kilómetros, pasajeros, motor, transmisión, VIN,
-- condición). Those extra fields are snapshotted onto the line item alongside
-- the ones migration 001 already captured, so reprinting an old quote keeps
-- showing the unit as it was described when the quote was issued.
--
-- Safe to run repeatedly.

ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS exterior_color VARCHAR(50);
ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS engine_make    VARCHAR(100);
ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS engine_model   VARCHAR(100);
ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS engine_type    VARCHAR(50);
ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS fuel_type      VARCHAR(50);
ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS transmission   VARCHAR(100);
ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS condition      VARCHAR(50);

-- Backfill existing quote lines from inventory. Only touches rows where the
-- snapshot is still empty, so it never overwrites a captured value.
UPDATE quote_line_items li
SET exterior_color = i.exterior_color,
    engine_make    = i.engine_make,
    engine_model   = i.engine_model,
    engine_type    = i.engine_type,
    fuel_type      = i.fuel_type,
    transmission   = i.transmission,
    condition      = i.condition
FROM inventory i
WHERE li.inventory_id = i.inventory_id
  AND li.line_type = 'bus'
  AND li.exterior_color IS NULL
  AND li.engine_make IS NULL
  AND li.transmission IS NULL
  AND li.condition IS NULL;

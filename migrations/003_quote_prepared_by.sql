-- Buses America - Quoting Module
-- Migration 003: per-seller "Elaborado por" details
--
-- Each seller quotes under their own name and phone number, so these belong on
-- the quote rather than being one fixed company block on the document. Stored
-- per quote so reprinting an old cotización still shows whoever issued it, even
-- after that person's details change or they leave.
--
-- Safe to run repeatedly.

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS prepared_by_name  VARCHAR(255);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS prepared_by_phone VARCHAR(50);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS prepared_by_email VARCHAR(255);

-- Backfill from the username captured at creation, so existing quotes keep
-- showing a name rather than going blank.
UPDATE quotes q
SET prepared_by_name = COALESCE(u.full_name, q.created_by),
    prepared_by_email = u.email
FROM users u
WHERE u.username = q.created_by
  AND q.prepared_by_name IS NULL;

UPDATE quotes
SET prepared_by_name = created_by
WHERE prepared_by_name IS NULL
  AND created_by IS NOT NULL;

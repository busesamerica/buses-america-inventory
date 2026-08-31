-- Buses America - Migration 004: fix inventory location/status vocabulary
--
-- Two frontend forms (CreateInventoryModal.jsx, InventoryManagement.jsx) and
-- the create-inventory-from-inspection endpoint wrote current_location as
-- 'United States' / 'Mexico' and status as 'Available', instead of the
-- 'US Stock' / 'Mexico Stock' vocabulary the dashboard and reporting SQL
-- actually filter on (e.g. COUNT(*) FILTER (WHERE current_location =
-- 'US Stock')). As a result the "US Inventory" / "Mexico Inventory"
-- dashboard cards, and the us_inventory/mexico_inventory views, silently
-- missed every unit created or edited through the app.
--
-- Separately, the same edit form's status dropdown let a user set status to
-- 'Sold' or 'Delivered' directly, without going through the sales-recording
-- flow (POST /api/sales/record) that sets is_sold. So is_sold stayed FALSE
-- even though the unit's own status said otherwise, and the "Available"
-- dashboard card (is_sold = FALSE) kept counting units the app itself
-- called sold or delivered.
--
-- This backfills existing rows to match; backend_api_FINAL.py and the
-- frontend forms are fixed separately so new rows are written correctly
-- and this class of drift can't happen again.
--
-- Safe to run repeatedly.

UPDATE inventory
SET current_location = 'US Stock'
WHERE current_location = 'United States';

UPDATE inventory
SET current_location = 'Mexico Stock'
WHERE current_location = 'Mexico';

-- A unit can't legitimately reach any of these statuses without having been
-- sold. This is deliberately narrower than the full documented pipeline:
-- 'Import/Customs Processing' and 'In Stock (Mexico)' are left out because
-- Mexico Stock is also a valid *pre-sale* location (see the 'Available' fix
-- above, which can itself produce 'In Stock (Mexico)') - a unit can be
-- relocated there before it's sold, not only imported there after.
UPDATE inventory
SET is_sold = TRUE
WHERE is_sold = FALSE
  AND status IN (
    'Sold', 'Sold - Pending Import', 'In Preventive Maintenance',
    'Ready for Delivery', 'In Transit to Client', 'Delivered'
  );

-- Normalize the old ad-hoc status values onto the documented pipeline where
-- it can be inferred confidently. 'Under Repair' has no clear equivalent in
-- the documented list and isn't filtered on anywhere, so it's left as-is
-- for manual review rather than guessed at.
UPDATE inventory
SET status = CASE current_location
    WHEN 'US Stock' THEN 'In Stock (US)'
    WHEN 'Mexico Stock' THEN 'In Stock (Mexico)'
    ELSE 'Purchased - In Transit to Stock'
  END
WHERE status = 'Available';

-- 'Sold' itself is NOT rewritten here: it's a supported status (the generic
-- milestone for a unit that's sold but hasn't started the import pipeline
-- yet), not just legacy debris - see POST_SALE_STATUSES in
-- backend_api_FINAL.py. Since migrate.py re-runs every file in this
-- directory on every deploy, rewriting it here would keep clobbering
-- legitimate new 'Sold' rows going forward, not just the old ad-hoc ones
-- this migration was originally written to clean up.

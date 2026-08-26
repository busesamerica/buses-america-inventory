-- Buses America - Migration 005: fix status not advancing on sale
--
-- POST /api/sales/record (and quote acceptance, which calls the same
-- function) only ever set is_sold = TRUE - it never touched status. So a
-- unit sold through the real sale-recording flow kept whatever pre-sale
-- status it had forever (e.g. the old ad-hoc 'Available' value from before
-- migration 004, or 'In Stock (US)'). Anything that displays status
-- directly instead of is_sold - e.g. InventoryManagement.jsx's expanded
-- row ("Status: Available" in green) - kept showing a properly-sold unit
-- as available indefinitely, even though the dashboard's own is_sold-based
-- counts were already correct.
--
-- backend_api_FINAL.py's record_sale now also advances status; this
-- backfills rows that were sold before that fix shipped.
--
-- Safe to run repeatedly.

UPDATE inventory
SET status = 'Sold'
WHERE is_sold = TRUE
  AND status NOT IN (
    'Sold', 'Sold - Pending Import', 'In Preventive Maintenance',
    'Ready for Delivery', 'In Transit to Client', 'Delivered'
  );

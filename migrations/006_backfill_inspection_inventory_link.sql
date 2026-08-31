-- Buses America - Migration 006: backfill pre_purchase_inspections.inventory_id
--
-- create_inventory_from_inspection (the "Create Inventory" button off an
-- approved pre-inspection) set inventory.pre_inspection_id on the new
-- inventory row, but never set the reverse pre_purchase_inspections.
-- inventory_id column - the same relationship, other direction, both
-- columns already existed. Nothing reads it today, but a report or future
-- "which inspections have already resulted in inventory" feature reading
-- that column would silently see none of them. Fixed going forward in
-- backend_api_FINAL.py; this backfills existing rows using
-- inventory.pre_inspection_id, which was set correctly.
--
-- Safe to run repeatedly.

UPDATE pre_purchase_inspections p
SET inventory_id = i.inventory_id
FROM inventory i
WHERE i.pre_inspection_id = p.inspection_id
  AND i.is_deleted = FALSE
  AND p.inventory_id IS NULL;

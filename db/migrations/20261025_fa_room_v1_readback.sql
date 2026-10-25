-- Run only after 20261025_fa_room_v1.sql on the database named by CCPUN_FA_DATABASE_URL.
-- Metadata only: no ciphertext, names or amounts are selected.
SELECT
  current_database() AS database_name,
  current_user AS inspected_by,
  (SELECT checksum FROM ccpun_fa.schema_migration WHERE version = '20261025_fa_room_v1') AS migration_checksum,
  to_regclass('ccpun_fa.household') IS NOT NULL AS household_exists,
  to_regclass('ccpun_fa.cashflow_item') IS NOT NULL AS cashflow_item_exists,
  to_regclass('ccpun_fa.asset') IS NOT NULL AS asset_exists,
  to_regclass('ccpun_fa.liability') IS NOT NULL AS liability_exists,
  to_regclass('ccpun_fa.crm_note') IS NOT NULL AS crm_note_exists,
  has_table_privilege('ccpun_fa_runtime','ccpun_fa.household','SELECT,INSERT') AS runtime_household_ready,
  has_table_privilege('ccpun_fa_runtime','ccpun_fa.household','DELETE') AS runtime_can_delete_household,
  has_table_privilege('ccpun_fa_runtime','ccpun_fa.crm_note','UPDATE,DELETE') AS runtime_can_change_notes,
  has_table_privilege('ccpun_fa_runtime','ccpun_fa.cashflow_item','INSERT,UPDATE,DELETE') AS runtime_can_write_items_directly,
  has_function_privilege('ccpun_fa_runtime','ccpun_fa.replace_household_plan(uuid,integer,jsonb,jsonb)','EXECUTE') AS runtime_plan_save_ready,
  (SELECT count(*) FROM ccpun_fa.household) AS household_count,
  (SELECT count(*) FROM ccpun_fa.household WHERE client_status = 'former' AND retention_until < current_date) AS purge_candidate_count;
-- Expected: the three runtime_can_* columns are false.

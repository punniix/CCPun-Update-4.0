SELECT
  current_database()='neondb' AS database_ok,
  EXISTS(SELECT 1 FROM ccpun_admin.system_identity WHERE singleton=true) AS identity_present,
  EXISTS(
    SELECT 1 FROM ccpun_admin.schema_migration
    WHERE version='20260924_agent_os_runtime_foundation_v1'
      AND checksum='sha256:09fe7ab43995ebba81aa914e47fd3b686c989ef1934e414443251d7b8c79cd47'
  ) AS foundation_current,
  EXISTS(
    SELECT 1 FROM ccpun_admin.schema_migration
    WHERE version='20260924_agent_os_runtime_lookup_v2'
      AND checksum='sha256:43dbbb737b1c59c4b16290a9c65bf6cd10fffc22bcff48065f69f6b2d07339f1'
  ) AS migration_current,
  to_regprocedure('ccpun_admin.admin_read_agent_runtime_job(uuid)') IS NOT NULL AS lookup_fn_present,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_agent_runtime_job(uuid)','EXECUTE') AS runtime_lookup_allowed,
  NOT has_table_privilege('ccpun_admin_runtime','ccpun_admin.agent_runtime_job','SELECT') AS direct_table_read_denied,
  NOT EXISTS(
    SELECT 1 FROM ccpun_admin.admin_read_agent_runtime_job('00000000-0000-0000-0000-000000000000'::uuid)
  ) AS missing_job_returns_empty;

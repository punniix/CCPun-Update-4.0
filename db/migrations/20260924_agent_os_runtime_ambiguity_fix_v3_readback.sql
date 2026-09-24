SELECT
  EXISTS(
    SELECT 1 FROM ccpun_admin.schema_migration
    WHERE version='20260924_agent_os_runtime_ambiguity_fix_v3'
      AND checksum='sha256:716301de4482a440dbf03cae33310707606db796db0576be7f025439171e2938'
  ) AS migration_current,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_create_agent_runtime_job(jsonb)','EXECUTE')
    AND has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_update_agent_runtime_job(jsonb)','EXECUTE') AS runtime_functions_allowed,
  NOT has_table_privilege('ccpun_admin_runtime','ccpun_admin.agent_runtime_job','SELECT')
    AND NOT has_table_privilege('ccpun_admin_runtime','ccpun_admin.agent_runtime_job_event','SELECT') AS direct_table_read_denied;

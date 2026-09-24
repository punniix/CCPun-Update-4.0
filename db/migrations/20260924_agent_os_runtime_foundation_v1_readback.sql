SELECT
  current_database()='neondb' AS database_ok,
  EXISTS(SELECT 1 FROM ccpun_admin.system_identity WHERE singleton=true) AS identity_present,
  EXISTS(
    SELECT 1 FROM ccpun_admin.schema_migration
    WHERE version='20260924_agent_os_runtime_foundation_v1'
      AND checksum='sha256:b49057328ddd5e4c2f98275aec536ec0afe4504615cd4362e74afcbd833365bb'
  ) AS migration_current,
  to_regclass('ccpun_admin.agent_runtime_job') IS NOT NULL AS job_table_present,
  to_regprocedure('ccpun_admin.admin_create_agent_runtime_job(jsonb)') IS NOT NULL AS create_fn_present,
  to_regprocedure('ccpun_admin.admin_update_agent_runtime_job(jsonb)') IS NOT NULL AS update_fn_present,
  to_regprocedure('ccpun_admin.admin_read_agent_runtime_jobs(integer)') IS NOT NULL AS read_fn_present,
  to_regprocedure('ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)') IS NOT NULL AS duration_fn_present,
  NOT has_table_privilege('ccpun_admin_runtime','ccpun_admin.agent_runtime_job','SELECT')
    AND NOT has_table_privilege('ccpun_admin_runtime','ccpun_admin.agent_runtime_job','INSERT')
    AND NOT has_table_privilege('ccpun_admin_runtime','ccpun_admin.agent_runtime_job','UPDATE')
    AND NOT has_table_privilege('ccpun_admin_runtime','ccpun_admin.agent_runtime_job','DELETE') AS direct_table_denied,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_create_agent_runtime_job(jsonb)','EXECUTE')
    AND has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_update_agent_runtime_job(jsonb)','EXECUTE')
    AND has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_agent_runtime_jobs(integer)','EXECUTE')
    AND has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)','EXECUTE') AS runtime_functions_allowed;

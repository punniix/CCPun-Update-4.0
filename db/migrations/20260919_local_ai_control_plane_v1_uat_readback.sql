SELECT
  i.lane,i.project_id,i.branch_id,i.endpoint_id,i.database_name,i.migration_version,i.migration_checksum,
  current_database() AS current_database,
  EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ccpun_local_ai_runtime' AND NOT rolcanlogin AND NOT rolsuper
    AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls) AS worker_role_safe,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_enqueue_local_ai_job(uuid,text,text,text,text,text,smallint,text,text,smallint)','EXECUTE') AS admin_enqueue_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_local_ai_jobs(integer)','EXECUTE') AS admin_read_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_local_ai_job(uuid)','EXECUTE') AS admin_read_one_ok,
  has_function_privilege('ccpun_local_ai_runtime','ccpun_admin.worker_claim_local_ai_job(text,text,integer,boolean)','EXECUTE') AS worker_claim_ok,
  has_function_privilege('ccpun_local_ai_runtime','ccpun_admin.worker_complete_local_ai_job(uuid,text,text,jsonb,text)','EXECUTE') AS worker_complete_ok,
  NOT has_table_privilege('ccpun_local_ai_runtime','ccpun_admin.local_ai_job','SELECT,INSERT,UPDATE,DELETE') AS worker_table_denied,
  NOT EXISTS(SELECT 1 FROM information_schema.role_table_grants WHERE grantee='PUBLIC' AND table_schema='ccpun_admin' AND table_name='local_ai_job') AS public_table_denied
FROM ccpun_admin.local_ai_identity i
WHERE i.singleton=true
  AND i.lane='uat'
  AND i.project_id='young-term-47483330'
  AND i.branch_id='br-crimson-mouse-az7ajkv8'
  AND i.endpoint_id='ep-mute-frost-aztvz394'
  AND i.database_name='neondb'
  AND i.migration_version='20260919_local_ai_control_plane_v1'
  AND i.migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6';

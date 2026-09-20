SELECT
  i.lane,i.project_id,i.branch_id,i.endpoint_id,i.database_name,
  EXISTS(
    SELECT 1 FROM ccpun_admin.schema_migration
    WHERE version='20260920_local_ai_production_operations_v2'
      AND checksum='sha256:deb9f6761364a61bae275d5226f341ca021087da4116bc3f4703bd8b8c46fb1f'
  ) AS v2_ledger_current,
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='ccpun_admin' AND table_name='local_ai_job' AND column_name='request_fingerprint'
  ) AS request_fingerprint_present,
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='ccpun_admin' AND table_name='local_ai_job' AND column_name='queue_class'
  ) AS queue_class_present,
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='ccpun_admin' AND table_name='local_ai_job' AND column_name='next_attempt_at'
  ) AS delayed_retry_present,
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='ccpun_admin' AND table_name='local_ai_job' AND column_name='max_attempts' AND column_default='3'
  ) AS max_attempts_default_ok,
  NOT EXISTS(
    SELECT 1 FROM ccpun_admin.local_ai_job
    WHERE status IN ('queued','leased') AND max_attempts<3
  ) AS active_retry_budget_ok,
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='ccpun_admin' AND table_name='local_ai_job' AND column_name='review_status'
  ) AS review_status_present,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_enqueue_local_ai_job_v2(uuid,text,text,text,text,text,smallint,text,text,text,text)','EXECUTE') AS enqueue_v2_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_local_ai_jobs_v2(integer)','EXECUTE') AS review_queue_read_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_local_ai_review_queue_v2(integer)','EXECUTE') AS owner_review_read_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_local_ai_job_v2(uuid)','EXECUTE') AS bridge_read_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_local_ai_health_v2()','EXECUTE') AS health_read_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_local_ai_incidents_v2(integer)','EXECUTE') AS incident_read_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_review_local_ai_job_v2(uuid,text,text,text)','EXECUTE') AS review_write_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_enqueue_local_ai_job(uuid,text,text,text,text,text,smallint,text,text,smallint)','EXECUTE') AS enqueue_v1_cutover_grant_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_local_ai_jobs(integer)','EXECUTE') AS jobs_v1_cutover_grant_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_local_ai_job(uuid)','EXECUTE') AS bridge_v1_cutover_grant_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_local_ai_health()','EXECUTE') AS health_v1_cutover_grant_ok,
  has_function_privilege('ccpun_local_ai_runtime','ccpun_admin.worker_claim_local_ai_job(text,text,integer,boolean)','EXECUTE') AS worker_claim_ok,
  has_function_privilege('ccpun_local_ai_runtime','ccpun_admin.worker_complete_local_ai_job(uuid,text,text,jsonb,text)','EXECUTE') AS worker_complete_ok,
  has_function_privilege('ccpun_local_ai_runtime','ccpun_admin.worker_fail_local_ai_job(uuid,text,text,boolean,boolean)','EXECUTE') AS worker_fail_ok,
  has_function_privilege('ccpun_local_ai_runtime','ccpun_admin.worker_report_local_ai_heartbeat(text,text,text,boolean,boolean,integer,jsonb)','EXECUTE') AS worker_heartbeat_ok,
  NOT has_table_privilege('ccpun_local_ai_runtime','ccpun_admin.local_ai_job','SELECT,INSERT,UPDATE,DELETE') AS worker_table_denied,
  position('active_count>=25' in pg_get_functiondef('ccpun_admin.admin_enqueue_local_ai_job_v2(uuid,text,text,text,text,text,smallint,text,text,text,text)'::regprocedure))>0 AS backpressure_cap_ok,
  EXISTS(SELECT 1 FROM pg_constraint WHERE conname='local_ai_job_queue_class_check') AS queue_class_policy_ok,
  position('next_attempt_at' in pg_get_functiondef('ccpun_admin.worker_fail_local_ai_job(uuid,text,text,boolean,boolean)'::regprocedure))>0 AS retry_delay_enforced,
  position('request_fingerprint' in pg_get_functiondef('ccpun_admin.admin_enqueue_local_ai_job_v2(uuid,text,text,text,text,text,smallint,text,text,text,text)'::regprocedure))>0 AS payload_bound_idempotency_ok,
  position('review_status=''approved''' in pg_get_functiondef('ccpun_admin.admin_read_local_ai_job_v2(uuid)'::regprocedure))>0 AS output_review_gate_ok
FROM ccpun_admin.local_ai_identity i
WHERE i.singleton=true
  AND i.lane='uat'
  AND i.project_id='young-term-47483330'
  AND i.branch_id='br-crimson-mouse-az7ajkv8'
  AND i.endpoint_id='ep-mute-frost-aztvz394'
  AND i.database_name='neondb'
  AND i.migration_version='20260919_local_ai_control_plane_v1'
  AND i.migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6';

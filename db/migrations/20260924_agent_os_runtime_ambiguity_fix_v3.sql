BEGIN;

SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime'
    AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
    AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls
) THEN 1 ELSE 0 END AS runtime_role_guard;
SELECT 1 / CASE WHEN EXISTS (
  SELECT 1 FROM ccpun_admin.system_identity WHERE singleton=true
) THEN 1 ELSE 0 END AS identity_guard;
SELECT 1 / CASE WHEN EXISTS (
  SELECT 1 FROM ccpun_admin.schema_migration
  WHERE version='20260924_agent_os_runtime_foundation_v1'
    AND checksum='sha256:09fe7ab43995ebba81aa914e47fd3b686c989ef1934e414443251d7b8c79cd47'
) THEN 1 ELSE 0 END AS foundation_guard;
SELECT 1 / CASE WHEN EXISTS (
  SELECT 1 FROM ccpun_admin.schema_migration
  WHERE version='20260924_agent_os_runtime_lookup_v2'
    AND checksum='sha256:43dbbb737b1c59c4b16290a9c65bf6cd10fffc22bcff48065f69f6b2d07339f1'
) THEN 1 ELSE 0 END AS lookup_guard;

SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260924_agent_os_runtime_ambiguity_fix_v3'));
SELECT 1 / CASE WHEN NOT EXISTS (
  SELECT 1 FROM ccpun_admin.schema_migration
  WHERE version='20260924_agent_os_runtime_ambiguity_fix_v3' AND checksum<>'sha256:716301de4482a440dbf03cae33310707606db796db0576be7f025439171e2938'
) THEN 1 ELSE 0 END AS checksum_guard;

-- checksum-source-begin
CREATE OR REPLACE FUNCTION ccpun_admin.admin_create_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text,job_id uuid,correlation_id uuid,request_id uuid,row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_create$
DECLARE
  v_existing ccpun_admin.agent_runtime_job%ROWTYPE;
  v_inserted ccpun_admin.agent_runtime_job%ROWTYPE;
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR payload - ARRAY[
      'job_id','correlation_id','request_id','idempotency_key','payload_digest_sha256',
      'source','action','workflow_key','status','stage','queue_class','attempt','max_attempts',
      'queued_at','started_at','heartbeat_at','n8n_execution_id','provider_reference'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job create payload';
  END IF;

  INSERT INTO ccpun_admin.agent_runtime_job(
    job_id,correlation_id,request_id,idempotency_key,payload_digest_sha256,
    source,action,workflow_key,status,stage,queue_class,attempt,max_attempts,
    queued_at,started_at,heartbeat_at,n8n_execution_id,provider_reference
  ) VALUES (
    NULLIF(payload->>'job_id','')::uuid,
    NULLIF(payload->>'correlation_id','')::uuid,
    NULLIF(payload->>'request_id','')::uuid,
    payload->>'idempotency_key',
    payload->>'payload_digest_sha256',
    payload->>'source',
    payload->>'action',
    payload->>'workflow_key',
    COALESCE(NULLIF(payload->>'status',''),'queued'),
    payload->>'stage',
    payload->>'queue_class',
    COALESCE(NULLIF(payload->>'attempt','')::integer,0),
    COALESCE(NULLIF(payload->>'max_attempts','')::integer,1),
    NULLIF(payload->>'queued_at','')::timestamptz,
    NULLIF(payload->>'started_at','')::timestamptz,
    NULLIF(payload->>'heartbeat_at','')::timestamptz,
    NULLIF(payload->>'n8n_execution_id',''),
    NULLIF(payload->>'provider_reference','')
  )
  ON CONFLICT(idempotency_key) DO NOTHING
  RETURNING * INTO v_inserted;

  IF FOUND THEN
    INSERT INTO ccpun_admin.agent_runtime_job_event(
      job_id,row_version,status,stage,attempt,error_category
    ) VALUES (
      v_inserted.job_id,v_inserted.row_version,v_inserted.status,
      v_inserted.stage,v_inserted.attempt,v_inserted.error_category
    ) ON CONFLICT DO NOTHING;

    RETURN QUERY SELECT
      'created'::text,v_inserted.job_id,v_inserted.correlation_id,
      v_inserted.request_id,v_inserted.row_version;
    RETURN;
  END IF;

  SELECT * INTO v_existing
  FROM ccpun_admin.agent_runtime_job
  WHERE idempotency_key=payload->>'idempotency_key';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agent job idempotency winner unavailable';
  END IF;

  IF v_existing.payload_digest_sha256=payload->>'payload_digest_sha256'
    AND v_existing.source=payload->>'source'
    AND v_existing.action=payload->>'action'
    AND v_existing.workflow_key=payload->>'workflow_key' THEN
    RETURN QUERY SELECT
      'duplicate'::text,v_existing.job_id,v_existing.correlation_id,
      v_existing.request_id,v_existing.row_version;
  ELSE
    RETURN QUERY SELECT
      'idempotency_conflict'::text,v_existing.job_id,v_existing.correlation_id,
      v_existing.request_id,v_existing.row_version;
  END IF;
END
$agent_create$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_update_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text,row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_update$
DECLARE
  v_job ccpun_admin.agent_runtime_job%ROWTYPE;
  v_next_status text;
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR payload - ARRAY[
      'job_id','expected_version','status','stage','attempt','heartbeat_at','started_at',
      'completed_at','n8n_execution_id','provider_reference','error_category',
      'duration_ms','queue_wait_ms'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job update payload';
  END IF;

  SELECT * INTO v_job
  FROM ccpun_admin.agent_runtime_job AS j
  WHERE j.job_id=NULLIF(payload->>'job_id','')::uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text,NULL::bigint;
    RETURN;
  END IF;

  IF v_job.row_version<>NULLIF(payload->>'expected_version','')::bigint THEN
    RETURN QUERY SELECT 'conflict'::text,v_job.row_version;
    RETURN;
  END IF;

  v_next_status:=COALESCE(NULLIF(payload->>'status',''),v_job.status);

  IF v_job.status IN ('completed','failed','cancelled') AND v_next_status<>v_job.status THEN
    RETURN QUERY SELECT 'terminal'::text,v_job.row_version;
    RETURN;
  END IF;

  UPDATE ccpun_admin.agent_runtime_job AS j SET
    status=v_next_status,
    stage=COALESCE(NULLIF(payload->>'stage',''),j.stage),
    attempt=COALESCE(NULLIF(payload->>'attempt','')::integer,j.attempt),
    heartbeat_at=CASE WHEN payload ? 'heartbeat_at'
      THEN NULLIF(payload->>'heartbeat_at','')::timestamptz ELSE j.heartbeat_at END,
    started_at=CASE WHEN payload ? 'started_at'
      THEN NULLIF(payload->>'started_at','')::timestamptz ELSE j.started_at END,
    completed_at=CASE
      WHEN v_next_status IN ('completed','failed','cancelled')
        THEN COALESCE(NULLIF(payload->>'completed_at','')::timestamptz,j.completed_at,now())
      WHEN payload ? 'completed_at' THEN NULLIF(payload->>'completed_at','')::timestamptz
      ELSE j.completed_at
    END,
    n8n_execution_id=CASE WHEN payload ? 'n8n_execution_id'
      THEN NULLIF(payload->>'n8n_execution_id','') ELSE j.n8n_execution_id END,
    provider_reference=CASE WHEN payload ? 'provider_reference'
      THEN NULLIF(payload->>'provider_reference','') ELSE j.provider_reference END,
    error_category=CASE WHEN payload ? 'error_category'
      THEN NULLIF(payload->>'error_category','') ELSE j.error_category END,
    duration_ms=CASE WHEN payload ? 'duration_ms'
      THEN NULLIF(payload->>'duration_ms','')::bigint ELSE j.duration_ms END,
    queue_wait_ms=CASE WHEN payload ? 'queue_wait_ms'
      THEN NULLIF(payload->>'queue_wait_ms','')::bigint ELSE j.queue_wait_ms END,
    row_version=j.row_version+1,
    updated_at=now()
  WHERE j.job_id=v_job.job_id
  RETURNING j.* INTO v_job;

  INSERT INTO ccpun_admin.agent_runtime_job_event(
    job_id,row_version,status,stage,attempt,error_category
  ) VALUES (
    v_job.job_id,v_job.row_version,v_job.status,v_job.stage,v_job.attempt,v_job.error_category
  ) ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT 'updated'::text,v_job.row_version;
END
$agent_update$;

REVOKE ALL ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb)
TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260924_agent_os_runtime_ambiguity_fix_v3','sha256:716301de4482a440dbf03cae33310707606db796db0576be7f025439171e2938')
ON CONFLICT(version) DO NOTHING;

COMMIT;

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
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260924_agent_os_runtime_foundation_v1'));
SELECT 1 / CASE WHEN NOT EXISTS (
  SELECT 1 FROM ccpun_admin.schema_migration
  WHERE version='20260924_agent_os_runtime_foundation_v1'
    AND checksum<>'sha256:08c3dc4dedd0c5e47b2bec67e2a9826fb3b6b1cdf66dec24b11274b7cbb479ce'
) THEN 1 ELSE 0 END AS checksum_guard;

-- checksum-source-begin
CREATE TABLE IF NOT EXISTS ccpun_admin.agent_runtime_job (
  job_id uuid PRIMARY KEY,
  correlation_id uuid NOT NULL,
  request_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,159}
  action text NOT NULL CHECK (action ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  workflow_key text NOT NULL CHECK (workflow_key ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  status text NOT NULL CHECK (status IN (
    'queued','running','waiting_external','waiting_ai','validating','awaiting_review',
    'retrying','completed','failed','reconciliation_required','cancelled'
  )),
  stage text NOT NULL CHECK (stage ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  queue_class text NOT NULL CHECK (queue_class IN ('realtime','urgent','normal','batch')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0 AND attempt <= 20),
  max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 20),
  queued_at timestamptz,
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz,
  n8n_execution_id text CHECK (n8n_execution_id IS NULL OR length(n8n_execution_id) BETWEEN 1 AND 160),
  provider_reference text CHECK (provider_reference IS NULL OR length(provider_reference) BETWEEN 1 AND 200),
  error_category text CHECK (error_category IS NULL OR error_category ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  duration_ms bigint CHECK (duration_ms IS NULL OR duration_ms >= 0),
  queue_wait_ms bigint CHECK (queue_wait_ms IS NULL OR queue_wait_ms >= 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (attempt <= max_attempts),
  CHECK ((status IN ('completed','failed','cancelled')) = (completed_at IS NOT NULL)),
  CHECK (started_at IS NULL OR queued_at IS NULL OR started_at >= queued_at),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX IF NOT EXISTS agent_runtime_job_updated_idx
  ON ccpun_admin.agent_runtime_job(updated_at DESC);

CREATE INDEX IF NOT EXISTS agent_runtime_job_active_idx
  ON ccpun_admin.agent_runtime_job(status, queue_class, updated_at)
  WHERE status IN ('queued','running','waiting_external','waiting_ai','validating','awaiting_review','retrying','reconciliation_required');

CREATE INDEX IF NOT EXISTS agent_runtime_job_workflow_duration_idx
  ON ccpun_admin.agent_runtime_job(workflow_key, stage, completed_at DESC)
  WHERE status='completed' AND duration_ms IS NOT NULL;

CREATE TABLE IF NOT EXISTS ccpun_admin.agent_runtime_job_event (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES ccpun_admin.agent_runtime_job(job_id) ON DELETE CASCADE,
  row_version bigint NOT NULL CHECK (row_version > 0),
  status text NOT NULL CHECK (status IN (
    'queued','running','waiting_external','waiting_ai','validating','awaiting_review',
    'retrying','completed','failed','reconciliation_required','cancelled'
  )),
  stage text NOT NULL CHECK (stage ~ '^[a-z0-9][a-z0-9._:-]{0,159}
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_create$
DECLARE
  v_existing ccpun_admin.agent_runtime_job%ROWTYPE;
  v_job_id uuid;
  v_idempotency text;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','correlation_id','request_id','idempotency_key','payload_digest_sha256','source','action','workflow_key',
      'status','stage','queue_class','attempt','max_attempts','queued_at','started_at','heartbeat_at',
      'n8n_execution_id','provider_reference'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job create payload';
  END IF;

  v_job_id := NULLIF(payload->>'job_id','')::uuid;
  v_idempotency := payload->>'idempotency_key';

  SELECT * INTO v_existing
  FROM ccpun_admin.agent_runtime_job
  WHERE idempotency_key=v_idempotency;

  IF FOUND THEN
    IF v_existing.payload_digest_sha256=payload->>'payload_digest_sha256'
      AND v_existing.source=payload->>'source'
      AND v_existing.action=payload->>'action'
      AND v_existing.workflow_key=payload->>'workflow_key' THEN
      RETURN QUERY SELECT 'duplicate'::text,v_existing.job_id,v_existing.correlation_id,v_existing.request_id,v_existing.row_version;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'idempotency_conflict'::text,v_existing.job_id,v_existing.correlation_id,v_existing.request_id,v_existing.row_version;
    RETURN;
  END IF;

  INSERT INTO ccpun_admin.agent_runtime_job(
    job_id,correlation_id,request_id,idempotency_key,payload_digest_sha256,source,action,workflow_key,status,stage,
    queue_class,attempt,max_attempts,queued_at,started_at,heartbeat_at,n8n_execution_id,provider_reference
  ) VALUES (
    v_job_id,
    NULLIF(payload->>'correlation_id','')::uuid,
    NULLIF(payload->>'request_id','')::uuid,
    v_idempotency,
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
  );

  INSERT INTO ccpun_admin.agent_runtime_job_event(job_id,row_version,status,stage,attempt,error_category)
  SELECT job_id,row_version,status,stage,attempt,error_category
  FROM ccpun_admin.agent_runtime_job WHERE job_id=v_job_id;

  RETURN QUERY
  SELECT 'created'::text,j.job_id,j.correlation_id,j.request_id,j.row_version
  FROM ccpun_admin.agent_runtime_job j WHERE j.job_id=v_job_id;
END
$agent_create$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_update_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_update$
DECLARE
  v_job_id uuid := NULLIF(payload->>'job_id','')::uuid;
  v_expected bigint := NULLIF(payload->>'expected_version','')::bigint;
  v_current ccpun_admin.agent_runtime_job%ROWTYPE;
  v_next_status text;
  v_next_version bigint;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','expected_version','status','stage','attempt','heartbeat_at','started_at','completed_at',
      'n8n_execution_id','provider_reference','error_category','duration_ms','queue_wait_ms'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job update payload';
  END IF;

  SELECT * INTO v_current
  FROM ccpun_admin.agent_runtime_job
  WHERE agent_runtime_job.job_id=v_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text,NULL::bigint;
    RETURN;
  END IF;

  IF v_current.row_version<>v_expected THEN
    RETURN QUERY SELECT 'conflict'::text,v_current.row_version;
    RETURN;
  END IF;

  v_next_status := COALESCE(NULLIF(payload->>'status',''),v_current.status);

  IF v_current.status IN ('completed','failed','cancelled')
    AND v_next_status<>v_current.status THEN
    RETURN QUERY SELECT 'terminal'::text,v_current.row_version;
    RETURN;
  END IF;

  UPDATE ccpun_admin.agent_runtime_job SET
    status=v_next_status,
    stage=COALESCE(NULLIF(payload->>'stage',''),stage),
    attempt=COALESCE(NULLIF(payload->>'attempt','')::integer,attempt),
    heartbeat_at=COALESCE(NULLIF(payload->>'heartbeat_at','')::timestamptz,heartbeat_at),
    started_at=COALESCE(NULLIF(payload->>'started_at','')::timestamptz,started_at),
    completed_at=CASE
      WHEN v_next_status IN ('completed','failed','cancelled')
        THEN COALESCE(NULLIF(payload->>'completed_at','')::timestamptz,completed_at,now())
      WHEN payload ? 'completed_at' THEN NULLIF(payload->>'completed_at','')::timestamptz
      ELSE completed_at
    END,
    n8n_execution_id=CASE WHEN payload ? 'n8n_execution_id' THEN NULLIF(payload->>'n8n_execution_id','') ELSE n8n_execution_id END,
    provider_reference=CASE WHEN payload ? 'provider_reference' THEN NULLIF(payload->>'provider_reference','') ELSE provider_reference END,
    error_category=CASE WHEN payload ? 'error_category' THEN NULLIF(payload->>'error_category','') ELSE error_category END,
    duration_ms=CASE WHEN payload ? 'duration_ms' THEN NULLIF(payload->>'duration_ms','')::bigint ELSE duration_ms END,
    queue_wait_ms=CASE WHEN payload ? 'queue_wait_ms' THEN NULLIF(payload->>'queue_wait_ms','')::bigint ELSE queue_wait_ms END,
    row_version=row_version+1,
    updated_at=now()
  WHERE agent_runtime_job.job_id=v_job_id
  RETURNING * INTO v_current;

  v_next_version := v_current.row_version;

  INSERT INTO ccpun_admin.agent_runtime_job_event(job_id,row_version,status,stage,attempt,error_category)
  VALUES(v_current.job_id,v_current.row_version,v_current.status,v_current.stage,v_current.attempt,v_current.error_category)
  ON CONFLICT(job_id,row_version) DO NOTHING;

  RETURN QUERY SELECT 'updated'::text,v_next_version;
END
$agent_update$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_jobs(p_limit integer DEFAULT 50)
RETURNS TABLE(
  job_id uuid,correlation_id uuid,request_id uuid,payload_digest_sha256 text,source text,action text,workflow_key text,
  status text,stage text,queue_class text,attempt integer,max_attempts integer,
  queued_at timestamptz,started_at timestamptz,heartbeat_at timestamptz,completed_at timestamptz,
  n8n_execution_id text,provider_reference text,error_category text,duration_ms bigint,queue_wait_ms bigint,
  row_version bigint,created_at timestamptz,updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_read$
  SELECT
    j.job_id,j.correlation_id,j.request_id,j.payload_digest_sha256,j.source,j.action,j.workflow_key,j.status,j.stage,j.queue_class,
    j.attempt,j.max_attempts,j.queued_at,j.started_at,j.heartbeat_at,j.completed_at,j.n8n_execution_id,
    j.provider_reference,j.error_category,j.duration_ms,j.queue_wait_ms,j.row_version,j.created_at,j.updated_at
  FROM ccpun_admin.agent_runtime_job j
  ORDER BY j.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_read$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_job_events(
  p_job_id uuid,p_limit integer DEFAULT 100
)
RETURNS TABLE(
  event_id uuid,job_id uuid,row_version bigint,status text,stage text,
  attempt integer,error_category text,occurred_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_events$
  SELECT e.event_id,e.job_id,e.row_version,e.status,e.stage,e.attempt,e.error_category,e.occurred_at
  FROM ccpun_admin.agent_runtime_job_event e
  WHERE e.job_id=p_job_id
  ORDER BY e.occurred_at ASC,e.row_version ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),500)
$agent_events$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_duration_samples(
  p_workflow_key text,p_stage text,p_limit integer DEFAULT 50
)
RETURNS TABLE(duration_ms bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_duration$
  SELECT j.duration_ms
  FROM ccpun_admin.agent_runtime_job j
  WHERE j.workflow_key=p_workflow_key
    AND j.stage=p_stage
    AND j.status='completed'
    AND j.duration_ms IS NOT NULL
  ORDER BY j.completed_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_duration$;

REVOKE ALL PRIVILEGES ON ccpun_admin.agent_runtime_job,ccpun_admin.agent_runtime_job_event FROM PUBLIC,ccpun_admin_runtime;
REVOKE ALL ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_job_events(uuid,integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_job_events(uuid,integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260924_agent_os_runtime_foundation_v1','sha256:08c3dc4dedd0c5e47b2bec67e2a9826fb3b6b1cdf66dec24b11274b7cbb479ce')
ON CONFLICT(version) DO NOTHING;

COMMIT;
),
  payload_digest_sha256 text NOT NULL CHECK (payload_digest_sha256 ~ '^[0-9a-f]{64}
  action text NOT NULL CHECK (action ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  workflow_key text NOT NULL CHECK (workflow_key ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  status text NOT NULL CHECK (status IN (
    'queued','running','waiting_external','waiting_ai','validating','awaiting_review',
    'retrying','completed','failed','reconciliation_required','cancelled'
  )),
  stage text NOT NULL CHECK (stage ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  queue_class text NOT NULL CHECK (queue_class IN ('realtime','urgent','normal','batch')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0 AND attempt <= 20),
  max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 20),
  queued_at timestamptz,
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz,
  n8n_execution_id text CHECK (n8n_execution_id IS NULL OR length(n8n_execution_id) BETWEEN 1 AND 160),
  provider_reference text CHECK (provider_reference IS NULL OR length(provider_reference) BETWEEN 1 AND 200),
  error_category text CHECK (error_category IS NULL OR error_category ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  duration_ms bigint CHECK (duration_ms IS NULL OR duration_ms >= 0),
  queue_wait_ms bigint CHECK (queue_wait_ms IS NULL OR queue_wait_ms >= 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (attempt <= max_attempts),
  CHECK ((status IN ('completed','failed','cancelled')) = (completed_at IS NOT NULL)),
  CHECK (started_at IS NULL OR queued_at IS NULL OR started_at >= queued_at),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX IF NOT EXISTS agent_runtime_job_updated_idx
  ON ccpun_admin.agent_runtime_job(updated_at DESC);

CREATE INDEX IF NOT EXISTS agent_runtime_job_active_idx
  ON ccpun_admin.agent_runtime_job(status, queue_class, updated_at)
  WHERE status IN ('queued','running','waiting_external','waiting_ai','validating','awaiting_review','retrying','reconciliation_required');

CREATE INDEX IF NOT EXISTS agent_runtime_job_workflow_duration_idx
  ON ccpun_admin.agent_runtime_job(workflow_key, stage, completed_at DESC)
  WHERE status='completed' AND duration_ms IS NOT NULL;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_create_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, job_id uuid, correlation_id uuid, request_id uuid, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_create$
DECLARE
  v_existing ccpun_admin.agent_runtime_job%ROWTYPE;
  v_inserted ccpun_admin.agent_runtime_job%ROWTYPE;
  v_job_id uuid;
  v_idempotency text;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','correlation_id','request_id','idempotency_key','payload_digest_sha256','source','action','workflow_key',
      'status','stage','queue_class','attempt','max_attempts','queued_at','started_at','heartbeat_at',
      'n8n_execution_id','provider_reference'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job create payload';
  END IF;

  v_job_id := NULLIF(payload->>'job_id','')::uuid;
  v_idempotency := payload->>'idempotency_key';

  INSERT INTO ccpun_admin.agent_runtime_job(
    job_id,correlation_id,request_id,idempotency_key,payload_digest_sha256,source,action,workflow_key,status,stage,
    queue_class,attempt,max_attempts,queued_at,started_at,heartbeat_at,n8n_execution_id,provider_reference
  ) VALUES (
    v_job_id,
    NULLIF(payload->>'correlation_id','')::uuid,
    NULLIF(payload->>'request_id','')::uuid,
    v_idempotency,
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
    INSERT INTO ccpun_admin.agent_runtime_job_event(job_id,row_version,status,stage,attempt,error_category)
    VALUES(v_inserted.job_id,v_inserted.row_version,v_inserted.status,v_inserted.stage,v_inserted.attempt,v_inserted.error_category)
    ON CONFLICT(job_id,row_version) DO NOTHING;

    RETURN QUERY SELECT 'created'::text,v_inserted.job_id,v_inserted.correlation_id,v_inserted.request_id,v_inserted.row_version;
    RETURN;
  END IF;

  SELECT * INTO v_existing
  FROM ccpun_admin.agent_runtime_job
  WHERE idempotency_key=v_idempotency;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agent job idempotency winner unavailable';
  END IF;

  IF v_existing.payload_digest_sha256=payload->>'payload_digest_sha256'
    AND v_existing.source=payload->>'source'
    AND v_existing.action=payload->>'action'
    AND v_existing.workflow_key=payload->>'workflow_key' THEN
    RETURN QUERY SELECT 'duplicate'::text,v_existing.job_id,v_existing.correlation_id,v_existing.request_id,v_existing.row_version;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'idempotency_conflict'::text,v_existing.job_id,v_existing.correlation_id,v_existing.request_id,v_existing.row_version;
END
$agent_create$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_update_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_update$
DECLARE
  v_job_id uuid := NULLIF(payload->>'job_id','')::uuid;
  v_expected bigint := NULLIF(payload->>'expected_version','')::bigint;
  v_current ccpun_admin.agent_runtime_job%ROWTYPE;
  v_next_status text;
  v_next_version bigint;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','expected_version','status','stage','attempt','heartbeat_at','started_at','completed_at',
      'n8n_execution_id','provider_reference','error_category','duration_ms','queue_wait_ms'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job update payload';
  END IF;

  SELECT * INTO v_current
  FROM ccpun_admin.agent_runtime_job
  WHERE agent_runtime_job.job_id=v_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text,NULL::bigint;
    RETURN;
  END IF;

  IF v_current.row_version<>v_expected THEN
    RETURN QUERY SELECT 'conflict'::text,v_current.row_version;
    RETURN;
  END IF;

  v_next_status := COALESCE(NULLIF(payload->>'status',''),v_current.status);

  IF v_current.status IN ('completed','failed','cancelled')
    AND v_next_status<>v_current.status THEN
    RETURN QUERY SELECT 'terminal'::text,v_current.row_version;
    RETURN;
  END IF;

  UPDATE ccpun_admin.agent_runtime_job SET
    status=v_next_status,
    stage=COALESCE(NULLIF(payload->>'stage',''),stage),
    attempt=COALESCE(NULLIF(payload->>'attempt','')::integer,attempt),
    heartbeat_at=COALESCE(NULLIF(payload->>'heartbeat_at','')::timestamptz,heartbeat_at),
    started_at=COALESCE(NULLIF(payload->>'started_at','')::timestamptz,started_at),
    completed_at=CASE
      WHEN payload ? 'completed_at' THEN NULLIF(payload->>'completed_at','')::timestamptz
      WHEN v_next_status IN ('completed','failed','cancelled') THEN COALESCE(completed_at,now())
      ELSE completed_at
    END,
    n8n_execution_id=CASE WHEN payload ? 'n8n_execution_id' THEN NULLIF(payload->>'n8n_execution_id','') ELSE n8n_execution_id END,
    provider_reference=CASE WHEN payload ? 'provider_reference' THEN NULLIF(payload->>'provider_reference','') ELSE provider_reference END,
    error_category=CASE WHEN payload ? 'error_category' THEN NULLIF(payload->>'error_category','') ELSE error_category END,
    duration_ms=CASE WHEN payload ? 'duration_ms' THEN NULLIF(payload->>'duration_ms','')::bigint ELSE duration_ms END,
    queue_wait_ms=CASE WHEN payload ? 'queue_wait_ms' THEN NULLIF(payload->>'queue_wait_ms','')::bigint ELSE queue_wait_ms END,
    row_version=row_version+1,
    updated_at=now()
  WHERE agent_runtime_job.job_id=v_job_id
  RETURNING agent_runtime_job.row_version INTO v_next_version;

  RETURN QUERY SELECT 'updated'::text,v_next_version;
END
$agent_update$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_jobs(p_limit integer DEFAULT 50)
RETURNS TABLE(
  job_id uuid,correlation_id uuid,request_id uuid,source text,action text,workflow_key text,
  status text,stage text,queue_class text,attempt integer,max_attempts integer,
  queued_at timestamptz,started_at timestamptz,heartbeat_at timestamptz,completed_at timestamptz,
  n8n_execution_id text,provider_reference text,error_category text,duration_ms bigint,queue_wait_ms bigint,
  row_version bigint,created_at timestamptz,updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_read$
  SELECT
    j.job_id,j.correlation_id,j.request_id,j.source,j.action,j.workflow_key,j.status,j.stage,j.queue_class,
    j.attempt,j.max_attempts,j.queued_at,j.started_at,j.heartbeat_at,j.completed_at,j.n8n_execution_id,
    j.provider_reference,j.error_category,j.duration_ms,j.queue_wait_ms,j.row_version,j.created_at,j.updated_at
  FROM ccpun_admin.agent_runtime_job j
  ORDER BY j.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_read$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_duration_samples(
  p_workflow_key text,p_stage text,p_limit integer DEFAULT 50
)
RETURNS TABLE(duration_ms bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_duration$
  SELECT j.duration_ms
  FROM ccpun_admin.agent_runtime_job j
  WHERE j.workflow_key=p_workflow_key
    AND j.stage=p_stage
    AND j.status='completed'
    AND j.duration_ms IS NOT NULL
  ORDER BY j.completed_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_duration$;

REVOKE ALL PRIVILEGES ON ccpun_admin.agent_runtime_job FROM PUBLIC,ccpun_admin_runtime;
REVOKE ALL ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260924_agent_os_runtime_foundation_v1','sha256:08c3dc4dedd0c5e47b2bec67e2a9826fb3b6b1cdf66dec24b11274b7cbb479ce')
ON CONFLICT(version) DO NOTHING;

COMMIT;
),
  source text NOT NULL CHECK (source IN ('admin','shortcut','schedule','webhook','n8n','system')),
  action text NOT NULL CHECK (action ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  workflow_key text NOT NULL CHECK (workflow_key ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  status text NOT NULL CHECK (status IN (
    'queued','running','waiting_external','waiting_ai','validating','awaiting_review',
    'retrying','completed','failed','reconciliation_required','cancelled'
  )),
  stage text NOT NULL CHECK (stage ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  queue_class text NOT NULL CHECK (queue_class IN ('realtime','urgent','normal','batch')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0 AND attempt <= 20),
  max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 20),
  queued_at timestamptz,
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz,
  n8n_execution_id text CHECK (n8n_execution_id IS NULL OR length(n8n_execution_id) BETWEEN 1 AND 160),
  provider_reference text CHECK (provider_reference IS NULL OR length(provider_reference) BETWEEN 1 AND 200),
  error_category text CHECK (error_category IS NULL OR error_category ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  duration_ms bigint CHECK (duration_ms IS NULL OR duration_ms >= 0),
  queue_wait_ms bigint CHECK (queue_wait_ms IS NULL OR queue_wait_ms >= 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (attempt <= max_attempts),
  CHECK ((status IN ('completed','failed','cancelled')) = (completed_at IS NOT NULL)),
  CHECK (started_at IS NULL OR queued_at IS NULL OR started_at >= queued_at),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX IF NOT EXISTS agent_runtime_job_updated_idx
  ON ccpun_admin.agent_runtime_job(updated_at DESC);

CREATE INDEX IF NOT EXISTS agent_runtime_job_active_idx
  ON ccpun_admin.agent_runtime_job(status, queue_class, updated_at)
  WHERE status IN ('queued','running','waiting_external','waiting_ai','validating','awaiting_review','retrying','reconciliation_required');

CREATE INDEX IF NOT EXISTS agent_runtime_job_workflow_duration_idx
  ON ccpun_admin.agent_runtime_job(workflow_key, stage, completed_at DESC)
  WHERE status='completed' AND duration_ms IS NOT NULL;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_create_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, job_id uuid, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_create$
DECLARE
  v_existing ccpun_admin.agent_runtime_job%ROWTYPE;
  v_job_id uuid;
  v_idempotency text;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','correlation_id','request_id','idempotency_key','source','action','workflow_key',
      'status','stage','queue_class','attempt','max_attempts','queued_at','started_at','heartbeat_at',
      'n8n_execution_id','provider_reference'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job create payload';
  END IF;

  v_job_id := NULLIF(payload->>'job_id','')::uuid;
  v_idempotency := payload->>'idempotency_key';

  SELECT * INTO v_existing
  FROM ccpun_admin.agent_runtime_job
  WHERE idempotency_key=v_idempotency;

  IF FOUND THEN
    IF v_existing.job_id=v_job_id
      AND v_existing.correlation_id=NULLIF(payload->>'correlation_id','')::uuid
      AND v_existing.request_id=NULLIF(payload->>'request_id','')::uuid
      AND v_existing.source=payload->>'source'
      AND v_existing.action=payload->>'action'
      AND v_existing.workflow_key=payload->>'workflow_key' THEN
      RETURN QUERY SELECT 'duplicate'::text,v_existing.job_id,v_existing.row_version;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'idempotency_conflict'::text,v_existing.job_id,v_existing.row_version;
    RETURN;
  END IF;

  INSERT INTO ccpun_admin.agent_runtime_job(
    job_id,correlation_id,request_id,idempotency_key,source,action,workflow_key,status,stage,
    queue_class,attempt,max_attempts,queued_at,started_at,heartbeat_at,n8n_execution_id,provider_reference
  ) VALUES (
    v_job_id,
    NULLIF(payload->>'correlation_id','')::uuid,
    NULLIF(payload->>'request_id','')::uuid,
    v_idempotency,
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
  );

  RETURN QUERY SELECT 'created'::text,v_job_id,1::bigint;
END
$agent_create$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_update_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_update$
DECLARE
  v_job_id uuid := NULLIF(payload->>'job_id','')::uuid;
  v_expected bigint := NULLIF(payload->>'expected_version','')::bigint;
  v_current ccpun_admin.agent_runtime_job%ROWTYPE;
  v_next_status text;
  v_next_version bigint;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','expected_version','status','stage','attempt','heartbeat_at','started_at','completed_at',
      'n8n_execution_id','provider_reference','error_category','duration_ms','queue_wait_ms'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job update payload';
  END IF;

  SELECT * INTO v_current
  FROM ccpun_admin.agent_runtime_job
  WHERE agent_runtime_job.job_id=v_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text,NULL::bigint;
    RETURN;
  END IF;

  IF v_current.row_version<>v_expected THEN
    RETURN QUERY SELECT 'conflict'::text,v_current.row_version;
    RETURN;
  END IF;

  v_next_status := COALESCE(NULLIF(payload->>'status',''),v_current.status);

  IF v_current.status IN ('completed','failed','cancelled')
    AND v_next_status<>v_current.status THEN
    RETURN QUERY SELECT 'terminal'::text,v_current.row_version;
    RETURN;
  END IF;

  UPDATE ccpun_admin.agent_runtime_job SET
    status=v_next_status,
    stage=COALESCE(NULLIF(payload->>'stage',''),stage),
    attempt=COALESCE(NULLIF(payload->>'attempt','')::integer,attempt),
    heartbeat_at=COALESCE(NULLIF(payload->>'heartbeat_at','')::timestamptz,heartbeat_at),
    started_at=COALESCE(NULLIF(payload->>'started_at','')::timestamptz,started_at),
    completed_at=CASE
      WHEN payload ? 'completed_at' THEN NULLIF(payload->>'completed_at','')::timestamptz
      WHEN v_next_status IN ('completed','failed','cancelled') THEN COALESCE(completed_at,now())
      ELSE completed_at
    END,
    n8n_execution_id=CASE WHEN payload ? 'n8n_execution_id' THEN NULLIF(payload->>'n8n_execution_id','') ELSE n8n_execution_id END,
    provider_reference=CASE WHEN payload ? 'provider_reference' THEN NULLIF(payload->>'provider_reference','') ELSE provider_reference END,
    error_category=CASE WHEN payload ? 'error_category' THEN NULLIF(payload->>'error_category','') ELSE error_category END,
    duration_ms=CASE WHEN payload ? 'duration_ms' THEN NULLIF(payload->>'duration_ms','')::bigint ELSE duration_ms END,
    queue_wait_ms=CASE WHEN payload ? 'queue_wait_ms' THEN NULLIF(payload->>'queue_wait_ms','')::bigint ELSE queue_wait_ms END,
    row_version=row_version+1,
    updated_at=now()
  WHERE agent_runtime_job.job_id=v_job_id
  RETURNING agent_runtime_job.row_version INTO v_next_version;

  RETURN QUERY SELECT 'updated'::text,v_next_version;
END
$agent_update$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_jobs(p_limit integer DEFAULT 50)
RETURNS TABLE(
  job_id uuid,correlation_id uuid,request_id uuid,source text,action text,workflow_key text,
  status text,stage text,queue_class text,attempt integer,max_attempts integer,
  queued_at timestamptz,started_at timestamptz,heartbeat_at timestamptz,completed_at timestamptz,
  n8n_execution_id text,provider_reference text,error_category text,duration_ms bigint,queue_wait_ms bigint,
  row_version bigint,created_at timestamptz,updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_read$
  SELECT
    j.job_id,j.correlation_id,j.request_id,j.source,j.action,j.workflow_key,j.status,j.stage,j.queue_class,
    j.attempt,j.max_attempts,j.queued_at,j.started_at,j.heartbeat_at,j.completed_at,j.n8n_execution_id,
    j.provider_reference,j.error_category,j.duration_ms,j.queue_wait_ms,j.row_version,j.created_at,j.updated_at
  FROM ccpun_admin.agent_runtime_job j
  ORDER BY j.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_read$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_duration_samples(
  p_workflow_key text,p_stage text,p_limit integer DEFAULT 50
)
RETURNS TABLE(duration_ms bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_duration$
  SELECT j.duration_ms
  FROM ccpun_admin.agent_runtime_job j
  WHERE j.workflow_key=p_workflow_key
    AND j.stage=p_stage
    AND j.status='completed'
    AND j.duration_ms IS NOT NULL
  ORDER BY j.completed_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_duration$;

REVOKE ALL PRIVILEGES ON ccpun_admin.agent_runtime_job FROM PUBLIC,ccpun_admin_runtime;
REVOKE ALL ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260924_agent_os_runtime_foundation_v1','sha256:08c3dc4dedd0c5e47b2bec67e2a9826fb3b6b1cdf66dec24b11274b7cbb479ce')
ON CONFLICT(version) DO NOTHING;

COMMIT;
),
  attempt integer NOT NULL CHECK (attempt >= 0 AND attempt <= 20),
  error_category text CHECK (error_category IS NULL OR error_category ~ '^[a-z0-9][a-z0-9._:-]{0,159}
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_create$
DECLARE
  v_existing ccpun_admin.agent_runtime_job%ROWTYPE;
  v_job_id uuid;
  v_idempotency text;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','correlation_id','request_id','idempotency_key','source','action','workflow_key',
      'status','stage','queue_class','attempt','max_attempts','queued_at','started_at','heartbeat_at',
      'n8n_execution_id','provider_reference'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job create payload';
  END IF;

  v_job_id := NULLIF(payload->>'job_id','')::uuid;
  v_idempotency := payload->>'idempotency_key';

  SELECT * INTO v_existing
  FROM ccpun_admin.agent_runtime_job
  WHERE idempotency_key=v_idempotency;

  IF FOUND THEN
    IF v_existing.job_id=v_job_id
      AND v_existing.correlation_id=NULLIF(payload->>'correlation_id','')::uuid
      AND v_existing.request_id=NULLIF(payload->>'request_id','')::uuid
      AND v_existing.source=payload->>'source'
      AND v_existing.action=payload->>'action'
      AND v_existing.workflow_key=payload->>'workflow_key' THEN
      RETURN QUERY SELECT 'duplicate'::text,v_existing.job_id,v_existing.row_version;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'idempotency_conflict'::text,v_existing.job_id,v_existing.row_version;
    RETURN;
  END IF;

  INSERT INTO ccpun_admin.agent_runtime_job(
    job_id,correlation_id,request_id,idempotency_key,source,action,workflow_key,status,stage,
    queue_class,attempt,max_attempts,queued_at,started_at,heartbeat_at,n8n_execution_id,provider_reference
  ) VALUES (
    v_job_id,
    NULLIF(payload->>'correlation_id','')::uuid,
    NULLIF(payload->>'request_id','')::uuid,
    v_idempotency,
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
  );

  RETURN QUERY SELECT 'created'::text,v_job_id,1::bigint;
END
$agent_create$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_update_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_update$
DECLARE
  v_job_id uuid := NULLIF(payload->>'job_id','')::uuid;
  v_expected bigint := NULLIF(payload->>'expected_version','')::bigint;
  v_current ccpun_admin.agent_runtime_job%ROWTYPE;
  v_next_status text;
  v_next_version bigint;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','expected_version','status','stage','attempt','heartbeat_at','started_at','completed_at',
      'n8n_execution_id','provider_reference','error_category','duration_ms','queue_wait_ms'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job update payload';
  END IF;

  SELECT * INTO v_current
  FROM ccpun_admin.agent_runtime_job
  WHERE agent_runtime_job.job_id=v_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text,NULL::bigint;
    RETURN;
  END IF;

  IF v_current.row_version<>v_expected THEN
    RETURN QUERY SELECT 'conflict'::text,v_current.row_version;
    RETURN;
  END IF;

  v_next_status := COALESCE(NULLIF(payload->>'status',''),v_current.status);

  IF v_current.status IN ('completed','failed','cancelled')
    AND v_next_status<>v_current.status THEN
    RETURN QUERY SELECT 'terminal'::text,v_current.row_version;
    RETURN;
  END IF;

  UPDATE ccpun_admin.agent_runtime_job SET
    status=v_next_status,
    stage=COALESCE(NULLIF(payload->>'stage',''),stage),
    attempt=COALESCE(NULLIF(payload->>'attempt','')::integer,attempt),
    heartbeat_at=COALESCE(NULLIF(payload->>'heartbeat_at','')::timestamptz,heartbeat_at),
    started_at=COALESCE(NULLIF(payload->>'started_at','')::timestamptz,started_at),
    completed_at=CASE
      WHEN payload ? 'completed_at' THEN NULLIF(payload->>'completed_at','')::timestamptz
      WHEN v_next_status IN ('completed','failed','cancelled') THEN COALESCE(completed_at,now())
      ELSE completed_at
    END,
    n8n_execution_id=CASE WHEN payload ? 'n8n_execution_id' THEN NULLIF(payload->>'n8n_execution_id','') ELSE n8n_execution_id END,
    provider_reference=CASE WHEN payload ? 'provider_reference' THEN NULLIF(payload->>'provider_reference','') ELSE provider_reference END,
    error_category=CASE WHEN payload ? 'error_category' THEN NULLIF(payload->>'error_category','') ELSE error_category END,
    duration_ms=CASE WHEN payload ? 'duration_ms' THEN NULLIF(payload->>'duration_ms','')::bigint ELSE duration_ms END,
    queue_wait_ms=CASE WHEN payload ? 'queue_wait_ms' THEN NULLIF(payload->>'queue_wait_ms','')::bigint ELSE queue_wait_ms END,
    row_version=row_version+1,
    updated_at=now()
  WHERE agent_runtime_job.job_id=v_job_id
  RETURNING agent_runtime_job.row_version INTO v_next_version;

  RETURN QUERY SELECT 'updated'::text,v_next_version;
END
$agent_update$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_jobs(p_limit integer DEFAULT 50)
RETURNS TABLE(
  job_id uuid,correlation_id uuid,request_id uuid,source text,action text,workflow_key text,
  status text,stage text,queue_class text,attempt integer,max_attempts integer,
  queued_at timestamptz,started_at timestamptz,heartbeat_at timestamptz,completed_at timestamptz,
  n8n_execution_id text,provider_reference text,error_category text,duration_ms bigint,queue_wait_ms bigint,
  row_version bigint,created_at timestamptz,updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_read$
  SELECT
    j.job_id,j.correlation_id,j.request_id,j.source,j.action,j.workflow_key,j.status,j.stage,j.queue_class,
    j.attempt,j.max_attempts,j.queued_at,j.started_at,j.heartbeat_at,j.completed_at,j.n8n_execution_id,
    j.provider_reference,j.error_category,j.duration_ms,j.queue_wait_ms,j.row_version,j.created_at,j.updated_at
  FROM ccpun_admin.agent_runtime_job j
  ORDER BY j.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_read$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_duration_samples(
  p_workflow_key text,p_stage text,p_limit integer DEFAULT 50
)
RETURNS TABLE(duration_ms bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_duration$
  SELECT j.duration_ms
  FROM ccpun_admin.agent_runtime_job j
  WHERE j.workflow_key=p_workflow_key
    AND j.stage=p_stage
    AND j.status='completed'
    AND j.duration_ms IS NOT NULL
  ORDER BY j.completed_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_duration$;

REVOKE ALL PRIVILEGES ON ccpun_admin.agent_runtime_job FROM PUBLIC,ccpun_admin_runtime;
REVOKE ALL ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260924_agent_os_runtime_foundation_v1','sha256:08c3dc4dedd0c5e47b2bec67e2a9826fb3b6b1cdf66dec24b11274b7cbb479ce')
ON CONFLICT(version) DO NOTHING;

COMMIT;
),
  payload_digest_sha256 text NOT NULL CHECK (payload_digest_sha256 ~ '^[0-9a-f]{64}
  action text NOT NULL CHECK (action ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  workflow_key text NOT NULL CHECK (workflow_key ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  status text NOT NULL CHECK (status IN (
    'queued','running','waiting_external','waiting_ai','validating','awaiting_review',
    'retrying','completed','failed','reconciliation_required','cancelled'
  )),
  stage text NOT NULL CHECK (stage ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  queue_class text NOT NULL CHECK (queue_class IN ('realtime','urgent','normal','batch')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0 AND attempt <= 20),
  max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 20),
  queued_at timestamptz,
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz,
  n8n_execution_id text CHECK (n8n_execution_id IS NULL OR length(n8n_execution_id) BETWEEN 1 AND 160),
  provider_reference text CHECK (provider_reference IS NULL OR length(provider_reference) BETWEEN 1 AND 200),
  error_category text CHECK (error_category IS NULL OR error_category ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  duration_ms bigint CHECK (duration_ms IS NULL OR duration_ms >= 0),
  queue_wait_ms bigint CHECK (queue_wait_ms IS NULL OR queue_wait_ms >= 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (attempt <= max_attempts),
  CHECK ((status IN ('completed','failed','cancelled')) = (completed_at IS NOT NULL)),
  CHECK (started_at IS NULL OR queued_at IS NULL OR started_at >= queued_at),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX IF NOT EXISTS agent_runtime_job_updated_idx
  ON ccpun_admin.agent_runtime_job(updated_at DESC);

CREATE INDEX IF NOT EXISTS agent_runtime_job_active_idx
  ON ccpun_admin.agent_runtime_job(status, queue_class, updated_at)
  WHERE status IN ('queued','running','waiting_external','waiting_ai','validating','awaiting_review','retrying','reconciliation_required');

CREATE INDEX IF NOT EXISTS agent_runtime_job_workflow_duration_idx
  ON ccpun_admin.agent_runtime_job(workflow_key, stage, completed_at DESC)
  WHERE status='completed' AND duration_ms IS NOT NULL;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_create_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, job_id uuid, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_create$
DECLARE
  v_existing ccpun_admin.agent_runtime_job%ROWTYPE;
  v_job_id uuid;
  v_idempotency text;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','correlation_id','request_id','idempotency_key','source','action','workflow_key',
      'status','stage','queue_class','attempt','max_attempts','queued_at','started_at','heartbeat_at',
      'n8n_execution_id','provider_reference'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job create payload';
  END IF;

  v_job_id := NULLIF(payload->>'job_id','')::uuid;
  v_idempotency := payload->>'idempotency_key';

  SELECT * INTO v_existing
  FROM ccpun_admin.agent_runtime_job
  WHERE idempotency_key=v_idempotency;

  IF FOUND THEN
    IF v_existing.job_id=v_job_id
      AND v_existing.correlation_id=NULLIF(payload->>'correlation_id','')::uuid
      AND v_existing.request_id=NULLIF(payload->>'request_id','')::uuid
      AND v_existing.source=payload->>'source'
      AND v_existing.action=payload->>'action'
      AND v_existing.workflow_key=payload->>'workflow_key' THEN
      RETURN QUERY SELECT 'duplicate'::text,v_existing.job_id,v_existing.row_version;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'idempotency_conflict'::text,v_existing.job_id,v_existing.row_version;
    RETURN;
  END IF;

  INSERT INTO ccpun_admin.agent_runtime_job(
    job_id,correlation_id,request_id,idempotency_key,source,action,workflow_key,status,stage,
    queue_class,attempt,max_attempts,queued_at,started_at,heartbeat_at,n8n_execution_id,provider_reference
  ) VALUES (
    v_job_id,
    NULLIF(payload->>'correlation_id','')::uuid,
    NULLIF(payload->>'request_id','')::uuid,
    v_idempotency,
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
  );

  RETURN QUERY SELECT 'created'::text,v_job_id,1::bigint;
END
$agent_create$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_update_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_update$
DECLARE
  v_job_id uuid := NULLIF(payload->>'job_id','')::uuid;
  v_expected bigint := NULLIF(payload->>'expected_version','')::bigint;
  v_current ccpun_admin.agent_runtime_job%ROWTYPE;
  v_next_status text;
  v_next_version bigint;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','expected_version','status','stage','attempt','heartbeat_at','started_at','completed_at',
      'n8n_execution_id','provider_reference','error_category','duration_ms','queue_wait_ms'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job update payload';
  END IF;

  SELECT * INTO v_current
  FROM ccpun_admin.agent_runtime_job
  WHERE agent_runtime_job.job_id=v_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text,NULL::bigint;
    RETURN;
  END IF;

  IF v_current.row_version<>v_expected THEN
    RETURN QUERY SELECT 'conflict'::text,v_current.row_version;
    RETURN;
  END IF;

  v_next_status := COALESCE(NULLIF(payload->>'status',''),v_current.status);

  IF v_current.status IN ('completed','failed','cancelled')
    AND v_next_status<>v_current.status THEN
    RETURN QUERY SELECT 'terminal'::text,v_current.row_version;
    RETURN;
  END IF;

  UPDATE ccpun_admin.agent_runtime_job SET
    status=v_next_status,
    stage=COALESCE(NULLIF(payload->>'stage',''),stage),
    attempt=COALESCE(NULLIF(payload->>'attempt','')::integer,attempt),
    heartbeat_at=COALESCE(NULLIF(payload->>'heartbeat_at','')::timestamptz,heartbeat_at),
    started_at=COALESCE(NULLIF(payload->>'started_at','')::timestamptz,started_at),
    completed_at=CASE
      WHEN payload ? 'completed_at' THEN NULLIF(payload->>'completed_at','')::timestamptz
      WHEN v_next_status IN ('completed','failed','cancelled') THEN COALESCE(completed_at,now())
      ELSE completed_at
    END,
    n8n_execution_id=CASE WHEN payload ? 'n8n_execution_id' THEN NULLIF(payload->>'n8n_execution_id','') ELSE n8n_execution_id END,
    provider_reference=CASE WHEN payload ? 'provider_reference' THEN NULLIF(payload->>'provider_reference','') ELSE provider_reference END,
    error_category=CASE WHEN payload ? 'error_category' THEN NULLIF(payload->>'error_category','') ELSE error_category END,
    duration_ms=CASE WHEN payload ? 'duration_ms' THEN NULLIF(payload->>'duration_ms','')::bigint ELSE duration_ms END,
    queue_wait_ms=CASE WHEN payload ? 'queue_wait_ms' THEN NULLIF(payload->>'queue_wait_ms','')::bigint ELSE queue_wait_ms END,
    row_version=row_version+1,
    updated_at=now()
  WHERE agent_runtime_job.job_id=v_job_id
  RETURNING agent_runtime_job.row_version INTO v_next_version;

  RETURN QUERY SELECT 'updated'::text,v_next_version;
END
$agent_update$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_jobs(p_limit integer DEFAULT 50)
RETURNS TABLE(
  job_id uuid,correlation_id uuid,request_id uuid,source text,action text,workflow_key text,
  status text,stage text,queue_class text,attempt integer,max_attempts integer,
  queued_at timestamptz,started_at timestamptz,heartbeat_at timestamptz,completed_at timestamptz,
  n8n_execution_id text,provider_reference text,error_category text,duration_ms bigint,queue_wait_ms bigint,
  row_version bigint,created_at timestamptz,updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_read$
  SELECT
    j.job_id,j.correlation_id,j.request_id,j.source,j.action,j.workflow_key,j.status,j.stage,j.queue_class,
    j.attempt,j.max_attempts,j.queued_at,j.started_at,j.heartbeat_at,j.completed_at,j.n8n_execution_id,
    j.provider_reference,j.error_category,j.duration_ms,j.queue_wait_ms,j.row_version,j.created_at,j.updated_at
  FROM ccpun_admin.agent_runtime_job j
  ORDER BY j.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_read$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_duration_samples(
  p_workflow_key text,p_stage text,p_limit integer DEFAULT 50
)
RETURNS TABLE(duration_ms bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_duration$
  SELECT j.duration_ms
  FROM ccpun_admin.agent_runtime_job j
  WHERE j.workflow_key=p_workflow_key
    AND j.stage=p_stage
    AND j.status='completed'
    AND j.duration_ms IS NOT NULL
  ORDER BY j.completed_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_duration$;

REVOKE ALL PRIVILEGES ON ccpun_admin.agent_runtime_job FROM PUBLIC,ccpun_admin_runtime;
REVOKE ALL ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260924_agent_os_runtime_foundation_v1','sha256:08c3dc4dedd0c5e47b2bec67e2a9826fb3b6b1cdf66dec24b11274b7cbb479ce')
ON CONFLICT(version) DO NOTHING;

COMMIT;
),
  source text NOT NULL CHECK (source IN ('admin','shortcut','schedule','webhook','n8n','system')),
  action text NOT NULL CHECK (action ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  workflow_key text NOT NULL CHECK (workflow_key ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  status text NOT NULL CHECK (status IN (
    'queued','running','waiting_external','waiting_ai','validating','awaiting_review',
    'retrying','completed','failed','reconciliation_required','cancelled'
  )),
  stage text NOT NULL CHECK (stage ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  queue_class text NOT NULL CHECK (queue_class IN ('realtime','urgent','normal','batch')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0 AND attempt <= 20),
  max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 20),
  queued_at timestamptz,
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz,
  n8n_execution_id text CHECK (n8n_execution_id IS NULL OR length(n8n_execution_id) BETWEEN 1 AND 160),
  provider_reference text CHECK (provider_reference IS NULL OR length(provider_reference) BETWEEN 1 AND 200),
  error_category text CHECK (error_category IS NULL OR error_category ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  duration_ms bigint CHECK (duration_ms IS NULL OR duration_ms >= 0),
  queue_wait_ms bigint CHECK (queue_wait_ms IS NULL OR queue_wait_ms >= 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (attempt <= max_attempts),
  CHECK ((status IN ('completed','failed','cancelled')) = (completed_at IS NOT NULL)),
  CHECK (started_at IS NULL OR queued_at IS NULL OR started_at >= queued_at),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX IF NOT EXISTS agent_runtime_job_updated_idx
  ON ccpun_admin.agent_runtime_job(updated_at DESC);

CREATE INDEX IF NOT EXISTS agent_runtime_job_active_idx
  ON ccpun_admin.agent_runtime_job(status, queue_class, updated_at)
  WHERE status IN ('queued','running','waiting_external','waiting_ai','validating','awaiting_review','retrying','reconciliation_required');

CREATE INDEX IF NOT EXISTS agent_runtime_job_workflow_duration_idx
  ON ccpun_admin.agent_runtime_job(workflow_key, stage, completed_at DESC)
  WHERE status='completed' AND duration_ms IS NOT NULL;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_create_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, job_id uuid, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_create$
DECLARE
  v_existing ccpun_admin.agent_runtime_job%ROWTYPE;
  v_job_id uuid;
  v_idempotency text;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','correlation_id','request_id','idempotency_key','source','action','workflow_key',
      'status','stage','queue_class','attempt','max_attempts','queued_at','started_at','heartbeat_at',
      'n8n_execution_id','provider_reference'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job create payload';
  END IF;

  v_job_id := NULLIF(payload->>'job_id','')::uuid;
  v_idempotency := payload->>'idempotency_key';

  SELECT * INTO v_existing
  FROM ccpun_admin.agent_runtime_job
  WHERE idempotency_key=v_idempotency;

  IF FOUND THEN
    IF v_existing.job_id=v_job_id
      AND v_existing.correlation_id=NULLIF(payload->>'correlation_id','')::uuid
      AND v_existing.request_id=NULLIF(payload->>'request_id','')::uuid
      AND v_existing.source=payload->>'source'
      AND v_existing.action=payload->>'action'
      AND v_existing.workflow_key=payload->>'workflow_key' THEN
      RETURN QUERY SELECT 'duplicate'::text,v_existing.job_id,v_existing.row_version;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'idempotency_conflict'::text,v_existing.job_id,v_existing.row_version;
    RETURN;
  END IF;

  INSERT INTO ccpun_admin.agent_runtime_job(
    job_id,correlation_id,request_id,idempotency_key,source,action,workflow_key,status,stage,
    queue_class,attempt,max_attempts,queued_at,started_at,heartbeat_at,n8n_execution_id,provider_reference
  ) VALUES (
    v_job_id,
    NULLIF(payload->>'correlation_id','')::uuid,
    NULLIF(payload->>'request_id','')::uuid,
    v_idempotency,
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
  );

  RETURN QUERY SELECT 'created'::text,v_job_id,1::bigint;
END
$agent_create$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_update_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_update$
DECLARE
  v_job_id uuid := NULLIF(payload->>'job_id','')::uuid;
  v_expected bigint := NULLIF(payload->>'expected_version','')::bigint;
  v_current ccpun_admin.agent_runtime_job%ROWTYPE;
  v_next_status text;
  v_next_version bigint;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','expected_version','status','stage','attempt','heartbeat_at','started_at','completed_at',
      'n8n_execution_id','provider_reference','error_category','duration_ms','queue_wait_ms'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job update payload';
  END IF;

  SELECT * INTO v_current
  FROM ccpun_admin.agent_runtime_job
  WHERE agent_runtime_job.job_id=v_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text,NULL::bigint;
    RETURN;
  END IF;

  IF v_current.row_version<>v_expected THEN
    RETURN QUERY SELECT 'conflict'::text,v_current.row_version;
    RETURN;
  END IF;

  v_next_status := COALESCE(NULLIF(payload->>'status',''),v_current.status);

  IF v_current.status IN ('completed','failed','cancelled')
    AND v_next_status<>v_current.status THEN
    RETURN QUERY SELECT 'terminal'::text,v_current.row_version;
    RETURN;
  END IF;

  UPDATE ccpun_admin.agent_runtime_job SET
    status=v_next_status,
    stage=COALESCE(NULLIF(payload->>'stage',''),stage),
    attempt=COALESCE(NULLIF(payload->>'attempt','')::integer,attempt),
    heartbeat_at=COALESCE(NULLIF(payload->>'heartbeat_at','')::timestamptz,heartbeat_at),
    started_at=COALESCE(NULLIF(payload->>'started_at','')::timestamptz,started_at),
    completed_at=CASE
      WHEN payload ? 'completed_at' THEN NULLIF(payload->>'completed_at','')::timestamptz
      WHEN v_next_status IN ('completed','failed','cancelled') THEN COALESCE(completed_at,now())
      ELSE completed_at
    END,
    n8n_execution_id=CASE WHEN payload ? 'n8n_execution_id' THEN NULLIF(payload->>'n8n_execution_id','') ELSE n8n_execution_id END,
    provider_reference=CASE WHEN payload ? 'provider_reference' THEN NULLIF(payload->>'provider_reference','') ELSE provider_reference END,
    error_category=CASE WHEN payload ? 'error_category' THEN NULLIF(payload->>'error_category','') ELSE error_category END,
    duration_ms=CASE WHEN payload ? 'duration_ms' THEN NULLIF(payload->>'duration_ms','')::bigint ELSE duration_ms END,
    queue_wait_ms=CASE WHEN payload ? 'queue_wait_ms' THEN NULLIF(payload->>'queue_wait_ms','')::bigint ELSE queue_wait_ms END,
    row_version=row_version+1,
    updated_at=now()
  WHERE agent_runtime_job.job_id=v_job_id
  RETURNING agent_runtime_job.row_version INTO v_next_version;

  RETURN QUERY SELECT 'updated'::text,v_next_version;
END
$agent_update$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_jobs(p_limit integer DEFAULT 50)
RETURNS TABLE(
  job_id uuid,correlation_id uuid,request_id uuid,source text,action text,workflow_key text,
  status text,stage text,queue_class text,attempt integer,max_attempts integer,
  queued_at timestamptz,started_at timestamptz,heartbeat_at timestamptz,completed_at timestamptz,
  n8n_execution_id text,provider_reference text,error_category text,duration_ms bigint,queue_wait_ms bigint,
  row_version bigint,created_at timestamptz,updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_read$
  SELECT
    j.job_id,j.correlation_id,j.request_id,j.source,j.action,j.workflow_key,j.status,j.stage,j.queue_class,
    j.attempt,j.max_attempts,j.queued_at,j.started_at,j.heartbeat_at,j.completed_at,j.n8n_execution_id,
    j.provider_reference,j.error_category,j.duration_ms,j.queue_wait_ms,j.row_version,j.created_at,j.updated_at
  FROM ccpun_admin.agent_runtime_job j
  ORDER BY j.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_read$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_duration_samples(
  p_workflow_key text,p_stage text,p_limit integer DEFAULT 50
)
RETURNS TABLE(duration_ms bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_duration$
  SELECT j.duration_ms
  FROM ccpun_admin.agent_runtime_job j
  WHERE j.workflow_key=p_workflow_key
    AND j.stage=p_stage
    AND j.status='completed'
    AND j.duration_ms IS NOT NULL
  ORDER BY j.completed_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_duration$;

REVOKE ALL PRIVILEGES ON ccpun_admin.agent_runtime_job FROM PUBLIC,ccpun_admin_runtime;
REVOKE ALL ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260924_agent_os_runtime_foundation_v1','sha256:08c3dc4dedd0c5e47b2bec67e2a9826fb3b6b1cdf66dec24b11274b7cbb479ce')
ON CONFLICT(version) DO NOTHING;

COMMIT;
),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id,row_version)
);

CREATE INDEX IF NOT EXISTS agent_runtime_job_event_timeline_idx
  ON ccpun_admin.agent_runtime_job_event(job_id,occurred_at DESC);

CREATE OR REPLACE FUNCTION ccpun_admin.admin_create_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, job_id uuid, correlation_id uuid, request_id uuid, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_create$
DECLARE
  v_existing ccpun_admin.agent_runtime_job%ROWTYPE;
  v_job_id uuid;
  v_idempotency text;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','correlation_id','request_id','idempotency_key','source','action','workflow_key',
      'status','stage','queue_class','attempt','max_attempts','queued_at','started_at','heartbeat_at',
      'n8n_execution_id','provider_reference'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job create payload';
  END IF;

  v_job_id := NULLIF(payload->>'job_id','')::uuid;
  v_idempotency := payload->>'idempotency_key';

  SELECT * INTO v_existing
  FROM ccpun_admin.agent_runtime_job
  WHERE idempotency_key=v_idempotency;

  IF FOUND THEN
    IF v_existing.job_id=v_job_id
      AND v_existing.correlation_id=NULLIF(payload->>'correlation_id','')::uuid
      AND v_existing.request_id=NULLIF(payload->>'request_id','')::uuid
      AND v_existing.source=payload->>'source'
      AND v_existing.action=payload->>'action'
      AND v_existing.workflow_key=payload->>'workflow_key' THEN
      RETURN QUERY SELECT 'duplicate'::text,v_existing.job_id,v_existing.row_version;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'idempotency_conflict'::text,v_existing.job_id,v_existing.row_version;
    RETURN;
  END IF;

  INSERT INTO ccpun_admin.agent_runtime_job(
    job_id,correlation_id,request_id,idempotency_key,source,action,workflow_key,status,stage,
    queue_class,attempt,max_attempts,queued_at,started_at,heartbeat_at,n8n_execution_id,provider_reference
  ) VALUES (
    v_job_id,
    NULLIF(payload->>'correlation_id','')::uuid,
    NULLIF(payload->>'request_id','')::uuid,
    v_idempotency,
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
  );

  RETURN QUERY SELECT 'created'::text,v_job_id,1::bigint;
END
$agent_create$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_update_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_update$
DECLARE
  v_job_id uuid := NULLIF(payload->>'job_id','')::uuid;
  v_expected bigint := NULLIF(payload->>'expected_version','')::bigint;
  v_current ccpun_admin.agent_runtime_job%ROWTYPE;
  v_next_status text;
  v_next_version bigint;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','expected_version','status','stage','attempt','heartbeat_at','started_at','completed_at',
      'n8n_execution_id','provider_reference','error_category','duration_ms','queue_wait_ms'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job update payload';
  END IF;

  SELECT * INTO v_current
  FROM ccpun_admin.agent_runtime_job
  WHERE agent_runtime_job.job_id=v_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text,NULL::bigint;
    RETURN;
  END IF;

  IF v_current.row_version<>v_expected THEN
    RETURN QUERY SELECT 'conflict'::text,v_current.row_version;
    RETURN;
  END IF;

  v_next_status := COALESCE(NULLIF(payload->>'status',''),v_current.status);

  IF v_current.status IN ('completed','failed','cancelled')
    AND v_next_status<>v_current.status THEN
    RETURN QUERY SELECT 'terminal'::text,v_current.row_version;
    RETURN;
  END IF;

  UPDATE ccpun_admin.agent_runtime_job SET
    status=v_next_status,
    stage=COALESCE(NULLIF(payload->>'stage',''),stage),
    attempt=COALESCE(NULLIF(payload->>'attempt','')::integer,attempt),
    heartbeat_at=COALESCE(NULLIF(payload->>'heartbeat_at','')::timestamptz,heartbeat_at),
    started_at=COALESCE(NULLIF(payload->>'started_at','')::timestamptz,started_at),
    completed_at=CASE
      WHEN payload ? 'completed_at' THEN NULLIF(payload->>'completed_at','')::timestamptz
      WHEN v_next_status IN ('completed','failed','cancelled') THEN COALESCE(completed_at,now())
      ELSE completed_at
    END,
    n8n_execution_id=CASE WHEN payload ? 'n8n_execution_id' THEN NULLIF(payload->>'n8n_execution_id','') ELSE n8n_execution_id END,
    provider_reference=CASE WHEN payload ? 'provider_reference' THEN NULLIF(payload->>'provider_reference','') ELSE provider_reference END,
    error_category=CASE WHEN payload ? 'error_category' THEN NULLIF(payload->>'error_category','') ELSE error_category END,
    duration_ms=CASE WHEN payload ? 'duration_ms' THEN NULLIF(payload->>'duration_ms','')::bigint ELSE duration_ms END,
    queue_wait_ms=CASE WHEN payload ? 'queue_wait_ms' THEN NULLIF(payload->>'queue_wait_ms','')::bigint ELSE queue_wait_ms END,
    row_version=row_version+1,
    updated_at=now()
  WHERE agent_runtime_job.job_id=v_job_id
  RETURNING agent_runtime_job.row_version INTO v_next_version;

  RETURN QUERY SELECT 'updated'::text,v_next_version;
END
$agent_update$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_jobs(p_limit integer DEFAULT 50)
RETURNS TABLE(
  job_id uuid,correlation_id uuid,request_id uuid,source text,action text,workflow_key text,
  status text,stage text,queue_class text,attempt integer,max_attempts integer,
  queued_at timestamptz,started_at timestamptz,heartbeat_at timestamptz,completed_at timestamptz,
  n8n_execution_id text,provider_reference text,error_category text,duration_ms bigint,queue_wait_ms bigint,
  row_version bigint,created_at timestamptz,updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_read$
  SELECT
    j.job_id,j.correlation_id,j.request_id,j.source,j.action,j.workflow_key,j.status,j.stage,j.queue_class,
    j.attempt,j.max_attempts,j.queued_at,j.started_at,j.heartbeat_at,j.completed_at,j.n8n_execution_id,
    j.provider_reference,j.error_category,j.duration_ms,j.queue_wait_ms,j.row_version,j.created_at,j.updated_at
  FROM ccpun_admin.agent_runtime_job j
  ORDER BY j.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_read$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_duration_samples(
  p_workflow_key text,p_stage text,p_limit integer DEFAULT 50
)
RETURNS TABLE(duration_ms bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_duration$
  SELECT j.duration_ms
  FROM ccpun_admin.agent_runtime_job j
  WHERE j.workflow_key=p_workflow_key
    AND j.stage=p_stage
    AND j.status='completed'
    AND j.duration_ms IS NOT NULL
  ORDER BY j.completed_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_duration$;

REVOKE ALL PRIVILEGES ON ccpun_admin.agent_runtime_job FROM PUBLIC,ccpun_admin_runtime;
REVOKE ALL ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260924_agent_os_runtime_foundation_v1','sha256:08c3dc4dedd0c5e47b2bec67e2a9826fb3b6b1cdf66dec24b11274b7cbb479ce')
ON CONFLICT(version) DO NOTHING;

COMMIT;
),
  payload_digest_sha256 text NOT NULL CHECK (payload_digest_sha256 ~ '^[0-9a-f]{64}
  action text NOT NULL CHECK (action ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  workflow_key text NOT NULL CHECK (workflow_key ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  status text NOT NULL CHECK (status IN (
    'queued','running','waiting_external','waiting_ai','validating','awaiting_review',
    'retrying','completed','failed','reconciliation_required','cancelled'
  )),
  stage text NOT NULL CHECK (stage ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  queue_class text NOT NULL CHECK (queue_class IN ('realtime','urgent','normal','batch')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0 AND attempt <= 20),
  max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 20),
  queued_at timestamptz,
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz,
  n8n_execution_id text CHECK (n8n_execution_id IS NULL OR length(n8n_execution_id) BETWEEN 1 AND 160),
  provider_reference text CHECK (provider_reference IS NULL OR length(provider_reference) BETWEEN 1 AND 200),
  error_category text CHECK (error_category IS NULL OR error_category ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  duration_ms bigint CHECK (duration_ms IS NULL OR duration_ms >= 0),
  queue_wait_ms bigint CHECK (queue_wait_ms IS NULL OR queue_wait_ms >= 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (attempt <= max_attempts),
  CHECK ((status IN ('completed','failed','cancelled')) = (completed_at IS NOT NULL)),
  CHECK (started_at IS NULL OR queued_at IS NULL OR started_at >= queued_at),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX IF NOT EXISTS agent_runtime_job_updated_idx
  ON ccpun_admin.agent_runtime_job(updated_at DESC);

CREATE INDEX IF NOT EXISTS agent_runtime_job_active_idx
  ON ccpun_admin.agent_runtime_job(status, queue_class, updated_at)
  WHERE status IN ('queued','running','waiting_external','waiting_ai','validating','awaiting_review','retrying','reconciliation_required');

CREATE INDEX IF NOT EXISTS agent_runtime_job_workflow_duration_idx
  ON ccpun_admin.agent_runtime_job(workflow_key, stage, completed_at DESC)
  WHERE status='completed' AND duration_ms IS NOT NULL;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_create_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, job_id uuid, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_create$
DECLARE
  v_existing ccpun_admin.agent_runtime_job%ROWTYPE;
  v_job_id uuid;
  v_idempotency text;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','correlation_id','request_id','idempotency_key','source','action','workflow_key',
      'status','stage','queue_class','attempt','max_attempts','queued_at','started_at','heartbeat_at',
      'n8n_execution_id','provider_reference'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job create payload';
  END IF;

  v_job_id := NULLIF(payload->>'job_id','')::uuid;
  v_idempotency := payload->>'idempotency_key';

  SELECT * INTO v_existing
  FROM ccpun_admin.agent_runtime_job
  WHERE idempotency_key=v_idempotency;

  IF FOUND THEN
    IF v_existing.job_id=v_job_id
      AND v_existing.correlation_id=NULLIF(payload->>'correlation_id','')::uuid
      AND v_existing.request_id=NULLIF(payload->>'request_id','')::uuid
      AND v_existing.source=payload->>'source'
      AND v_existing.action=payload->>'action'
      AND v_existing.workflow_key=payload->>'workflow_key' THEN
      RETURN QUERY SELECT 'duplicate'::text,v_existing.job_id,v_existing.row_version;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'idempotency_conflict'::text,v_existing.job_id,v_existing.row_version;
    RETURN;
  END IF;

  INSERT INTO ccpun_admin.agent_runtime_job(
    job_id,correlation_id,request_id,idempotency_key,source,action,workflow_key,status,stage,
    queue_class,attempt,max_attempts,queued_at,started_at,heartbeat_at,n8n_execution_id,provider_reference
  ) VALUES (
    v_job_id,
    NULLIF(payload->>'correlation_id','')::uuid,
    NULLIF(payload->>'request_id','')::uuid,
    v_idempotency,
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
  );

  RETURN QUERY SELECT 'created'::text,v_job_id,1::bigint;
END
$agent_create$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_update_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_update$
DECLARE
  v_job_id uuid := NULLIF(payload->>'job_id','')::uuid;
  v_expected bigint := NULLIF(payload->>'expected_version','')::bigint;
  v_current ccpun_admin.agent_runtime_job%ROWTYPE;
  v_next_status text;
  v_next_version bigint;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','expected_version','status','stage','attempt','heartbeat_at','started_at','completed_at',
      'n8n_execution_id','provider_reference','error_category','duration_ms','queue_wait_ms'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job update payload';
  END IF;

  SELECT * INTO v_current
  FROM ccpun_admin.agent_runtime_job
  WHERE agent_runtime_job.job_id=v_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text,NULL::bigint;
    RETURN;
  END IF;

  IF v_current.row_version<>v_expected THEN
    RETURN QUERY SELECT 'conflict'::text,v_current.row_version;
    RETURN;
  END IF;

  v_next_status := COALESCE(NULLIF(payload->>'status',''),v_current.status);

  IF v_current.status IN ('completed','failed','cancelled')
    AND v_next_status<>v_current.status THEN
    RETURN QUERY SELECT 'terminal'::text,v_current.row_version;
    RETURN;
  END IF;

  UPDATE ccpun_admin.agent_runtime_job SET
    status=v_next_status,
    stage=COALESCE(NULLIF(payload->>'stage',''),stage),
    attempt=COALESCE(NULLIF(payload->>'attempt','')::integer,attempt),
    heartbeat_at=COALESCE(NULLIF(payload->>'heartbeat_at','')::timestamptz,heartbeat_at),
    started_at=COALESCE(NULLIF(payload->>'started_at','')::timestamptz,started_at),
    completed_at=CASE
      WHEN payload ? 'completed_at' THEN NULLIF(payload->>'completed_at','')::timestamptz
      WHEN v_next_status IN ('completed','failed','cancelled') THEN COALESCE(completed_at,now())
      ELSE completed_at
    END,
    n8n_execution_id=CASE WHEN payload ? 'n8n_execution_id' THEN NULLIF(payload->>'n8n_execution_id','') ELSE n8n_execution_id END,
    provider_reference=CASE WHEN payload ? 'provider_reference' THEN NULLIF(payload->>'provider_reference','') ELSE provider_reference END,
    error_category=CASE WHEN payload ? 'error_category' THEN NULLIF(payload->>'error_category','') ELSE error_category END,
    duration_ms=CASE WHEN payload ? 'duration_ms' THEN NULLIF(payload->>'duration_ms','')::bigint ELSE duration_ms END,
    queue_wait_ms=CASE WHEN payload ? 'queue_wait_ms' THEN NULLIF(payload->>'queue_wait_ms','')::bigint ELSE queue_wait_ms END,
    row_version=row_version+1,
    updated_at=now()
  WHERE agent_runtime_job.job_id=v_job_id
  RETURNING agent_runtime_job.row_version INTO v_next_version;

  RETURN QUERY SELECT 'updated'::text,v_next_version;
END
$agent_update$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_jobs(p_limit integer DEFAULT 50)
RETURNS TABLE(
  job_id uuid,correlation_id uuid,request_id uuid,source text,action text,workflow_key text,
  status text,stage text,queue_class text,attempt integer,max_attempts integer,
  queued_at timestamptz,started_at timestamptz,heartbeat_at timestamptz,completed_at timestamptz,
  n8n_execution_id text,provider_reference text,error_category text,duration_ms bigint,queue_wait_ms bigint,
  row_version bigint,created_at timestamptz,updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_read$
  SELECT
    j.job_id,j.correlation_id,j.request_id,j.source,j.action,j.workflow_key,j.status,j.stage,j.queue_class,
    j.attempt,j.max_attempts,j.queued_at,j.started_at,j.heartbeat_at,j.completed_at,j.n8n_execution_id,
    j.provider_reference,j.error_category,j.duration_ms,j.queue_wait_ms,j.row_version,j.created_at,j.updated_at
  FROM ccpun_admin.agent_runtime_job j
  ORDER BY j.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_read$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_duration_samples(
  p_workflow_key text,p_stage text,p_limit integer DEFAULT 50
)
RETURNS TABLE(duration_ms bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_duration$
  SELECT j.duration_ms
  FROM ccpun_admin.agent_runtime_job j
  WHERE j.workflow_key=p_workflow_key
    AND j.stage=p_stage
    AND j.status='completed'
    AND j.duration_ms IS NOT NULL
  ORDER BY j.completed_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_duration$;

REVOKE ALL PRIVILEGES ON ccpun_admin.agent_runtime_job FROM PUBLIC,ccpun_admin_runtime;
REVOKE ALL ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260924_agent_os_runtime_foundation_v1','sha256:08c3dc4dedd0c5e47b2bec67e2a9826fb3b6b1cdf66dec24b11274b7cbb479ce')
ON CONFLICT(version) DO NOTHING;

COMMIT;
),
  source text NOT NULL CHECK (source IN ('admin','shortcut','schedule','webhook','n8n','system')),
  action text NOT NULL CHECK (action ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  workflow_key text NOT NULL CHECK (workflow_key ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  status text NOT NULL CHECK (status IN (
    'queued','running','waiting_external','waiting_ai','validating','awaiting_review',
    'retrying','completed','failed','reconciliation_required','cancelled'
  )),
  stage text NOT NULL CHECK (stage ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  queue_class text NOT NULL CHECK (queue_class IN ('realtime','urgent','normal','batch')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0 AND attempt <= 20),
  max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 20),
  queued_at timestamptz,
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz,
  n8n_execution_id text CHECK (n8n_execution_id IS NULL OR length(n8n_execution_id) BETWEEN 1 AND 160),
  provider_reference text CHECK (provider_reference IS NULL OR length(provider_reference) BETWEEN 1 AND 200),
  error_category text CHECK (error_category IS NULL OR error_category ~ '^[a-z0-9][a-z0-9._:-]{0,159}$'),
  duration_ms bigint CHECK (duration_ms IS NULL OR duration_ms >= 0),
  queue_wait_ms bigint CHECK (queue_wait_ms IS NULL OR queue_wait_ms >= 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (attempt <= max_attempts),
  CHECK ((status IN ('completed','failed','cancelled')) = (completed_at IS NOT NULL)),
  CHECK (started_at IS NULL OR queued_at IS NULL OR started_at >= queued_at),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX IF NOT EXISTS agent_runtime_job_updated_idx
  ON ccpun_admin.agent_runtime_job(updated_at DESC);

CREATE INDEX IF NOT EXISTS agent_runtime_job_active_idx
  ON ccpun_admin.agent_runtime_job(status, queue_class, updated_at)
  WHERE status IN ('queued','running','waiting_external','waiting_ai','validating','awaiting_review','retrying','reconciliation_required');

CREATE INDEX IF NOT EXISTS agent_runtime_job_workflow_duration_idx
  ON ccpun_admin.agent_runtime_job(workflow_key, stage, completed_at DESC)
  WHERE status='completed' AND duration_ms IS NOT NULL;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_create_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, job_id uuid, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_create$
DECLARE
  v_existing ccpun_admin.agent_runtime_job%ROWTYPE;
  v_job_id uuid;
  v_idempotency text;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','correlation_id','request_id','idempotency_key','source','action','workflow_key',
      'status','stage','queue_class','attempt','max_attempts','queued_at','started_at','heartbeat_at',
      'n8n_execution_id','provider_reference'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job create payload';
  END IF;

  v_job_id := NULLIF(payload->>'job_id','')::uuid;
  v_idempotency := payload->>'idempotency_key';

  SELECT * INTO v_existing
  FROM ccpun_admin.agent_runtime_job
  WHERE idempotency_key=v_idempotency;

  IF FOUND THEN
    IF v_existing.job_id=v_job_id
      AND v_existing.correlation_id=NULLIF(payload->>'correlation_id','')::uuid
      AND v_existing.request_id=NULLIF(payload->>'request_id','')::uuid
      AND v_existing.source=payload->>'source'
      AND v_existing.action=payload->>'action'
      AND v_existing.workflow_key=payload->>'workflow_key' THEN
      RETURN QUERY SELECT 'duplicate'::text,v_existing.job_id,v_existing.row_version;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'idempotency_conflict'::text,v_existing.job_id,v_existing.row_version;
    RETURN;
  END IF;

  INSERT INTO ccpun_admin.agent_runtime_job(
    job_id,correlation_id,request_id,idempotency_key,source,action,workflow_key,status,stage,
    queue_class,attempt,max_attempts,queued_at,started_at,heartbeat_at,n8n_execution_id,provider_reference
  ) VALUES (
    v_job_id,
    NULLIF(payload->>'correlation_id','')::uuid,
    NULLIF(payload->>'request_id','')::uuid,
    v_idempotency,
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
  );

  RETURN QUERY SELECT 'created'::text,v_job_id,1::bigint;
END
$agent_create$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_update_agent_runtime_job(payload jsonb)
RETURNS TABLE(outcome text, row_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_update$
DECLARE
  v_job_id uuid := NULLIF(payload->>'job_id','')::uuid;
  v_expected bigint := NULLIF(payload->>'expected_version','')::bigint;
  v_current ccpun_admin.agent_runtime_job%ROWTYPE;
  v_next_status text;
  v_next_version bigint;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
    OR payload - ARRAY[
      'job_id','expected_version','status','stage','attempt','heartbeat_at','started_at','completed_at',
      'n8n_execution_id','provider_reference','error_category','duration_ms','queue_wait_ms'
    ]::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsafe agent job update payload';
  END IF;

  SELECT * INTO v_current
  FROM ccpun_admin.agent_runtime_job
  WHERE agent_runtime_job.job_id=v_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text,NULL::bigint;
    RETURN;
  END IF;

  IF v_current.row_version<>v_expected THEN
    RETURN QUERY SELECT 'conflict'::text,v_current.row_version;
    RETURN;
  END IF;

  v_next_status := COALESCE(NULLIF(payload->>'status',''),v_current.status);

  IF v_current.status IN ('completed','failed','cancelled')
    AND v_next_status<>v_current.status THEN
    RETURN QUERY SELECT 'terminal'::text,v_current.row_version;
    RETURN;
  END IF;

  UPDATE ccpun_admin.agent_runtime_job SET
    status=v_next_status,
    stage=COALESCE(NULLIF(payload->>'stage',''),stage),
    attempt=COALESCE(NULLIF(payload->>'attempt','')::integer,attempt),
    heartbeat_at=COALESCE(NULLIF(payload->>'heartbeat_at','')::timestamptz,heartbeat_at),
    started_at=COALESCE(NULLIF(payload->>'started_at','')::timestamptz,started_at),
    completed_at=CASE
      WHEN payload ? 'completed_at' THEN NULLIF(payload->>'completed_at','')::timestamptz
      WHEN v_next_status IN ('completed','failed','cancelled') THEN COALESCE(completed_at,now())
      ELSE completed_at
    END,
    n8n_execution_id=CASE WHEN payload ? 'n8n_execution_id' THEN NULLIF(payload->>'n8n_execution_id','') ELSE n8n_execution_id END,
    provider_reference=CASE WHEN payload ? 'provider_reference' THEN NULLIF(payload->>'provider_reference','') ELSE provider_reference END,
    error_category=CASE WHEN payload ? 'error_category' THEN NULLIF(payload->>'error_category','') ELSE error_category END,
    duration_ms=CASE WHEN payload ? 'duration_ms' THEN NULLIF(payload->>'duration_ms','')::bigint ELSE duration_ms END,
    queue_wait_ms=CASE WHEN payload ? 'queue_wait_ms' THEN NULLIF(payload->>'queue_wait_ms','')::bigint ELSE queue_wait_ms END,
    row_version=row_version+1,
    updated_at=now()
  WHERE agent_runtime_job.job_id=v_job_id
  RETURNING agent_runtime_job.row_version INTO v_next_version;

  RETURN QUERY SELECT 'updated'::text,v_next_version;
END
$agent_update$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_jobs(p_limit integer DEFAULT 50)
RETURNS TABLE(
  job_id uuid,correlation_id uuid,request_id uuid,source text,action text,workflow_key text,
  status text,stage text,queue_class text,attempt integer,max_attempts integer,
  queued_at timestamptz,started_at timestamptz,heartbeat_at timestamptz,completed_at timestamptz,
  n8n_execution_id text,provider_reference text,error_category text,duration_ms bigint,queue_wait_ms bigint,
  row_version bigint,created_at timestamptz,updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_read$
  SELECT
    j.job_id,j.correlation_id,j.request_id,j.source,j.action,j.workflow_key,j.status,j.stage,j.queue_class,
    j.attempt,j.max_attempts,j.queued_at,j.started_at,j.heartbeat_at,j.completed_at,j.n8n_execution_id,
    j.provider_reference,j.error_category,j.duration_ms,j.queue_wait_ms,j.row_version,j.created_at,j.updated_at
  FROM ccpun_admin.agent_runtime_job j
  ORDER BY j.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_read$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_duration_samples(
  p_workflow_key text,p_stage text,p_limit integer DEFAULT 50
)
RETURNS TABLE(duration_ms bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_duration$
  SELECT j.duration_ms
  FROM ccpun_admin.agent_runtime_job j
  WHERE j.workflow_key=p_workflow_key
    AND j.stage=p_stage
    AND j.status='completed'
    AND j.duration_ms IS NOT NULL
  ORDER BY j.completed_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)
$agent_duration$;

REVOKE ALL PRIVILEGES ON ccpun_admin.agent_runtime_job FROM PUBLIC,ccpun_admin_runtime;
REVOKE ALL ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  ccpun_admin.admin_create_agent_runtime_job(jsonb),
  ccpun_admin.admin_update_agent_runtime_job(jsonb),
  ccpun_admin.admin_read_agent_runtime_jobs(integer),
  ccpun_admin.admin_read_agent_runtime_duration_samples(text,text,integer)
TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260924_agent_os_runtime_foundation_v1','sha256:08c3dc4dedd0c5e47b2bec67e2a9826fb3b6b1cdf66dec24b11274b7cbb479ce')
ON CONFLICT(version) DO NOTHING;

COMMIT;

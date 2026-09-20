BEGIN;
SET LOCAL lock_timeout = '5s';

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ccpun_admin.local_ai_identity
    WHERE singleton=true
      AND lane IN ('uat','production')
      AND migration_version='20260919_local_ai_control_plane_v1'
      AND migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6'
  ) THEN
    RAISE EXCEPTION 'LOCAL_AI_V1_IDENTITY_MISMATCH';
  END IF;
END
$guard$;

ALTER TABLE ccpun_admin.local_ai_job ADD COLUMN IF NOT EXISTS queue_class text;
ALTER TABLE ccpun_admin.local_ai_job ADD COLUMN IF NOT EXISTS deadline_at timestamptz;
ALTER TABLE ccpun_admin.local_ai_job ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
ALTER TABLE ccpun_admin.local_ai_job ADD COLUMN IF NOT EXISTS request_fingerprint text;
ALTER TABLE ccpun_admin.local_ai_job ADD COLUMN IF NOT EXISTS review_status text;
ALTER TABLE ccpun_admin.local_ai_job ADD COLUMN IF NOT EXISTS review_actor_digest text;
ALTER TABLE ccpun_admin.local_ai_job ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE ccpun_admin.local_ai_job ADD COLUMN IF NOT EXISTS review_reason text;

UPDATE ccpun_admin.local_ai_job
SET queue_class=CASE WHEN priority>=80 THEN 'urgent' ELSE 'batch' END,
    priority=CASE WHEN priority>=80 THEN 80 ELSE 20 END,
    deadline_at=COALESCE(deadline_at,created_at+CASE WHEN priority>=80 THEN interval '15 minutes' ELSE interval '6 hours' END),
    next_attempt_at=COALESCE(next_attempt_at,created_at),
    request_fingerprint=COALESCE(request_fingerprint,idempotency_key),
    review_status=CASE WHEN status='succeeded' THEN COALESCE(review_status,'pending') ELSE NULL END
WHERE queue_class IS NULL OR deadline_at IS NULL OR next_attempt_at IS NULL OR request_fingerprint IS NULL
   OR (status='succeeded' AND review_status IS NULL);

ALTER TABLE ccpun_admin.local_ai_job ALTER COLUMN queue_class SET DEFAULT 'batch';
ALTER TABLE ccpun_admin.local_ai_job ALTER COLUMN queue_class SET NOT NULL;
ALTER TABLE ccpun_admin.local_ai_job ALTER COLUMN deadline_at SET NOT NULL;
ALTER TABLE ccpun_admin.local_ai_job ALTER COLUMN next_attempt_at SET DEFAULT now();
ALTER TABLE ccpun_admin.local_ai_job ALTER COLUMN next_attempt_at SET NOT NULL;
ALTER TABLE ccpun_admin.local_ai_job ALTER COLUMN request_fingerprint SET NOT NULL;
ALTER TABLE ccpun_admin.local_ai_job ALTER COLUMN max_attempts SET DEFAULT 3;

UPDATE ccpun_admin.local_ai_job
SET max_attempts=3
WHERE status IN ('queued','leased') AND max_attempts<3;

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='local_ai_job_queue_class_check') THEN
    ALTER TABLE ccpun_admin.local_ai_job ADD CONSTRAINT local_ai_job_queue_class_check
      CHECK ((queue_class='urgent' AND priority=80) OR (queue_class='batch' AND priority=20));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='local_ai_job_request_fingerprint_check') THEN
    ALTER TABLE ccpun_admin.local_ai_job ADD CONSTRAINT local_ai_job_request_fingerprint_check
      CHECK (request_fingerprint ~ '^[a-f0-9]{64}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='local_ai_job_review_status_check') THEN
    ALTER TABLE ccpun_admin.local_ai_job ADD CONSTRAINT local_ai_job_review_status_check
      CHECK (review_status IS NULL OR review_status IN ('pending','approved','rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='local_ai_job_review_state_check') THEN
    ALTER TABLE ccpun_admin.local_ai_job ADD CONSTRAINT local_ai_job_review_state_check CHECK (
      (status='succeeded')=(review_status IS NOT NULL)
      AND (
        (review_status IN ('approved','rejected') AND review_actor_digest IS NOT NULL AND reviewed_at IS NOT NULL)
        OR (review_status='pending' AND review_actor_digest IS NULL AND reviewed_at IS NULL AND review_reason IS NULL)
        OR (review_status IS NULL AND review_actor_digest IS NULL AND reviewed_at IS NULL AND review_reason IS NULL)
      )
      AND (review_actor_digest IS NULL OR review_actor_digest ~ '^[a-f0-9]{64}$')
      AND (review_reason IS NULL OR length(review_reason) BETWEEN 1 AND 1000)
    );
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS local_ai_job_review_queue_idx
  ON ccpun_admin.local_ai_job (completed_at ASC)
  WHERE status='succeeded' AND review_status='pending';
CREATE INDEX IF NOT EXISTS local_ai_job_deadline_idx
  ON ccpun_admin.local_ai_job (deadline_at ASC)
  WHERE status='queued';
CREATE INDEX IF NOT EXISTS local_ai_job_retry_due_idx
  ON ccpun_admin.local_ai_job (priority DESC,next_attempt_at ASC,created_at ASC)
  WHERE status='queued';

CREATE OR REPLACE FUNCTION ccpun_admin.admin_enqueue_local_ai_job_v2(
  p_job_id uuid,
  p_task_type text,
  p_data_class text,
  p_ciphertext_b64 text,
  p_nonce_b64 text,
  p_auth_tag_b64 text,
  p_key_version smallint,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_actor_digest text,
  p_queue_class text DEFAULT 'batch'
)
RETURNS TABLE(job_id uuid,status text,reused boolean,outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $enqueue$
DECLARE
  existing_job ccpun_admin.local_ai_job%ROWTYPE;
  active_count bigint;
  selected_priority smallint;
  selected_deadline interval;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ccpun-local-ai-enqueue-v2'));
  SELECT j.* INTO existing_job FROM ccpun_admin.local_ai_job j WHERE j.idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF existing_job.request_fingerprint<>p_request_fingerprint THEN
      RETURN QUERY SELECT existing_job.job_id,existing_job.status,false,'idempotency-conflict'::text;
    ELSE
      RETURN QUERY SELECT existing_job.job_id,existing_job.status,true,'reused'::text;
    END IF;
    RETURN;
  END IF;

  SELECT count(*) INTO active_count FROM ccpun_admin.local_ai_job j WHERE j.status IN ('queued','leased');
  IF active_count>=25 THEN
    RETURN QUERY SELECT NULL::uuid,NULL::text,false,'backpressure'::text;
    RETURN;
  END IF;

  IF p_queue_class='urgent' THEN
    selected_priority:=80;
    selected_deadline:=interval '15 minutes';
  ELSIF p_queue_class='batch' THEN
    selected_priority:=20;
    selected_deadline:=interval '6 hours';
  ELSE
    RAISE EXCEPTION 'LOCAL_AI_QUEUE_CLASS_INVALID';
  END IF;

  INSERT INTO ccpun_admin.local_ai_job(
    job_id,task_type,data_class,ciphertext_b64,nonce_b64,auth_tag_b64,key_version,
    idempotency_key,request_fingerprint,actor_digest,queue_class,priority,deadline_at
  ) VALUES (
    p_job_id,p_task_type,p_data_class,p_ciphertext_b64,p_nonce_b64,p_auth_tag_b64,p_key_version,
    p_idempotency_key,p_request_fingerprint,p_actor_digest,p_queue_class,selected_priority,now()+selected_deadline
  );
  INSERT INTO ccpun_admin.local_ai_job_event(event_id,job_id,from_status,to_status,actor_type,reason_code)
  VALUES(gen_random_uuid(),p_job_id,NULL,'queued','human','admin-enqueue');
  RETURN QUERY SELECT p_job_id,'queued'::text,false,'inserted'::text;
END
$enqueue$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_local_ai_jobs_v2(p_limit integer DEFAULT 50)
RETURNS TABLE(
  job_id uuid,task_type text,data_class text,status text,queue_class text,deadline_at timestamptz,next_attempt_at timestamptz,
  attempt_count integer,max_attempts integer,model_name text,output_json jsonb,review_status text,
  error_category text,created_at timestamptz,updated_at timestamptz,started_at timestamptz,completed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $jobs$
SELECT j.job_id,j.task_type,j.data_class,j.status,j.queue_class,j.deadline_at,j.next_attempt_at,j.attempt_count,j.max_attempts,
  j.model_name,NULL::jsonb,j.review_status,
  j.error_category,j.created_at,j.updated_at,j.started_at,j.completed_at
FROM ccpun_admin.local_ai_job j
ORDER BY CASE WHEN j.review_status='pending' THEN 0 ELSE 1 END,j.updated_at DESC
LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),100)
$jobs$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_local_ai_review_queue_v2(p_limit integer DEFAULT 25)
RETURNS TABLE(job_id uuid,task_type text,queue_class text,output_json jsonb,completed_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $review_queue$
SELECT j.job_id,j.task_type,j.queue_class,j.output_json,j.completed_at
FROM ccpun_admin.local_ai_job j
WHERE j.data_class='public-safe' AND j.status='succeeded' AND j.review_status='pending'
ORDER BY j.completed_at ASC
LIMIT LEAST(GREATEST(COALESCE(p_limit,25),1),100)
$review_queue$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_local_ai_job_v2(p_job_id uuid)
RETURNS TABLE(
  job_id uuid,task_type text,data_class text,status text,queue_class text,deadline_at timestamptz,next_attempt_at timestamptz,
  attempt_count integer,max_attempts integer,model_name text,output_json jsonb,review_status text,
  error_category text,created_at timestamptz,updated_at timestamptz,started_at timestamptz,completed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $job$
SELECT j.job_id,j.task_type,j.data_class,j.status,j.queue_class,j.deadline_at,j.next_attempt_at,j.attempt_count,j.max_attempts,
  j.model_name,CASE WHEN j.data_class='public-safe' AND j.review_status='approved' THEN j.output_json ELSE NULL END,
  j.review_status,j.error_category,j.created_at,j.updated_at,j.started_at,j.completed_at
FROM ccpun_admin.local_ai_job j WHERE j.job_id=p_job_id
$job$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_local_ai_health_v2()
RETURNS TABLE(
  queued bigint,leased bigint,succeeded bigint,failed bigint,reconciliation_required bigint,pending_review bigint,
  private_jobs bigint,public_safe_jobs bigint,succeeded_24h bigint,failed_24h bigint,oldest_queue_seconds bigint,
  duration_p50_ms bigint,duration_p95_ms bigint,worker_last_seen_at timestamptz,worker_model_name text,
  ollama_ready boolean,accepting_private_jobs boolean,active_job_count integer,
  process_rss_bytes bigint,heap_used_bytes bigint,system_load_1 double precision,uptime_seconds bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $health$
WITH counts AS (
  SELECT count(*) FILTER (WHERE status='queued') AS queued,count(*) FILTER (WHERE status='leased') AS leased,
    count(*) FILTER (WHERE status='succeeded') AS succeeded,count(*) FILTER (WHERE status='failed') AS failed,
    count(*) FILTER (WHERE status='reconciliation-required') AS reconciliation_required,
    count(*) FILTER (WHERE review_status='pending') AS pending_review,
    count(*) FILTER (WHERE data_class='customer-private') AS private_jobs,
    count(*) FILTER (WHERE data_class='public-safe') AS public_safe_jobs,
    count(*) FILTER (WHERE status='succeeded' AND completed_at>=now()-interval '24 hours') AS succeeded_24h,
    count(*) FILTER (WHERE status IN ('failed','reconciliation-required') AND completed_at>=now()-interval '24 hours') AS failed_24h,
    COALESCE(EXTRACT(epoch FROM now()-(min(created_at) FILTER (WHERE status='queued'))),0)::bigint AS oldest_queue_seconds
  FROM ccpun_admin.local_ai_job
), durations AS (
  SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM completed_at-started_at)*1000),0)::bigint AS p50,
    COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM completed_at-started_at)*1000),0)::bigint AS p95
  FROM ccpun_admin.local_ai_job
  WHERE completed_at>=now()-interval '24 hours' AND started_at IS NOT NULL AND completed_at IS NOT NULL
), heartbeat AS (
  SELECT last_seen_at,model_name,ollama_ready,accepting_private_jobs,active_job_count,details_json
  FROM ccpun_admin.local_ai_worker_heartbeat ORDER BY last_seen_at DESC LIMIT 1
)
SELECT c.queued,c.leased,c.succeeded,c.failed,c.reconciliation_required,c.pending_review,c.private_jobs,c.public_safe_jobs,
  c.succeeded_24h,c.failed_24h,c.oldest_queue_seconds,d.p50,d.p95,h.last_seen_at,h.model_name,h.ollama_ready,
  h.accepting_private_jobs,h.active_job_count,
  CASE WHEN jsonb_typeof(h.details_json->'processRssBytes')='number' THEN (h.details_json->>'processRssBytes')::bigint END,
  CASE WHEN jsonb_typeof(h.details_json->'heapUsedBytes')='number' THEN (h.details_json->>'heapUsedBytes')::bigint END,
  CASE WHEN jsonb_typeof(h.details_json->'systemLoad1')='number' THEN (h.details_json->>'systemLoad1')::double precision END,
  CASE WHEN jsonb_typeof(h.details_json->'uptimeSeconds')='number' THEN (h.details_json->>'uptimeSeconds')::bigint END
FROM counts c CROSS JOIN durations d LEFT JOIN heartbeat h ON true
$health$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_local_ai_incidents_v2(p_limit integer DEFAULT 25)
RETURNS TABLE(job_id uuid,task_type text,status text,queue_class text,attempt_count integer,max_attempts integer,error_category text,updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $incidents$
SELECT j.job_id,j.task_type,j.status,j.queue_class,j.attempt_count,j.max_attempts,j.error_category,j.updated_at
FROM ccpun_admin.local_ai_job j
WHERE j.status IN ('failed','reconciliation-required')
ORDER BY j.updated_at DESC
LIMIT LEAST(GREATEST(COALESCE(p_limit,25),1),100)
$incidents$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_review_local_ai_job_v2(
  p_job_id uuid,p_decision text,p_actor_digest text,p_reason text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $review$
DECLARE next_review_status text;
BEGIN
  IF p_decision NOT IN ('approve','reject') OR p_actor_digest!~'^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'LOCAL_AI_REVIEW_INVALID';
  END IF;
  IF p_decision='reject' AND (p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000) THEN
    RAISE EXCEPTION 'LOCAL_AI_REVIEW_REASON_REQUIRED';
  END IF;
  next_review_status:=CASE WHEN p_decision='approve' THEN 'approved' ELSE 'rejected' END;
  UPDATE ccpun_admin.local_ai_job
  SET review_status=next_review_status,review_actor_digest=p_actor_digest,reviewed_at=now(),
    review_reason=CASE WHEN p_decision='reject' THEN btrim(p_reason) ELSE NULL END,updated_at=now()
  WHERE job_id=p_job_id AND data_class='public-safe' AND status='succeeded' AND review_status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'LOCAL_AI_REVIEW_CONFLICT'; END IF;
  INSERT INTO ccpun_admin.local_ai_job_event(event_id,job_id,from_status,to_status,actor_type,reason_code)
  VALUES(gen_random_uuid(),p_job_id,'succeeded','succeeded','human',CASE WHEN p_decision='approve' THEN 'human-approved' ELSE 'human-rejected' END);
  RETURN next_review_status;
END
$review$;

CREATE OR REPLACE FUNCTION ccpun_admin.worker_claim_local_ai_job(
  p_worker_digest text,p_lease_token_digest text,p_lease_seconds integer DEFAULT 180,p_accept_private boolean DEFAULT false
)
RETURNS TABLE(
  job_id uuid,task_type text,data_class text,schema_version text,ciphertext_b64 text,
  nonce_b64 text,auth_tag_b64 text,key_version smallint,attempt_count integer,max_attempts integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $claim$
WITH deadline_expired AS (
  UPDATE ccpun_admin.local_ai_job j SET status='failed',error_category='queue-deadline-expired',completed_at=now(),updated_at=now()
  WHERE j.status='queued' AND j.deadline_at<=now() RETURNING j.job_id
), deadline_event AS (
  INSERT INTO ccpun_admin.local_ai_job_event(event_id,job_id,from_status,to_status,actor_type,reason_code)
  SELECT gen_random_uuid(),job_id,'queued','failed','system','queue-deadline-expired' FROM deadline_expired RETURNING event_id
), lease_expired AS (
  UPDATE ccpun_admin.local_ai_job j
  SET status=CASE WHEN j.attempt_count<j.max_attempts AND j.deadline_at>now() THEN 'queued' ELSE 'failed' END,
    lease_token_digest=NULL,lease_expires_at=NULL,error_category='lease-expired',
    next_attempt_at=CASE WHEN j.attempt_count<j.max_attempts AND j.deadline_at>now() THEN now()+interval '5 seconds' ELSE j.next_attempt_at END,
    completed_at=CASE WHEN j.attempt_count<j.max_attempts AND j.deadline_at>now() THEN NULL ELSE now() END,updated_at=now()
  WHERE j.status='leased' AND j.lease_expires_at<=now() RETURNING j.job_id,j.status
), candidate AS (
  SELECT j.job_id FROM ccpun_admin.local_ai_job j
  WHERE j.status='queued' AND j.deadline_at>now() AND j.next_attempt_at<=now()
    AND (j.data_class<>'customer-private' OR p_accept_private)
    AND p_worker_digest~'^[a-f0-9]{64}$' AND p_lease_token_digest~'^[a-f0-9]{64}$'
    AND p_lease_seconds BETWEEN 120 AND 300
  ORDER BY j.priority DESC,j.created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1
), claimed AS (
  UPDATE ccpun_admin.local_ai_job j
  SET status='leased',lease_token_digest=p_lease_token_digest,
    lease_expires_at=now()+make_interval(secs=>p_lease_seconds),attempt_count=j.attempt_count+1,
    started_at=COALESCE(j.started_at,now()),updated_at=now()
  FROM candidate c WHERE j.job_id=c.job_id RETURNING j.*
), event AS (
  INSERT INTO ccpun_admin.local_ai_job_event(event_id,job_id,from_status,to_status,actor_type,reason_code)
  SELECT gen_random_uuid(),claimed.job_id,'queued','leased','worker','worker-claim' FROM claimed RETURNING event_id
)
SELECT c.job_id,c.task_type,c.data_class,c.schema_version,c.ciphertext_b64,c.nonce_b64,
  c.auth_tag_b64,c.key_version,c.attempt_count,c.max_attempts FROM claimed c
$claim$;

CREATE OR REPLACE FUNCTION ccpun_admin.worker_complete_local_ai_job(
  p_job_id uuid,p_lease_token_digest text,p_model_name text,p_output_json jsonb,p_output_digest text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $complete$
WITH completed AS (
  UPDATE ccpun_admin.local_ai_job
  SET status='succeeded',model_name=p_model_name,output_json=p_output_json,output_digest=p_output_digest,
    review_status='pending',review_actor_digest=NULL,reviewed_at=NULL,review_reason=NULL,
    lease_token_digest=NULL,lease_expires_at=NULL,error_category=NULL,completed_at=now(),updated_at=now()
  WHERE job_id=p_job_id AND status='leased' AND lease_token_digest=p_lease_token_digest AND lease_expires_at>now()
  RETURNING job_id
), event AS (
  INSERT INTO ccpun_admin.local_ai_job_event(event_id,job_id,from_status,to_status,actor_type,reason_code)
  SELECT gen_random_uuid(),completed.job_id,'leased','succeeded','worker','validated-output' FROM completed RETURNING event_id
)
SELECT EXISTS(SELECT 1 FROM completed)
$complete$;

CREATE OR REPLACE FUNCTION ccpun_admin.worker_fail_local_ai_job(
  p_job_id uuid,p_lease_token_digest text,p_error_category text,p_retryable boolean,p_ambiguous boolean DEFAULT false
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $fail$
WITH target AS (
  SELECT j.job_id,CASE WHEN p_ambiguous THEN 'reconciliation-required'
    WHEN p_retryable AND j.attempt_count<j.max_attempts AND j.deadline_at>now() THEN 'queued' ELSE 'failed' END AS next_status,
    CASE WHEN j.attempt_count<=1 THEN interval '5 seconds' ELSE interval '15 seconds' END AS retry_delay
  FROM ccpun_admin.local_ai_job j
  WHERE j.job_id=p_job_id AND j.status='leased' AND j.lease_token_digest=p_lease_token_digest
    AND p_lease_token_digest~'^[a-f0-9]{64}$' AND p_error_category~'^[a-z0-9][a-z0-9_-]{0,79}$'
  FOR UPDATE
), updated AS (
  UPDATE ccpun_admin.local_ai_job j
  SET status=target.next_status,error_category=p_error_category,lease_token_digest=NULL,lease_expires_at=NULL,
    next_attempt_at=CASE WHEN target.next_status='queued' THEN now()+target.retry_delay ELSE j.next_attempt_at END,
    completed_at=CASE WHEN target.next_status='queued' THEN NULL ELSE now() END,updated_at=now()
  FROM target WHERE j.job_id=target.job_id RETURNING j.job_id,j.status
), event AS (
  INSERT INTO ccpun_admin.local_ai_job_event(event_id,job_id,from_status,to_status,actor_type,reason_code)
  SELECT gen_random_uuid(),updated.job_id,'leased',updated.status,'worker',p_error_category FROM updated RETURNING event_id
)
SELECT COALESCE((SELECT status FROM updated),'not-claimed')
$fail$;

REVOKE ALL ON FUNCTION ccpun_admin.admin_enqueue_local_ai_job_v2(uuid,text,text,text,text,text,smallint,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.admin_read_local_ai_jobs_v2(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.admin_read_local_ai_review_queue_v2(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.admin_read_local_ai_job_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.admin_read_local_ai_health_v2() FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.admin_read_local_ai_incidents_v2(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.admin_review_local_ai_job_v2(uuid,text,text,text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION ccpun_admin.admin_enqueue_local_ai_job_v2(uuid,text,text,text,text,text,smallint,text,text,text,text) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_read_local_ai_jobs_v2(integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_read_local_ai_review_queue_v2(integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_read_local_ai_job_v2(uuid) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_read_local_ai_health_v2() TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_read_local_ai_incidents_v2(integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_review_local_ai_job_v2(uuid,text,text,text) TO ccpun_admin_runtime;

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260920_local_ai_production_operations_v2','sha256:deb9f6761364a61bae275d5226f341ca021087da4116bc3f4703bd8b8c46fb1f')
ON CONFLICT(version) DO NOTHING;

COMMIT;

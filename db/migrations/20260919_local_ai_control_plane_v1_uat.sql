BEGIN;

CREATE SCHEMA IF NOT EXISTS ccpun_admin;
REVOKE ALL ON SCHEMA ccpun_admin FROM PUBLIC;

CREATE TABLE IF NOT EXISTS ccpun_admin.local_ai_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  lane text NOT NULL CHECK (lane IN ('uat','production')),
  project_id text NOT NULL,
  branch_id text NOT NULL,
  endpoint_id text NOT NULL,
  database_name text NOT NULL,
  migration_version text NOT NULL,
  migration_checksum text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ccpun_admin.local_ai_job (
  job_id uuid PRIMARY KEY,
  task_type text NOT NULL CHECK (task_type IN ('privacy-redaction','line-intent','content-operations','seo-preprocessing')),
  data_class text NOT NULL CHECK (data_class IN ('public-safe','customer-private')),
  schema_version text NOT NULL DEFAULT 'local-ai-contract-v1',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','leased','succeeded','failed','reconciliation-required','cancelled')),
  priority smallint NOT NULL DEFAULT 50 CHECK (priority BETWEEN 1 AND 100),
  ciphertext_b64 text NOT NULL CHECK (length(ciphertext_b64) BETWEEN 1 AND 100000),
  nonce_b64 text NOT NULL CHECK (length(nonce_b64) BETWEEN 16 AND 64),
  auth_tag_b64 text NOT NULL CHECK (length(auth_tag_b64) BETWEEN 16 AND 64),
  key_version smallint NOT NULL CHECK (key_version = 1),
  idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^[a-f0-9]{64}$'),
  actor_digest text NOT NULL CHECK (actor_digest ~ '^[a-f0-9]{64}$'),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
  max_attempts integer NOT NULL DEFAULT 2 CHECK (max_attempts BETWEEN 1 AND 3),
  lease_token_digest text CHECK (lease_token_digest IS NULL OR lease_token_digest ~ '^[a-f0-9]{64}$'),
  lease_expires_at timestamptz,
  model_name text CHECK (model_name IS NULL OR length(model_name) BETWEEN 1 AND 120),
  output_json jsonb CHECK (output_json IS NULL OR jsonb_typeof(output_json) = 'object'),
  output_digest text CHECK (output_digest IS NULL OR output_digest ~ '^[a-f0-9]{64}$'),
  error_category text CHECK (error_category IS NULL OR error_category ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  CHECK (
    (task_type IN ('privacy-redaction','line-intent') AND data_class = 'customer-private') OR
    (task_type IN ('content-operations','seo-preprocessing') AND data_class = 'public-safe')
  ),
  CHECK ((status = 'leased') = (lease_token_digest IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK ((status = 'succeeded') = (output_json IS NOT NULL AND output_digest IS NOT NULL AND completed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS local_ai_job_queue_idx
  ON ccpun_admin.local_ai_job (priority DESC, created_at ASC)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS local_ai_job_updated_idx
  ON ccpun_admin.local_ai_job (updated_at DESC);

CREATE TABLE IF NOT EXISTS ccpun_admin.local_ai_job_event (
  event_id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES ccpun_admin.local_ai_job(job_id),
  from_status text,
  to_status text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('human','system','worker')),
  reason_code text CHECK (reason_code IS NULL OR reason_code ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS local_ai_job_event_job_idx
  ON ccpun_admin.local_ai_job_event (job_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS ccpun_admin.local_ai_worker_heartbeat (
  worker_digest text PRIMARY KEY CHECK (worker_digest ~ '^[a-f0-9]{64}$'),
  runtime_version text NOT NULL CHECK (length(runtime_version) BETWEEN 1 AND 120),
  model_name text NOT NULL CHECK (length(model_name) BETWEEN 1 AND 120),
  ollama_ready boolean NOT NULL,
  accepting_private_jobs boolean NOT NULL,
  active_job_count integer NOT NULL CHECK (active_job_count BETWEEN 0 AND 1),
  last_seen_at timestamptz NOT NULL,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details_json) = 'object')
);

CREATE OR REPLACE FUNCTION ccpun_admin.admin_enqueue_local_ai_job(
  p_job_id uuid,
  p_task_type text,
  p_data_class text,
  p_ciphertext_b64 text,
  p_nonce_b64 text,
  p_auth_tag_b64 text,
  p_key_version smallint,
  p_idempotency_key text,
  p_actor_digest text,
  p_priority smallint DEFAULT 50
)
RETURNS TABLE(job_id uuid,status text,reused boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS 'WITH inserted AS (
  INSERT INTO ccpun_admin.local_ai_job(
    job_id,task_type,data_class,ciphertext_b64,nonce_b64,auth_tag_b64,key_version,idempotency_key,actor_digest,priority
  ) VALUES (
    p_job_id,p_task_type,p_data_class,p_ciphertext_b64,p_nonce_b64,p_auth_tag_b64,p_key_version,p_idempotency_key,p_actor_digest,p_priority
  ) ON CONFLICT(idempotency_key) DO NOTHING RETURNING local_ai_job.job_id,local_ai_job.status
), event AS (
  INSERT INTO ccpun_admin.local_ai_job_event(event_id,job_id,from_status,to_status,actor_type,reason_code)
  SELECT gen_random_uuid(),inserted.job_id,NULL,''queued'',''human'',''admin-enqueue'' FROM inserted RETURNING event_id
)
SELECT i.job_id,i.status,false FROM inserted i
UNION ALL
SELECT j.job_id,j.status,true FROM ccpun_admin.local_ai_job j
WHERE j.idempotency_key=p_idempotency_key AND NOT EXISTS(SELECT 1 FROM inserted)';

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_local_ai_jobs(p_limit integer DEFAULT 50)
RETURNS TABLE(
  job_id uuid,task_type text,data_class text,status text,priority smallint,
  attempt_count integer,max_attempts integer,model_name text,output_json jsonb,
  error_category text,created_at timestamptz,updated_at timestamptz,started_at timestamptz,completed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS 'SELECT j.job_id,j.task_type,j.data_class,j.status,j.priority,j.attempt_count,j.max_attempts,
  j.model_name,j.output_json,j.error_category,j.created_at,j.updated_at,j.started_at,j.completed_at
FROM ccpun_admin.local_ai_job j
ORDER BY j.updated_at DESC
LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),100)';

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_local_ai_job(p_job_id uuid)
RETURNS TABLE(
  job_id uuid,task_type text,data_class text,status text,priority smallint,
  attempt_count integer,max_attempts integer,model_name text,output_json jsonb,
  error_category text,created_at timestamptz,updated_at timestamptz,started_at timestamptz,completed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS 'SELECT j.job_id,j.task_type,j.data_class,j.status,j.priority,j.attempt_count,j.max_attempts,
  j.model_name,j.output_json,j.error_category,j.created_at,j.updated_at,j.started_at,j.completed_at
FROM ccpun_admin.local_ai_job j WHERE j.job_id=p_job_id';

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_local_ai_health()
RETURNS TABLE(
  queued bigint,leased bigint,succeeded bigint,failed bigint,reconciliation_required bigint,
  private_jobs bigint,public_safe_jobs bigint,worker_last_seen_at timestamptz,
  worker_model_name text,ollama_ready boolean,accepting_private_jobs boolean,active_job_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS 'WITH counts AS (
  SELECT count(*) FILTER (WHERE status=''queued'') AS queued,count(*) FILTER (WHERE status=''leased'') AS leased,
    count(*) FILTER (WHERE status=''succeeded'') AS succeeded,count(*) FILTER (WHERE status=''failed'') AS failed,
    count(*) FILTER (WHERE status=''reconciliation-required'') AS reconciliation_required,
    count(*) FILTER (WHERE data_class=''customer-private'') AS private_jobs,
    count(*) FILTER (WHERE data_class=''public-safe'') AS public_safe_jobs
  FROM ccpun_admin.local_ai_job
), heartbeat AS (
  SELECT last_seen_at,model_name,ollama_ready,accepting_private_jobs,active_job_count
  FROM ccpun_admin.local_ai_worker_heartbeat ORDER BY last_seen_at DESC LIMIT 1
)
SELECT c.queued,c.leased,c.succeeded,c.failed,c.reconciliation_required,c.private_jobs,c.public_safe_jobs,
  h.last_seen_at,h.model_name,h.ollama_ready,h.accepting_private_jobs,h.active_job_count
FROM counts c LEFT JOIN heartbeat h ON true';

DROP FUNCTION IF EXISTS ccpun_admin.worker_claim_local_ai_job(text,text,integer);
CREATE OR REPLACE FUNCTION ccpun_admin.worker_claim_local_ai_job(
  p_worker_digest text,
  p_lease_token_digest text,
  p_lease_seconds integer DEFAULT 120,
  p_accept_private boolean DEFAULT false
)
RETURNS TABLE(
  job_id uuid,task_type text,data_class text,schema_version text,ciphertext_b64 text,
  nonce_b64 text,auth_tag_b64 text,key_version smallint,attempt_count integer,max_attempts integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS 'WITH expired AS (
  UPDATE ccpun_admin.local_ai_job j
  SET status=CASE WHEN j.attempt_count<j.max_attempts THEN ''queued'' ELSE ''failed'' END,
    lease_token_digest=NULL,lease_expires_at=NULL,error_category=''lease-expired'',
    completed_at=CASE WHEN j.attempt_count<j.max_attempts THEN NULL ELSE now() END,updated_at=now()
  WHERE j.status=''leased'' AND j.lease_expires_at<=now() RETURNING j.job_id
), candidate AS (
  SELECT j.job_id FROM ccpun_admin.local_ai_job j
  WHERE j.status=''queued'' AND (j.data_class<>''customer-private'' OR p_accept_private)
    AND p_worker_digest ~ ''^[a-f0-9]{64}$'' AND p_lease_token_digest ~ ''^[a-f0-9]{64}$''
    AND p_lease_seconds BETWEEN 30 AND 300
  ORDER BY j.priority DESC,j.created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1
), claimed AS (
  UPDATE ccpun_admin.local_ai_job j
  SET status=''leased'',lease_token_digest=p_lease_token_digest,
    lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
    attempt_count=j.attempt_count+1,started_at=COALESCE(j.started_at,now()),updated_at=now()
  FROM candidate c WHERE j.job_id=c.job_id RETURNING j.*
), event AS (
  INSERT INTO ccpun_admin.local_ai_job_event(event_id,job_id,from_status,to_status,actor_type,reason_code)
  SELECT gen_random_uuid(),claimed.job_id,''queued'',''leased'',''worker'',''worker-claim'' FROM claimed RETURNING event_id
)
SELECT c.job_id,c.task_type,c.data_class,c.schema_version,c.ciphertext_b64,c.nonce_b64,
  c.auth_tag_b64,c.key_version,c.attempt_count,c.max_attempts FROM claimed c';

CREATE OR REPLACE FUNCTION ccpun_admin.worker_complete_local_ai_job(
  p_job_id uuid,
  p_lease_token_digest text,
  p_model_name text,
  p_output_json jsonb,
  p_output_digest text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS 'WITH completed AS (
  UPDATE ccpun_admin.local_ai_job
  SET status=''succeeded'',model_name=p_model_name,output_json=p_output_json,output_digest=p_output_digest,
    lease_token_digest=NULL,lease_expires_at=NULL,error_category=NULL,completed_at=now(),updated_at=now()
  WHERE job_id=p_job_id AND status=''leased'' AND lease_token_digest=p_lease_token_digest AND lease_expires_at>now()
  RETURNING job_id
), event AS (
  INSERT INTO ccpun_admin.local_ai_job_event(event_id,job_id,from_status,to_status,actor_type,reason_code)
  SELECT gen_random_uuid(),completed.job_id,''leased'',''succeeded'',''worker'',''validated-output'' FROM completed RETURNING event_id
)
SELECT EXISTS(SELECT 1 FROM completed)';

CREATE OR REPLACE FUNCTION ccpun_admin.worker_fail_local_ai_job(
  p_job_id uuid,
  p_lease_token_digest text,
  p_error_category text,
  p_retryable boolean,
  p_ambiguous boolean DEFAULT false
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS 'WITH target AS (
  SELECT j.job_id,CASE WHEN p_ambiguous THEN ''reconciliation-required''
    WHEN p_retryable AND j.attempt_count<j.max_attempts THEN ''queued'' ELSE ''failed'' END AS next_status
  FROM ccpun_admin.local_ai_job j
  WHERE j.job_id=p_job_id AND j.status=''leased'' AND j.lease_token_digest=p_lease_token_digest
    AND p_lease_token_digest ~ ''^[a-f0-9]{64}$'' AND p_error_category ~ ''^[a-z0-9][a-z0-9_-]{0,79}$''
  FOR UPDATE
), updated AS (
  UPDATE ccpun_admin.local_ai_job j
  SET status=target.next_status,error_category=p_error_category,lease_token_digest=NULL,lease_expires_at=NULL,
    completed_at=CASE WHEN target.next_status=''queued'' THEN NULL ELSE now() END,updated_at=now()
  FROM target WHERE j.job_id=target.job_id RETURNING j.job_id,j.status
), event AS (
  INSERT INTO ccpun_admin.local_ai_job_event(event_id,job_id,from_status,to_status,actor_type,reason_code)
  SELECT gen_random_uuid(),updated.job_id,''leased'',updated.status,''worker'',p_error_category FROM updated RETURNING event_id
)
SELECT COALESCE((SELECT status FROM updated),''not-claimed'')';

CREATE OR REPLACE FUNCTION ccpun_admin.worker_report_local_ai_heartbeat(
  p_worker_digest text,
  p_runtime_version text,
  p_model_name text,
  p_ollama_ready boolean,
  p_accepting_private_jobs boolean,
  p_active_job_count integer,
  p_details_json jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS 'WITH upsert AS (
  INSERT INTO ccpun_admin.local_ai_worker_heartbeat(
    worker_digest,runtime_version,model_name,ollama_ready,accepting_private_jobs,active_job_count,last_seen_at,details_json
  ) VALUES (
    p_worker_digest,p_runtime_version,p_model_name,p_ollama_ready,p_accepting_private_jobs,p_active_job_count,now(),p_details_json
  ) ON CONFLICT(worker_digest) DO UPDATE SET runtime_version=excluded.runtime_version,model_name=excluded.model_name,
    ollama_ready=excluded.ollama_ready,accepting_private_jobs=excluded.accepting_private_jobs,
    active_job_count=excluded.active_job_count,last_seen_at=excluded.last_seen_at,details_json=excluded.details_json
  RETURNING true
)
SELECT NULL::void FROM upsert';

REVOKE ALL ON ccpun_admin.local_ai_identity,ccpun_admin.local_ai_job,
  ccpun_admin.local_ai_job_event,ccpun_admin.local_ai_worker_heartbeat FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.admin_enqueue_local_ai_job(uuid,text,text,text,text,text,smallint,text,text,smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.admin_read_local_ai_jobs(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.admin_read_local_ai_job(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.admin_read_local_ai_health() FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.worker_claim_local_ai_job(text,text,integer,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.worker_complete_local_ai_job(uuid,text,text,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.worker_fail_local_ai_job(uuid,text,text,boolean,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.worker_report_local_ai_heartbeat(text,text,text,boolean,boolean,integer,jsonb) FROM PUBLIC;

CREATE ROLE ccpun_local_ai_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

GRANT USAGE ON SCHEMA ccpun_admin TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_enqueue_local_ai_job(uuid,text,text,text,text,text,smallint,text,text,smallint) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_read_local_ai_jobs(integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_read_local_ai_job(uuid) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_read_local_ai_health() TO ccpun_admin_runtime;

REVOKE ALL PRIVILEGES ON DATABASE neondb FROM ccpun_local_ai_runtime;
GRANT CONNECT ON DATABASE neondb TO ccpun_local_ai_runtime;
REVOKE ALL PRIVILEGES ON SCHEMA ccpun_admin FROM ccpun_local_ai_runtime;
GRANT USAGE ON SCHEMA ccpun_admin TO ccpun_local_ai_runtime;
REVOKE ALL PRIVILEGES ON ccpun_admin.local_ai_identity,ccpun_admin.local_ai_job,
  ccpun_admin.local_ai_job_event,ccpun_admin.local_ai_worker_heartbeat FROM ccpun_local_ai_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.worker_claim_local_ai_job(text,text,integer,boolean) TO ccpun_local_ai_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.worker_complete_local_ai_job(uuid,text,text,jsonb,text) TO ccpun_local_ai_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.worker_fail_local_ai_job(uuid,text,text,boolean,boolean) TO ccpun_local_ai_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.worker_report_local_ai_heartbeat(text,text,text,boolean,boolean,integer,jsonb) TO ccpun_local_ai_runtime;

INSERT INTO ccpun_admin.local_ai_identity(
  singleton,lane,project_id,branch_id,endpoint_id,database_name,migration_version,migration_checksum,updated_at
) VALUES (
  true,'uat','young-term-47483330','br-crimson-mouse-az7ajkv8','ep-mute-frost-aztvz394','neondb',
  '20260919_local_ai_control_plane_v1','sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6',now()
) ON CONFLICT(singleton) DO UPDATE SET
  lane=excluded.lane,project_id=excluded.project_id,branch_id=excluded.branch_id,endpoint_id=excluded.endpoint_id,
  database_name=excluded.database_name,migration_version=excluded.migration_version,
  migration_checksum=excluded.migration_checksum,updated_at=excluded.updated_at;

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260919_local_ai_control_plane_v1','sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6')
ON CONFLICT(version) DO NOTHING;

COMMIT;

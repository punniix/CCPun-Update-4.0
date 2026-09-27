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

SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260924_agent_os_runtime_lookup_v2'));

SELECT 1 / CASE WHEN NOT EXISTS (
  SELECT 1 FROM ccpun_admin.schema_migration
  WHERE version='20260924_agent_os_runtime_lookup_v2'
    AND checksum<>'sha256:43dbbb737b1c59c4b16290a9c65bf6cd10fffc22bcff48065f69f6b2d07339f1'
) THEN 1 ELSE 0 END AS checksum_guard;

-- checksum-source-begin
CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_agent_runtime_job(p_job_id uuid)
RETURNS TABLE(
  job_id uuid,correlation_id uuid,request_id uuid,payload_digest_sha256 text,
  source text,action text,workflow_key text,status text,stage text,queue_class text,
  attempt integer,max_attempts integer,queued_at timestamptz,started_at timestamptz,
  heartbeat_at timestamptz,completed_at timestamptz,n8n_execution_id text,
  provider_reference text,error_category text,duration_ms bigint,queue_wait_ms bigint,
  row_version bigint,created_at timestamptz,updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $agent_lookup$
SELECT
  j.job_id,j.correlation_id,j.request_id,j.payload_digest_sha256,
  j.source,j.action,j.workflow_key,j.status,j.stage,j.queue_class,
  j.attempt,j.max_attempts,j.queued_at,j.started_at,j.heartbeat_at,j.completed_at,
  j.n8n_execution_id,j.provider_reference,j.error_category,j.duration_ms,j.queue_wait_ms,
  j.row_version,j.created_at,j.updated_at
FROM ccpun_admin.agent_runtime_job j
WHERE j.job_id=p_job_id
$agent_lookup$;

REVOKE ALL ON FUNCTION ccpun_admin.admin_read_agent_runtime_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_read_agent_runtime_job(uuid) TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260924_agent_os_runtime_lookup_v2','sha256:43dbbb737b1c59c4b16290a9c65bf6cd10fffc22bcff48065f69f6b2d07339f1')
ON CONFLICT(version) DO NOTHING;

COMMIT;

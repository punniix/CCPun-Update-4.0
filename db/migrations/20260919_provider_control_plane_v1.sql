BEGIN;

SELECT 1 / CASE WHEN current_database() = 'neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS (
  SELECT 1 FROM pg_roles
  WHERE rolname = 'ccpun_admin_runtime'
    AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
    AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls
) THEN 1 ELSE 0 END AS runtime_role_guard;
SELECT 1 / CASE WHEN EXISTS (
  SELECT 1 FROM ccpun_admin.system_identity WHERE singleton = true
) THEN 1 ELSE 0 END AS admin_identity_guard;

SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260919_provider_control_plane_v1'));

SELECT 1 / CASE WHEN NOT EXISTS (
  SELECT 1 FROM ccpun_admin.schema_migration
  WHERE version = '20260919_provider_control_plane_v1'
    AND checksum <> 'sha256:bfb668d37d859d3e01bdbee9ea433e5bdb835157f72ea983ce819c3c24160de1'
) THEN 1 ELSE 0 END AS checksum_guard;

-- checksum-source-begin
CREATE TABLE IF NOT EXISTS ccpun_admin.control_resource (
  resource_key text PRIMARY KEY CHECK (resource_key ~ '^[a-z0-9][a-z0-9._:-]{2,119}$'),
  resource_type text NOT NULL CHECK (resource_type ~ '^[a-z0-9][a-z0-9._:-]{2,79}$'),
  provider text NOT NULL CHECK (provider ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  desired_mode text NOT NULL DEFAULT 'hold' CHECK (desired_mode IN ('hold','reconcile','rollback')),
  desired_version text,
  desired_definition jsonb,
  desired_hash_sha256 text CHECK (desired_hash_sha256 IS NULL OR desired_hash_sha256 ~ '^[0-9a-f]{64}$'),
  approved_previous_version text,
  approved_previous_definition jsonb,
  approved_previous_hash_sha256 text CHECK (approved_previous_hash_sha256 IS NULL OR approved_previous_hash_sha256 ~ '^[0-9a-f]{64}$'),
  approved_previous_provider_ref text,
  actual_version text,
  actual_definition jsonb,
  actual_hash_sha256 text CHECK (actual_hash_sha256 IS NULL OR actual_hash_sha256 ~ '^[0-9a-f]{64}$'),
  actual_provider_ref text,
  state text NOT NULL DEFAULT 'hold' CHECK (state IN ('hold','pending','leased','mutating','verified','reconciliation_required','failed','blocked')),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  current_command_id uuid,
  last_operation_id uuid,
  last_verified_at timestamptz,
  updated_by text NOT NULL CHECK (length(updated_by) BETWEEN 1 AND 320),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((desired_definition IS NULL) = (desired_hash_sha256 IS NULL)),
  CHECK ((actual_definition IS NULL) = (actual_hash_sha256 IS NULL)),
  CHECK ((approved_previous_definition IS NULL) = (approved_previous_hash_sha256 IS NULL)),
  CHECK (desired_mode <> 'reconcile' OR (desired_version IS NOT NULL AND desired_definition IS NOT NULL)),
  CHECK (desired_mode <> 'rollback' OR (desired_definition IS NOT NULL AND approved_previous_provider_ref IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS ccpun_admin.control_command (
  command_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,159}$'),
  resource_key text NOT NULL REFERENCES ccpun_admin.control_resource(resource_key),
  command_type text NOT NULL CHECK (command_type IN ('hold','reconcile','rollback')),
  expected_version bigint NOT NULL CHECK (expected_version > 0),
  requested_version text,
  requested_definition jsonb,
  requested_hash_sha256 text CHECK (requested_hash_sha256 IS NULL OR requested_hash_sha256 ~ '^[0-9a-f]{64}$'),
  actor text NOT NULL CHECK (length(actor) BETWEEN 1 AND 320),
  actor_type text NOT NULL CHECK (actor_type IN ('human','ai','system')),
  approved_by text,
  approval_reason text,
  status text NOT NULL CHECK (status IN ('pending_approval','accepted','conflict','duplicate','rejected')),
  resulting_version bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  CHECK ((requested_definition IS NULL) = (requested_hash_sha256 IS NULL))
);

CREATE INDEX IF NOT EXISTS control_command_resource_created_idx
  ON ccpun_admin.control_command(resource_key, created_at DESC);

CREATE TABLE IF NOT EXISTS ccpun_admin.provider_operation (
  operation_id uuid PRIMARY KEY,
  resource_key text NOT NULL REFERENCES ccpun_admin.control_resource(resource_key),
  resource_version bigint NOT NULL CHECK (resource_version > 0),
  command_id uuid REFERENCES ccpun_admin.control_command(command_id),
  desired_mode text NOT NULL CHECK (desired_mode IN ('reconcile','rollback')),
  desired_version text,
  desired_definition jsonb NOT NULL,
  desired_hash_sha256 text NOT NULL CHECK (desired_hash_sha256 ~ '^[0-9a-f]{64}$'),
  desired_provider_ref text,
  before_actual_version text,
  before_actual_definition jsonb,
  before_actual_hash_sha256 text CHECK (before_actual_hash_sha256 IS NULL OR before_actual_hash_sha256 ~ '^[0-9a-f]{64}$'),
  before_actual_provider_ref text,
  status text NOT NULL CHECK (status IN ('pending','leased','mutating','verified','reconciliation_required','failed','blocked')),
  mutation_allowed boolean NOT NULL DEFAULT true,
  lease_owner_digest text CHECK (lease_owner_digest IS NULL OR lease_owner_digest ~ '^[0-9a-f]{64}$'),
  lease_token_digest text CHECK (lease_token_digest IS NULL OR lease_token_digest ~ '^[0-9a-f]{64}$'),
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0 AND attempt_count <= 20),
  provider_status_code integer,
  error_class text,
  readback_version text,
  readback_definition jsonb,
  readback_hash_sha256 text CHECK (readback_hash_sha256 IS NULL OR readback_hash_sha256 ~ '^[0-9a-f]{64}$'),
  readback_provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(resource_key, resource_version),
  CHECK ((before_actual_definition IS NULL) = (before_actual_hash_sha256 IS NULL)),
  CHECK ((readback_definition IS NULL) = (readback_hash_sha256 IS NULL))
);

CREATE INDEX IF NOT EXISTS provider_operation_state_idx
  ON ccpun_admin.provider_operation(status, lease_expires_at, updated_at);

INSERT INTO ccpun_admin.control_resource(
  resource_key, resource_type, provider, desired_mode, state, updated_by
) VALUES (
  'line.rich_menu.default', 'provider_configuration', 'line', 'hold', 'hold', 'migration'
) ON CONFLICT(resource_key) DO NOTHING;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_control_resource(p_resource_key text)
RETURNS TABLE(
  resource_key text, resource_type text, provider text, desired_mode text,
  desired_version text, desired_definition jsonb, desired_hash_sha256 text,
  approved_previous_version text, approved_previous_definition jsonb,
  approved_previous_hash_sha256 text, approved_previous_provider_ref text,
  actual_version text, actual_definition jsonb, actual_hash_sha256 text,
  actual_provider_ref text, state text, row_version bigint,
  current_command_id uuid, last_operation_id uuid, last_verified_at timestamptz,
  updated_by text, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $$
  SELECT r.resource_key, r.resource_type, r.provider, r.desired_mode,
    r.desired_version, r.desired_definition, r.desired_hash_sha256,
    r.approved_previous_version, r.approved_previous_definition,
    r.approved_previous_hash_sha256, r.approved_previous_provider_ref,
    r.actual_version, r.actual_definition, r.actual_hash_sha256,
    r.actual_provider_ref, r.state, r.row_version,
    r.current_command_id, r.last_operation_id, r.last_verified_at,
    r.updated_by, r.updated_at
  FROM ccpun_admin.control_resource r
  WHERE r.resource_key = p_resource_key
$$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_submit_control_command(payload jsonb)
RETURNS TABLE(outcome text, command_id uuid, resource_version bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $$
  WITH input AS (
    SELECT
      NULLIF(payload->>'command_id','')::uuid AS command_id,
      payload->>'idempotency_key' AS idempotency_key,
      payload->>'resource_key' AS resource_key,
      payload->>'command_type' AS command_type,
      NULLIF(payload->>'expected_version','')::bigint AS expected_version,
      NULLIF(payload->>'requested_version','') AS requested_version,
      payload->'requested_definition' AS requested_definition,
      NULLIF(payload->>'requested_hash_sha256','') AS requested_hash_sha256,
      payload->>'actor' AS actor,
      payload->>'actor_type' AS actor_type,
      NULLIF(payload->>'approved_by','') AS approved_by,
      NULLIF(payload->>'approval_reason','') AS approval_reason
  ), existing AS (
    SELECT c.* FROM ccpun_admin.control_command c JOIN input i USING(idempotency_key)
  ), resource AS MATERIALIZED (
    SELECT r.* FROM ccpun_admin.control_resource r JOIN input i USING(resource_key) FOR UPDATE
  ), classified AS (
    SELECT i.*,
      r.state AS resource_state,r.row_version,
      r.approved_previous_version,r.approved_previous_definition,
      r.approved_previous_hash_sha256,r.approved_previous_provider_ref,
      CASE
        WHEN r.state='mutating' THEN 'busy'
        WHEN i.expected_version<>r.row_version THEN 'conflict'
        WHEN i.command_type IN ('reconcile','rollback') AND (i.actor_type<>'human' OR i.approved_by IS NULL) THEN 'pending_approval'
        ELSE 'accepted'
      END AS command_status,
      i.command_id IS NOT NULL
        AND i.idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,159}$'
        AND i.command_type IN ('hold','reconcile','rollback')
        AND length(i.actor) BETWEEN 1 AND 320
        AND i.actor_type IN ('human','ai','system')
        AND i.expected_version>0
        AND (i.command_type<>'reconcile' OR (
          i.requested_version IS NOT NULL
          AND jsonb_typeof(i.requested_definition)='object'
          AND i.requested_hash_sha256 ~ '^[0-9a-f]{64}$'
        ))
        AND (i.command_type<>'rollback' OR (
          r.approved_previous_definition IS NOT NULL
          AND r.approved_previous_provider_ref IS NOT NULL
        )) AS valid
    FROM input i JOIN resource r USING(resource_key)
  ), inserted AS (
    INSERT INTO ccpun_admin.control_command(
      command_id,idempotency_key,resource_key,command_type,expected_version,
      requested_version,requested_definition,requested_hash_sha256,
      actor,actor_type,approved_by,approval_reason,status,resulting_version,applied_at
    )
    SELECT c.command_id,c.idempotency_key,c.resource_key,c.command_type,c.expected_version,
      CASE WHEN c.command_type='rollback' THEN c.approved_previous_version ELSE c.requested_version END,
      CASE WHEN c.command_type='rollback' THEN c.approved_previous_definition ELSE c.requested_definition END,
      CASE WHEN c.command_type='rollback' THEN c.approved_previous_hash_sha256 ELSE c.requested_hash_sha256 END,
      c.actor,c.actor_type,c.approved_by,c.approval_reason,
      CASE WHEN c.command_status='busy' THEN 'rejected' ELSE c.command_status END,
      CASE WHEN c.command_status='accepted' THEN c.row_version+1 ELSE c.row_version END,
      CASE WHEN c.command_status='accepted' THEN now() ELSE NULL END
    FROM classified c WHERE c.valid AND NOT EXISTS(SELECT 1 FROM existing)
    ON CONFLICT(idempotency_key) DO NOTHING
    RETURNING *
  ), superseded AS (
    UPDATE ccpun_admin.provider_operation o
    SET status='blocked',mutation_allowed=false,error_class='superseded_by_command',
      lease_owner_digest=NULL,lease_token_digest=NULL,lease_expires_at=NULL,
      updated_at=now(),completed_at=now()
    FROM inserted c
    WHERE c.status='accepted' AND o.resource_key=c.resource_key
      AND o.status IN ('pending','leased','reconciliation_required')
    RETURNING o.operation_id
  ), operation_created AS (
    INSERT INTO ccpun_admin.provider_operation(
      operation_id,resource_key,resource_version,command_id,desired_mode,
      desired_version,desired_definition,desired_hash_sha256,desired_provider_ref,
      before_actual_version,before_actual_definition,before_actual_hash_sha256,before_actual_provider_ref,
      status,mutation_allowed
    )
    SELECT gen_random_uuid(),c.resource_key,c.resulting_version,c.command_id,c.command_type,
      c.requested_version,c.requested_definition,c.requested_hash_sha256,
      CASE WHEN c.command_type='rollback' THEN r.approved_previous_provider_ref ELSE NULL END,
      r.actual_version,r.actual_definition,r.actual_hash_sha256,r.actual_provider_ref,'pending',true
    FROM inserted c JOIN resource r USING(resource_key)
    WHERE c.status='accepted' AND c.command_type<>'hold'
    ON CONFLICT(resource_key,resource_version) DO NOTHING
    RETURNING operation_id
  ), updated AS (
    UPDATE ccpun_admin.control_resource r
    SET desired_mode=c.command_type,
      desired_version=CASE WHEN c.command_type='hold' THEN r.desired_version ELSE c.requested_version END,
      desired_definition=CASE WHEN c.command_type='hold' THEN r.desired_definition ELSE c.requested_definition END,
      desired_hash_sha256=CASE WHEN c.command_type='hold' THEN r.desired_hash_sha256 ELSE c.requested_hash_sha256 END,
      state=CASE WHEN c.command_type='hold' THEN 'hold' ELSE 'pending' END,
      row_version=r.row_version+1,current_command_id=c.command_id,
      updated_by=c.actor,updated_at=now()
    FROM inserted c
    WHERE c.status='accepted' AND r.resource_key=c.resource_key
    RETURNING r.resource_key
  )
  SELECT
    CASE
      WHEN e.command_id IS NOT NULL AND e.resource_key=i.resource_key
        AND e.command_type=i.command_type AND e.expected_version=i.expected_version THEN 'duplicate'
      WHEN e.command_id IS NOT NULL THEN 'idempotency_conflict'
      ELSE COALESCE(NULLIF(c.status,'rejected'),'busy')
    END,
    COALESCE(e.command_id,c.command_id),COALESCE(e.resulting_version,c.resulting_version)
  FROM input i
  LEFT JOIN existing e ON true
  LEFT JOIN inserted c ON true
  WHERE e.command_id IS NOT NULL OR c.command_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_claim_provider_operation(payload jsonb)
RETURNS TABLE(
  operation_id uuid, resource_key text, resource_version bigint, desired_mode text,
  desired_version text, desired_definition jsonb, desired_hash_sha256 text,
  desired_provider_ref text, before_actual_version text, before_actual_definition jsonb,
  before_actual_hash_sha256 text, before_actual_provider_ref text,
  mutation_allowed boolean, attempt_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $$
  WITH input AS (
    SELECT payload->>'resource_key' AS resource_key,
      payload->>'worker_digest' AS worker_digest,
      payload->>'lease_token_digest' AS lease_token_digest
  ), resource AS MATERIALIZED (
    SELECT r.* FROM ccpun_admin.control_resource r JOIN input i USING(resource_key)
    WHERE r.desired_mode<>'hold'
      AND i.worker_digest ~ '^[0-9a-f]{64}$'
      AND i.lease_token_digest ~ '^[0-9a-f]{64}$'
    FOR UPDATE
  ), inserted AS (
    INSERT INTO ccpun_admin.provider_operation(
      operation_id,resource_key,resource_version,command_id,desired_mode,
      desired_version,desired_definition,desired_hash_sha256,desired_provider_ref,
      before_actual_version,before_actual_definition,before_actual_hash_sha256,before_actual_provider_ref,
      status,mutation_allowed
    )
    SELECT gen_random_uuid(),r.resource_key,r.row_version,r.current_command_id,r.desired_mode,
      r.desired_version,r.desired_definition,r.desired_hash_sha256,
      CASE WHEN r.desired_mode='rollback' THEN r.approved_previous_provider_ref ELSE NULL END,
      r.actual_version,r.actual_definition,r.actual_hash_sha256,r.actual_provider_ref,'pending',true
    FROM resource r
    ON CONFLICT(resource_key,resource_version) DO NOTHING
    RETURNING *
  ), candidate AS (
    SELECT o.* FROM inserted o
    UNION ALL
    SELECT o.* FROM ccpun_admin.provider_operation o JOIN resource r
      ON r.resource_key=o.resource_key AND r.row_version=o.resource_version
    WHERE NOT EXISTS(SELECT 1 FROM inserted)
  ), leased AS (
    UPDATE ccpun_admin.provider_operation o
    SET status='leased',
      mutation_allowed=CASE WHEN c.status='reconciliation_required'
        OR (c.status='mutating' AND c.lease_expires_at<now()) THEN false ELSE c.mutation_allowed END,
      error_class=CASE WHEN c.status='mutating' AND c.lease_expires_at<now()
        THEN 'lease_expired_during_mutation' ELSE c.error_class END,
      lease_owner_digest=i.worker_digest,lease_token_digest=i.lease_token_digest,
      lease_expires_at=now()+interval '2 minutes',attempt_count=o.attempt_count+1,updated_at=now()
    FROM candidate c CROSS JOIN input i
    WHERE o.operation_id=c.operation_id
      AND (c.status IN ('pending','reconciliation_required')
        OR (c.status IN ('leased','mutating') AND c.lease_expires_at<now()))
    RETURNING o.*
  ), resource_updated AS (
    UPDATE ccpun_admin.control_resource r
    SET state='leased',last_operation_id=o.operation_id,updated_at=now()
    FROM leased o
    WHERE r.resource_key=o.resource_key AND r.row_version=o.resource_version
    RETURNING r.resource_key
  )
  SELECT o.operation_id,o.resource_key,o.resource_version,o.desired_mode,
    o.desired_version,o.desired_definition,o.desired_hash_sha256,o.desired_provider_ref,
    o.before_actual_version,o.before_actual_definition,o.before_actual_hash_sha256,
    o.before_actual_provider_ref,o.mutation_allowed,o.attempt_count
  FROM leased o
$$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_begin_provider_mutation(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $$
  WITH operation AS MATERIALIZED (
    SELECT o.* FROM ccpun_admin.provider_operation o
    WHERE o.operation_id=NULLIF(payload->>'operation_id','')::uuid FOR UPDATE
  ), resource AS MATERIALIZED (
    SELECT r.* FROM ccpun_admin.control_resource r JOIN operation o
      ON r.resource_key=o.resource_key AND r.row_version=o.resource_version
    WHERE r.desired_mode<>'hold' FOR UPDATE
  ), changed AS (
    UPDATE ccpun_admin.provider_operation o
    SET status='mutating',
      before_actual_version=COALESCE(NULLIF(payload->>'before_actual_version',''),o.before_actual_version),
      before_actual_definition=COALESCE(payload->'before_actual_definition',o.before_actual_definition),
      before_actual_hash_sha256=COALESCE(NULLIF(payload->>'before_actual_hash_sha256',''),o.before_actual_hash_sha256),
      before_actual_provider_ref=COALESCE(NULLIF(payload->>'before_actual_provider_ref',''),o.before_actual_provider_ref),
      updated_at=now()
    FROM operation locked JOIN resource r USING(resource_key)
    WHERE o.operation_id=locked.operation_id AND locked.status='leased'
      AND locked.mutation_allowed AND locked.lease_expires_at>=now()
      AND locked.lease_token_digest=payload->>'lease_token_digest'
      AND (
        payload->'before_actual_definition' IS NULL
        OR (
          jsonb_typeof(payload->'before_actual_definition')='object'
          AND payload->>'before_actual_hash_sha256' ~ '^[0-9a-f]{64}$'
          AND NULLIF(payload->>'before_actual_provider_ref','') IS NOT NULL
        )
      )
    RETURNING o.*
  ), resource_updated AS (
    UPDATE ccpun_admin.control_resource r SET state='mutating',updated_at=now()
    FROM changed o WHERE r.resource_key=o.resource_key AND r.row_version=o.resource_version
    RETURNING r.resource_key
  )
  SELECT CASE WHEN EXISTS(SELECT 1 FROM changed) THEN 'ready' ELSE 'rejected' END
$$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_checkpoint_provider_operation(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ccpun_admin
AS $$
  WITH operation AS MATERIALIZED (
    SELECT o.* FROM ccpun_admin.provider_operation o
    WHERE o.operation_id=NULLIF(payload->>'operation_id','')::uuid FOR UPDATE
  ), changed AS (
    UPDATE ccpun_admin.provider_operation o
    SET status=payload->>'outcome',mutation_allowed=false,
      provider_status_code=NULLIF(payload->>'provider_status_code','')::integer,
      error_class=NULLIF(payload->>'error_class',''),
      readback_version=NULLIF(payload->>'actual_version',''),
      readback_definition=payload->'actual_definition',
      readback_hash_sha256=NULLIF(payload->>'actual_hash_sha256',''),
      readback_provider_ref=NULLIF(payload->>'actual_provider_ref',''),
      lease_owner_digest=NULL,lease_token_digest=NULL,lease_expires_at=NULL,
      updated_at=now(),completed_at=CASE WHEN payload->>'outcome'='reconciliation_required' THEN NULL ELSE now() END
    FROM operation locked
    WHERE o.operation_id=locked.operation_id
      AND locked.status IN ('leased','mutating')
      AND locked.lease_token_digest=payload->>'lease_token_digest'
      AND payload->>'outcome' IN ('verified','reconciliation_required','failed','blocked')
      AND (payload->>'outcome'<>'verified' OR (
        jsonb_typeof(payload->'actual_definition')='object'
        AND payload->>'actual_hash_sha256' ~ '^[0-9a-f]{64}$'
        AND NULLIF(payload->>'actual_provider_ref','') IS NOT NULL
      ))
    RETURNING o.*,locked.before_actual_version AS prior_version,
      locked.before_actual_definition AS prior_definition,
      locked.before_actual_hash_sha256 AS prior_hash,
      locked.before_actual_provider_ref AS prior_ref
  ), resource_updated AS (
    UPDATE ccpun_admin.control_resource r
    SET actual_version=CASE WHEN c.status='verified' THEN c.readback_version ELSE r.actual_version END,
      actual_definition=CASE WHEN c.status='verified' THEN c.readback_definition ELSE r.actual_definition END,
      actual_hash_sha256=CASE WHEN c.status='verified' THEN c.readback_hash_sha256 ELSE r.actual_hash_sha256 END,
      actual_provider_ref=CASE WHEN c.status='verified' THEN c.readback_provider_ref ELSE r.actual_provider_ref END,
      approved_previous_version=CASE WHEN c.status='verified' AND c.prior_ref IS NOT NULL
        AND c.prior_hash IS DISTINCT FROM c.readback_hash_sha256 THEN c.prior_version ELSE r.approved_previous_version END,
      approved_previous_definition=CASE WHEN c.status='verified' AND c.prior_ref IS NOT NULL
        AND c.prior_hash IS DISTINCT FROM c.readback_hash_sha256 THEN c.prior_definition ELSE r.approved_previous_definition END,
      approved_previous_hash_sha256=CASE WHEN c.status='verified' AND c.prior_ref IS NOT NULL
        AND c.prior_hash IS DISTINCT FROM c.readback_hash_sha256 THEN c.prior_hash ELSE r.approved_previous_hash_sha256 END,
      approved_previous_provider_ref=CASE WHEN c.status='verified' AND c.prior_ref IS NOT NULL
        AND c.prior_hash IS DISTINCT FROM c.readback_hash_sha256 THEN c.prior_ref ELSE r.approved_previous_provider_ref END,
      state=c.status,last_operation_id=c.operation_id,
      last_verified_at=CASE WHEN c.status='verified' THEN now() ELSE r.last_verified_at END,
      updated_at=now()
    FROM changed c
    WHERE r.resource_key=c.resource_key AND r.row_version=c.resource_version
    RETURNING r.resource_key
  )
  SELECT CASE WHEN EXISTS(SELECT 1 FROM changed) THEN payload->>'outcome' ELSE 'stale' END
$$;

REVOKE ALL PRIVILEGES ON ccpun_admin.control_resource,ccpun_admin.control_command,
  ccpun_admin.provider_operation FROM PUBLIC,ccpun_admin_runtime;
REVOKE ALL ON FUNCTION ccpun_admin.admin_read_control_resource(text),
  ccpun_admin.admin_submit_control_command(jsonb),
  ccpun_admin.admin_claim_provider_operation(jsonb),
  ccpun_admin.admin_begin_provider_mutation(jsonb),
  ccpun_admin.admin_checkpoint_provider_operation(jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_read_control_resource(text),
  ccpun_admin.admin_submit_control_command(jsonb),
  ccpun_admin.admin_claim_provider_operation(jsonb),
  ccpun_admin.admin_begin_provider_mutation(jsonb),
  ccpun_admin.admin_checkpoint_provider_operation(jsonb)
  TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260919_provider_control_plane_v1','sha256:bfb668d37d859d3e01bdbee9ea433e5bdb835157f72ea983ce819c3c24160de1')
ON CONFLICT(version) DO NOTHING;

COMMIT;

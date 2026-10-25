-- Monthly email digest channel + generic n8n worker outbox for Admin Social.
-- UAT ONLY: the guard pins the UAT ccpun_social identity. A reviewed
-- `_production` copy is a separate, owner-approved release step.
-- Additive: new tables/function only; existing social tables, triggers and
-- grants are untouched. The runtime role never receives DELETE.
BEGIN;

DO $migration_guard$
DECLARE current_checksum text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ccpun_social:20261025_social_email_digest_v1'));
  IF current_database()<>'neondb' OR NOT EXISTS (
    SELECT 1 FROM ccpun_social.system_identity WHERE singleton AND database_name='neondb'
      AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8'
      AND endpoint_id='ep-mute-frost-aztvz394'
  ) THEN RAISE EXCEPTION 'SOCIAL_EMAIL_DIGEST_TARGET_MISMATCH'; END IF;
  IF NOT EXISTS (SELECT 1 FROM ccpun_social.schema_migration
    WHERE version='20261004_social_operation_receipts_v1'
      AND checksum='sha256:1917b07e95bd84bf8e908a54dbaf80eefbe17ee1071b637d1ec7685b1f2940b3')
  THEN RAISE EXCEPTION 'SOCIAL_EMAIL_DIGEST_PREREQUISITE_MISSING'; END IF;
  IF NOT has_table_privilege('ccpun_social_runtime','ccpun_social.social_execution_audit','INSERT')
    OR has_table_privilege('ccpun_social_runtime','ccpun_social.social_execution_audit','UPDATE,DELETE,TRUNCATE')
  THEN RAISE EXCEPTION 'SOCIAL_EMAIL_DIGEST_AUDIT_PRIVILEGE_MISMATCH'; END IF;
  SELECT checksum INTO current_checksum FROM ccpun_social.schema_migration
    WHERE version='20261025_social_email_digest_v1';
  IF current_checksum IS NOT NULL AND current_checksum<>'sha256:b5cc30b064ab9713a1131122eb9ac6cdc6ee14a45e2e50e2d3b7ce9795afc695'
  THEN RAISE EXCEPTION 'SOCIAL_EMAIL_DIGEST_CHECKSUM_MISMATCH'; END IF;
  IF current_checksum IS NULL AND (to_regclass('ccpun_social.social_email_digest') IS NOT NULL
    OR to_regclass('ccpun_social.social_worker_job') IS NOT NULL
    OR to_regclass('ccpun_social.social_worker_request_nonce') IS NOT NULL
    OR to_regprocedure('ccpun_social.social_require_write(boolean,text)') IS NOT NULL)
  THEN RAISE EXCEPTION 'SOCIAL_EMAIL_DIGEST_UNTRACKED_SCHEMA'; END IF;
END
$migration_guard$;

-- checksum-source-begin
CREATE TABLE IF NOT EXISTS ccpun_social.social_email_digest (
  id text PRIMARY KEY CHECK (id ~ '^email-digest:[a-f0-9-]{36}$'),
  month text NOT NULL CHECK (month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 150),
  preheader text NOT NULL DEFAULT '' CHECK (length(preheader) <= 200),
  intro text NOT NULL DEFAULT '' CHECK (length(intro) <= 4000),
  closing text CHECK (closing IS NULL OR length(closing) <= 1000),
  articles jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(articles)='array' AND jsonb_array_length(articles) <= 20),
  status text NOT NULL CHECK (status IN ('draft','reviewed','scheduled','sent','cancelled')),
  version integer NOT NULL CHECK (version >= 1),
  content_version integer NOT NULL CHECK (content_version >= 1),
  reviewed_content_version integer,
  reviewed_at timestamptz,
  reviewed_by_ref text CHECK (reviewed_by_ref IS NULL OR reviewed_by_ref ~ '^admin:[a-f0-9]{32}$'),
  scheduled_at timestamptz,
  job_id text CHECK (job_id IS NULL OR job_id ~ '^worker-job:[a-f0-9]{32}$'),
  sent_at timestamptz,
  created_by_ref text NOT NULL CHECK (created_by_ref ~ '^admin:[a-f0-9]{32}$'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  mutation_receipts jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(mutation_receipts)='object' AND octet_length(mutation_receipts::text) <= 262144),
  CHECK (status NOT IN ('reviewed','scheduled','sent') OR reviewed_content_version = content_version),
  CHECK (status <> 'scheduled' OR (job_id IS NOT NULL AND scheduled_at IS NOT NULL)),
  CHECK (status <> 'sent' OR (job_id IS NOT NULL AND sent_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS social_email_digest_active_month
  ON ccpun_social.social_email_digest (month) WHERE status <> 'cancelled';

-- Generic outbox for heavy work executed by the n8n worker (no secrets, no personal data).
CREATE TABLE IF NOT EXISTS ccpun_social.social_worker_job (
  id text PRIMARY KEY CHECK (id ~ '^worker-job:[a-f0-9]{32}$'),
  channel text NOT NULL CHECK (channel IN ('email_digest')),
  action text NOT NULL CHECK (action IN ('send_digest')),
  object_id text NOT NULL CHECK (length(object_id) BETWEEN 1 AND 120),
  object_version integer NOT NULL CHECK (object_version >= 1),
  scheduled_at timestamptz NOT NULL,
  idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^[A-Za-z0-9_.:-]{16,120}$'),
  status text NOT NULL CHECK (status IN ('queued','claimed','succeeded','failed','needs_attention','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 100),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 100),
  claim_token text CHECK (claim_token IS NULL OR claim_token ~ '^[a-f0-9]{32}$'),
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  last_error_code text CHECK (last_error_code IS NULL OR last_error_code ~ '^[a-z0-9][a-z0-9_.-]{0,59}$'),
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(external_ids)='object' AND octet_length(external_ids::text) <= 4096),
  version integer NOT NULL CHECK (version >= 1),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz,
  mutation_receipts jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(mutation_receipts)='object' AND octet_length(mutation_receipts::text) <= 65536),
  CHECK (status <> 'claimed' OR (claim_token IS NOT NULL AND claim_expires_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS social_worker_job_status_scheduled
  ON ccpun_social.social_worker_job (status, scheduled_at);

CREATE TABLE IF NOT EXISTS ccpun_social.social_worker_request_nonce (
  nonce text PRIMARY KEY CHECK (nonce ~ '^[A-Za-z0-9_-]{16,64}$'),
  seen_at timestamptz NOT NULL DEFAULT now()
);

-- Aborts a multi-CTE write when only part of a planned change would commit.
CREATE OR REPLACE FUNCTION ccpun_social.social_require_write(ok boolean, code text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $require_write$
BEGIN
  IF ok IS NOT TRUE THEN RAISE EXCEPTION USING ERRCODE='40001', MESSAGE=code; END IF;
  RETURN true;
END
$require_write$;

REVOKE ALL PRIVILEGES ON ccpun_social.social_email_digest, ccpun_social.social_worker_job,
  ccpun_social.social_worker_request_nonce FROM ccpun_social_runtime;
REVOKE ALL ON FUNCTION ccpun_social.social_require_write(boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ccpun_social.social_require_write(boolean,text) TO ccpun_social_runtime;
GRANT SELECT, INSERT ON ccpun_social.social_email_digest, ccpun_social.social_worker_job TO ccpun_social_runtime;
GRANT UPDATE (month, subject, preheader, intro, closing, articles, status, version, content_version,
  reviewed_content_version, reviewed_at, reviewed_by_ref, scheduled_at, job_id, sent_at, updated_at, mutation_receipts)
  ON ccpun_social.social_email_digest TO ccpun_social_runtime;
GRANT UPDATE (scheduled_at, status, attempts, max_attempts, claim_token, claimed_at, claim_expires_at,
  last_error_code, external_ids, version, updated_at, completed_at, mutation_receipts)
  ON ccpun_social.social_worker_job TO ccpun_social_runtime;
GRANT INSERT ON ccpun_social.social_worker_request_nonce TO ccpun_social_runtime;
GRANT SELECT (nonce) ON ccpun_social.social_worker_request_nonce TO ccpun_social_runtime;
-- checksum-source-end

INSERT INTO ccpun_social.schema_migration(version,checksum)
VALUES('20261025_social_email_digest_v1','sha256:b5cc30b064ab9713a1131122eb9ac6cdc6ee14a45e2e50e2d3b7ce9795afc695') ON CONFLICT(version) DO NOTHING;
COMMIT;

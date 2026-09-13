BEGIN;

CREATE SCHEMA IF NOT EXISTS ccpun_admin;

CREATE TABLE IF NOT EXISTS ccpun_admin.schema_migration (
  version text PRIMARY KEY,
  checksum text NOT NULL CHECK (checksum ~ '^sha256:[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now()
);

DO $migration_guard$
DECLARE
  current_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN
    RAISE EXCEPTION 'CCPUN Production Admin operations migration requires database neondb';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ccpun_admin:20260913_admin_operations_production_v1'));
  SELECT checksum INTO current_checksum
  FROM ccpun_admin.schema_migration
  WHERE version = '20260913_admin_operations_production_v1';

  IF current_checksum IS NOT NULL AND current_checksum <> 'sha256:5895b0882bf199c2017e761b15d87cac5a94bab44c5c832f68fa2b3cf385ac51' THEN
    RAISE EXCEPTION 'CCPUN Production Admin operations migration checksum mismatch';
  END IF;

  IF current_checksum IS NULL AND (
    to_regclass('ccpun_admin.audit_log') IS NOT NULL OR
    to_regclass('ccpun_admin.research_snapshot') IS NOT NULL OR
    to_regclass('ccpun_admin.seo_suggestion') IS NOT NULL OR
    to_regclass('ccpun_admin.system_identity') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'CCPUN Production Admin operations schema exists without the current migration ledger';
  END IF;
END
$migration_guard$;

-- checksum-source-begin
CREATE TABLE IF NOT EXISTS ccpun_admin.system_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  project_id text NOT NULL CHECK (project_id = 'lively-bar-43618798'),
  branch_id text NOT NULL CHECK (branch_id = 'br-long-resonance-b3ys5xrv'),
  endpoint_id text NOT NULL CHECK (endpoint_id = 'ep-broad-butterfly-b3ro7u8w'),
  database_name text NOT NULL CHECK (database_name = 'neondb'),
  migration_version text NOT NULL CHECK (migration_version = '20260913_admin_operations_production_v1'),
  migration_checksum text NOT NULL CHECK (migration_checksum ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ccpun_admin.audit_log (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 220),
  actor text NOT NULL CHECK (length(actor) BETWEEN 1 AND 320),
  actor_type text NOT NULL CHECK (actor_type IN ('human', 'ai', 'system')),
  action text NOT NULL CHECK (action ~ '^[a-z0-9:-]{1,100}$'),
  object_type text NOT NULL CHECK (length(object_type) BETWEEN 1 AND 100),
  object_id text NOT NULL CHECK (length(object_id) BETWEEN 1 AND 220),
  before_json jsonb,
  after_json jsonb,
  request_id uuid NOT NULL,
  environment text NOT NULL CHECK (length(environment) BETWEEN 1 AND 40),
  occurred_at timestamptz NOT NULL,
  source_project_id text,
  source_dataset text,
  source_document_id text,
  source_revision text,
  source_hash_sha256 text CHECK (source_hash_sha256 IS NULL OR source_hash_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_occurred_at_idx
  ON ccpun_admin.audit_log (occurred_at DESC);

CREATE TABLE IF NOT EXISTS ccpun_admin.research_snapshot (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 220),
  keyword text NOT NULL CHECK (length(keyword) BETWEEN 1 AND 500),
  keyword_key text NOT NULL CHECK (length(keyword_key) BETWEEN 1 AND 500),
  provider text NOT NULL CHECK (provider IN ('manual', 'ubersuggest', 'gsc', 'serp')),
  scope text,
  location text,
  language text,
  volume double precision,
  difficulty double precision,
  intent text,
  serp_json jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(serp_json) = 'array'),
  competitors_json jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(competitors_json) = 'array'),
  trust_class text NOT NULL DEFAULT 'untrusted-external-data',
  checked_at timestamptz NOT NULL,
  source_project_id text,
  source_dataset text,
  source_document_id text,
  source_revision text,
  source_hash_sha256 text CHECK (source_hash_sha256 IS NULL OR source_hash_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_snapshot_fresh_idx
  ON ccpun_admin.research_snapshot (provider, keyword_key, checked_at DESC);

CREATE TABLE IF NOT EXISTS ccpun_admin.seo_suggestion (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 220),
  target_document_id text NOT NULL CHECK (length(target_document_id) BETWEEN 1 AND 220),
  target_revision text NOT NULL CHECK (length(target_revision) BETWEEN 1 AND 220),
  suggestion_type text NOT NULL CHECK (suggestion_type IN ('seo-title', 'meta-description', 'primary-keyword', 'secondary-keywords', 'search-intent', 'structure', 'internal-links', 'content')),
  before_value text,
  after_value text NOT NULL CHECK (length(after_value) BETWEEN 1 AND 12000),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 8000),
  confidence double precision NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_json) = 'array'),
  status text NOT NULL CHECK (status IN ('proposed', 'automated-review', 'needs-human-review', 'approved', 'rejected', 'applied', 'published', 'reconciliation-required')),
  created_by text NOT NULL CHECK (length(created_by) BETWEEN 1 AND 320),
  created_at timestamptz NOT NULL,
  edited_by text,
  edited_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  rejection_reason text,
  approved_after text,
  approved_base_value text,
  approved_type text,
  approved_risk_level text,
  approved_target_id text,
  approved_target_revision text,
  applied_by text,
  applied_at timestamptz,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  apply_request_id uuid,
  apply_state text CHECK (apply_state IN ('claimed', 'reconciliation-required', 'completed')),
  apply_claimed_at timestamptz,
  applied_target_revision text,
  reconciliation_reason text,
  source_project_id text,
  source_dataset text,
  source_document_id text,
  source_revision text,
  source_hash_sha256 text CHECK (source_hash_sha256 IS NULL OR source_hash_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (apply_request_id),
  CHECK ((apply_state IS NULL) = (apply_request_id IS NULL))
);

CREATE INDEX IF NOT EXISTS seo_suggestion_queue_idx
  ON ccpun_admin.seo_suggestion (created_at DESC);

DO $runtime_role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_admin_runtime') THEN
    CREATE ROLE ccpun_admin_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  ELSE
    ALTER ROLE ccpun_admin_runtime WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$runtime_role$;

GRANT CONNECT ON DATABASE neondb TO ccpun_admin_runtime;
GRANT USAGE ON SCHEMA ccpun_admin TO ccpun_admin_runtime;
REVOKE ALL PRIVILEGES ON ccpun_admin.system_identity, ccpun_admin.schema_migration,
  ccpun_admin.audit_log, ccpun_admin.research_snapshot, ccpun_admin.seo_suggestion
  FROM ccpun_admin_runtime;
GRANT SELECT ON ccpun_admin.system_identity, ccpun_admin.schema_migration TO ccpun_admin_runtime;
GRANT SELECT, INSERT ON ccpun_admin.audit_log, ccpun_admin.research_snapshot TO ccpun_admin_runtime;
GRANT SELECT, INSERT ON ccpun_admin.seo_suggestion TO ccpun_admin_runtime;
GRANT UPDATE (
  after_value, reason, status, edited_by, edited_at, reviewed_by, reviewed_at, rejection_reason,
  approved_after, approved_base_value, approved_type, approved_risk_level, approved_target_id,
  approved_target_revision, applied_by, applied_at, row_version, apply_request_id, apply_state,
  apply_claimed_at, applied_target_revision, reconciliation_reason, updated_at
) ON ccpun_admin.seo_suggestion TO ccpun_admin_runtime;

DO $social_revoke$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ccpun_social') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON SCHEMA ccpun_social FROM ccpun_admin_runtime';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ccpun_social FROM ccpun_admin_runtime';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ccpun_social FROM ccpun_admin_runtime';
  END IF;
END
$social_revoke$;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration (version, checksum)
VALUES (
  '20260913_admin_operations_production_v1',
  'sha256:5895b0882bf199c2017e761b15d87cac5a94bab44c5c832f68fa2b3cf385ac51'
)
ON CONFLICT (version) DO NOTHING;

INSERT INTO ccpun_admin.system_identity (
  singleton, project_id, branch_id, endpoint_id, database_name, migration_version, migration_checksum
) VALUES (
  true,
  'lively-bar-43618798',
  'br-long-resonance-b3ys5xrv',
  'ep-broad-butterfly-b3ro7u8w',
  'neondb',
  '20260913_admin_operations_production_v1',
  'sha256:5895b0882bf199c2017e761b15d87cac5a94bab44c5c832f68fa2b3cf385ac51'
)
ON CONFLICT (singleton) DO UPDATE SET
  project_id = EXCLUDED.project_id,
  branch_id = EXCLUDED.branch_id,
  endpoint_id = EXCLUDED.endpoint_id,
  database_name = EXCLUDED.database_name,
  migration_version = EXCLUDED.migration_version,
  migration_checksum = EXCLUDED.migration_checksum;

REVOKE ALL ON SCHEMA ccpun_admin FROM PUBLIC;
REVOKE ALL ON ccpun_admin.system_identity, ccpun_admin.schema_migration,
  ccpun_admin.audit_log, ccpun_admin.research_snapshot, ccpun_admin.seo_suggestion FROM PUBLIC;

COMMIT;

import { createHash } from "node:crypto";

export const ARTICLE_SCHEDULER_MIGRATION = "20260911_article_scheduling_v1";

// This source is immutable after rollout. Changes require a new migration version.
const ddl = String.raw`
CREATE SCHEMA IF NOT EXISTS ccpun_admin;
CREATE TABLE IF NOT EXISTS ccpun_admin.article_scheduler_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  lane text NOT NULL CHECK (lane IN ('uat','production')),
  project_id text NOT NULL, branch_id text NOT NULL, endpoint_id text NOT NULL,
  database_name text NOT NULL CHECK (database_name='neondb'),
  sanity_project_id text NOT NULL, sanity_dataset text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('publish','validate-only')),
  enabled boolean NOT NULL DEFAULT false,
  migration_version text NOT NULL, migration_checksum text NOT NULL
);
CREATE TABLE IF NOT EXISTS ccpun_admin.article_schedule (
  article_id text PRIMARY KEY CHECK (length(article_id) BETWEEN 1 AND 128 AND article_id ~ '^[A-Za-z0-9_][A-Za-z0-9_.-]*$' AND article_id !~ '^(drafts\.|versions\.)'),
  generation uuid NOT NULL UNIQUE,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version>0),
  draft_revision text NOT NULL CHECK (length(draft_revision) BETWEEN 1 AND 200),
  published_revision text CHECK (length(published_revision) BETWEEN 1 AND 200),
  scheduled_at timestamptz NOT NULL CHECK (isfinite(scheduled_at)),
  timezone text NOT NULL DEFAULT 'Asia/Bangkok' CHECK (timezone='Asia/Bangkok'),
  mode text NOT NULL CHECK (mode IN ('publish','validate-only')),
  status text NOT NULL CHECK (status IN ('preparing','scheduled','executing','published','validated','cancelled','stale','failed','reconciliation-required')),
  created_by text NOT NULL CHECK (length(created_by) BETWEEN 1 AND 320),
  workflow_run_id text CHECK (length(workflow_run_id) BETWEEN 1 AND 200),
  execution_id uuid, lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz,
  error_code text CHECK (error_code ~ '^[A-Z0-9_]{1,80}$'),
  transaction_id text CHECK (length(transaction_id) BETWEEN 1 AND 200),
  CHECK (status NOT IN ('scheduled','executing','published','validated') OR workflow_run_id IS NOT NULL),
  CHECK (status<>'executing' OR (execution_id IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK (status<>'published' OR (mode='publish' AND transaction_id IS NOT NULL)),
  CHECK (status<>'validated' OR mode='validate-only')
);
CREATE TABLE IF NOT EXISTS ccpun_admin.article_schedule_audit (
  generation uuid NOT NULL, row_version bigint NOT NULL,
  article_id text NOT NULL, status text NOT NULL, actor text NOT NULL,
  scheduled_at timestamptz NOT NULL, draft_revision text NOT NULL,
  published_revision text, error_code text, transaction_id text,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (generation,row_version)
);
CREATE INDEX IF NOT EXISTS article_schedule_due ON ccpun_admin.article_schedule(scheduled_at) WHERE status='scheduled';
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime') THEN
    CREATE ROLE ccpun_admin_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime' AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Unsafe existing runtime role';
  END IF;
END $role$;
REVOKE ALL ON SCHEMA ccpun_admin FROM PUBLIC;
REVOKE ALL ON ccpun_admin.article_scheduler_identity, ccpun_admin.article_schedule, ccpun_admin.article_schedule_audit FROM PUBLIC;
GRANT USAGE ON SCHEMA ccpun_admin TO ccpun_admin_runtime;
GRANT SELECT ON ccpun_admin.article_scheduler_identity, ccpun_admin.article_schedule, ccpun_admin.article_schedule_audit TO ccpun_admin_runtime;
GRANT INSERT ON ccpun_admin.article_schedule, ccpun_admin.article_schedule_audit TO ccpun_admin_runtime;
GRANT UPDATE (generation,row_version,draft_revision,published_revision,scheduled_at,mode,status,created_by,workflow_run_id,execution_id,lease_expires_at,updated_at,completed_at,error_code,transaction_id)
  ON ccpun_admin.article_schedule TO ccpun_admin_runtime;
`;
export const ARTICLE_SCHEDULER_CHECKSUM = `sha256:${createHash("sha256").update(ddl).digest("hex")}`;

export function buildArticleSchedulerMigration(lane: "uat" | "production"): string {
  if (lane !== "uat" && lane !== "production") throw new Error("INVALID_MIGRATION_LANE");
  const identity = lane === "uat"
    ? { project: "young-term-47483330", branch: "br-crimson-mouse-az7ajkv8", endpoint: "ep-mute-frost-aztvz394", sanity: "ccb9lnw5", dataset: "uat", mode: "validate-only", control: "ccpun_admin.system_identity" }
    : { project: "lively-bar-43618798", branch: "br-long-resonance-b3ys5xrv", endpoint: "ep-broad-butterfly-b3ro7u8w", sanity: "kyfxgjnq", dataset: "production", mode: "publish", control: "ccpun_social.system_identity" };
  return `BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:article-scheduler-v1'));
DO $guard$
BEGIN
  IF current_database()<>'neondb' OR current_user NOT IN ('neondb_owner','cloud_admin') THEN
    RAISE EXCEPTION 'Migration requires the authorized database owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ${identity.control} WHERE singleton=true AND project_id='${identity.project}' AND branch_id='${identity.branch}' AND endpoint_id='${identity.endpoint}' AND database_name='neondb') THEN
    RAISE EXCEPTION 'Migration data-plane mismatch';
  END IF;
  IF to_regclass('ccpun_admin.article_scheduler_identity') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM ccpun_admin.article_scheduler_identity WHERE singleton=true AND lane='${lane}' AND migration_version='${ARTICLE_SCHEDULER_MIGRATION}' AND migration_checksum='${ARTICLE_SCHEDULER_CHECKSUM}') THEN
      RAISE EXCEPTION 'Scheduler identity or migration checksum mismatch';
    END IF;
  ELSIF to_regclass('ccpun_admin.article_schedule') IS NOT NULL OR to_regclass('ccpun_admin.article_schedule_audit') IS NOT NULL THEN
    RAISE EXCEPTION 'Untracked scheduler tables';
  END IF;
END $guard$;
${ddl}
INSERT INTO ccpun_admin.article_scheduler_identity
(singleton,lane,project_id,branch_id,endpoint_id,database_name,sanity_project_id,sanity_dataset,mode,enabled,migration_version,migration_checksum)
VALUES (true,'${lane}','${identity.project}','${identity.branch}','${identity.endpoint}','neondb','${identity.sanity}','${identity.dataset}','${identity.mode}',false,'${ARTICLE_SCHEDULER_MIGRATION}','${ARTICLE_SCHEDULER_CHECKSUM}')
ON CONFLICT (singleton) DO NOTHING;
COMMIT;`;
}

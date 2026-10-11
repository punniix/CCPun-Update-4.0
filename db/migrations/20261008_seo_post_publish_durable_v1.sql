-- Install with an owner credential, only after UAT migration review.
-- No UAT or Production provider/API credential is stored in this migration.
BEGIN;
-- Single-statement identity gate, compatible with Neon migration tooling.
-- Zero denominator deliberately prevents modifications on an unrecognized branch.
SELECT 1 / (CASE WHEN current_database()='neondb' AND EXISTS (
  SELECT 1 FROM ccpun_admin.system_identity WHERE singleton=true
    AND (project_id,branch_id) IN (
      ('young-term-47483330','br-crimson-mouse-az7ajkv8'),
      ('lively-bar-43618798','br-long-resonance-b3ys5xrv')
    )
) THEN 1 ELSE 0 END) AS source_identity_accepted;

CREATE TABLE IF NOT EXISTS ccpun_admin.seo_post_publish_job (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id text NOT NULL CHECK (length(article_id) BETWEEN 1 AND 200 AND article_id ~ '^[A-Za-z0-9._-]+$'),
  content_version timestamptz NOT NULL,
  source text NOT NULL CHECK (source IN ('owner','reconciler')),
  owner_approved boolean NOT NULL DEFAULT false,
  actor text NOT NULL,
  request_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued','processing','completed','retry-required','reconciliation-required')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_id uuid,
  lease_until timestamptz,
  sitemap_attempted boolean NOT NULL DEFAULT false,
  last_error_code text,
  result_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(article_id, content_version),
  CHECK (octet_length(coalesce(result_json::text,'')) <= 30000)
);
CREATE INDEX IF NOT EXISTS seo_post_publish_eligible_v1
 ON ccpun_admin.seo_post_publish_job(next_attempt_at, created_at)
 WHERE state = 'queued';
REVOKE ALL ON ccpun_admin.seo_post_publish_job FROM PUBLIC;
-- Preflight confirms the original Admin runtime role exists. The worker role
-- is created NOLOGIN and can be made a scoped LOGIN only by the owner.
SELECT 1 / (CASE WHEN EXISTS (SELECT 1 FROM pg_roles
  WHERE rolname='ccpun_admin_runtime') THEN 1 ELSE 0 END)
  AS admin_runtime_role_accepted;
CREATE ROLE ccpun_seo_post_publish_worker NOLOGIN;
GRANT USAGE ON SCHEMA ccpun_admin TO ccpun_seo_post_publish_worker;
GRANT SELECT, INSERT ON ccpun_admin.seo_post_publish_job TO ccpun_admin_runtime;
GRANT UPDATE(owner_approved) ON ccpun_admin.seo_post_publish_job TO ccpun_admin_runtime;
GRANT SELECT, INSERT, UPDATE ON ccpun_admin.seo_post_publish_job TO ccpun_seo_post_publish_worker;
-- Operator must explicitly provision scoped LOGIN credentials on VPS only, not on Hostinger Cloud Admin.
COMMIT;

-- Install with an owner credential, only after UAT migration review.
-- No UAT or Production provider/API credential is stored in this migration.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'neondb' OR NOT EXISTS (
    SELECT 1 FROM ccpun_admin.system_identity
    WHERE singleton = true
      AND (project_id, branch_id) IN (
        ('young-term-47483330','br-crimson-mouse-az7ajkv8'),
        ('lively-bar-43618798','br-long-resonance-b3ys5xrv')
      )
  ) THEN RAISE EXCEPTION 'SEO_POST_PUBLISH_DATABASE_IDENTITY_MISMATCH'; END IF;
END $$;

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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_admin_runtime')
  THEN RAISE EXCEPTION 'SEO_POST_PUBLISH_ADMIN_RUNTIME_ROLE_MISSING'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_seo_post_publish_worker')
  THEN CREATE ROLE ccpun_seo_post_publish_worker NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA ccpun_admin TO ccpun_seo_post_publish_worker;
GRANT SELECT, INSERT ON ccpun_admin.seo_post_publish_job TO ccpun_admin_runtime;
GRANT UPDATE(owner_approved) ON ccpun_admin.seo_post_publish_job TO ccpun_admin_runtime;
GRANT SELECT, INSERT, UPDATE ON ccpun_admin.seo_post_publish_job TO ccpun_seo_post_publish_worker;
-- Operator must explicitly provision scoped LOGIN credentials on VPS only, not on Hostinger Cloud Admin.
COMMIT;

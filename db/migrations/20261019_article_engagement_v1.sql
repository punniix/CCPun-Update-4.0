-- Apply only after native Neon target verification and dedicated role creation.
-- Runtime has no table privileges; all entry points use fixed-search-path SQL.
BEGIN;
SET LOCAL statement_timeout = '15s';
SELECT pg_advisory_xact_lock(hashtext('ccpun_article:20261019_article_engagement_v1'));
CREATE SCHEMA IF NOT EXISTS ccpun_article;
REVOKE ALL ON SCHEMA ccpun_article FROM PUBLIC;
CREATE TABLE IF NOT EXISTS ccpun_article.schema_migration (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
DO $guard$
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'Incorrect article database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_article_runtime') THEN
    RAISE EXCEPTION 'Create dedicated ccpun_article_runtime role through native Neon first';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_article_runtime'
    AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = 'ccpun_article_runtime'::regrole)
  THEN RAISE EXCEPTION 'Article runtime role has excessive privileges or memberships'; END IF;
  -- Includes effective PUBLIC/inherited access: never silently change other schemas.
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema','ccpun_article')
      AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'
      AND c.relkind IN ('r','p','v','m','f')
      AND has_table_privilege('ccpun_article_runtime',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  ) OR EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema','ccpun_article')
      AND p.prosecdef AND has_schema_privilege('ccpun_article_runtime',n.oid,'USAGE')
      AND has_function_privilege('ccpun_article_runtime',p.oid,'EXECUTE')
  ) THEN RAISE EXCEPTION 'Article runtime can access another application data plane'; END IF;
  IF EXISTS (SELECT 1 FROM ccpun_article.schema_migration
    WHERE version = '20261019_article_engagement_v1' AND checksum <> 'sha256:3e80a2ab8492b18c66bc1b83d4be952e23d25de0be0889d291916120a873f9da')
  THEN RAISE EXCEPTION 'Article migration checksum mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM ccpun_article.schema_migration WHERE version = '20261019_article_engagement_v1')
    AND (to_regclass('ccpun_article.metrics') IS NOT NULL OR to_regclass('ccpun_article.activation') IS NOT NULL
      OR to_regclass('ccpun_article.event_nonce') IS NOT NULL OR to_regclass('ccpun_article.heart_state') IS NOT NULL)
  THEN RAISE EXCEPTION 'Article tables exist without a migration record'; END IF;
END
$guard$;

-- checksum-source-begin
CREATE TABLE IF NOT EXISTS ccpun_article.activation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  activated_at timestamptz NOT NULL DEFAULT now(),
  history_from date NOT NULL,
  history_through date NOT NULL,
  history_coverage text NOT NULL CHECK (history_coverage = 'partial'),
  views_source_sha256 text NOT NULL CHECK (views_source_sha256 ~ '^[0-9a-f]{64}$'),
  shares_source_sha256 text NOT NULL CHECK (shares_source_sha256 ~ '^[0-9a-f]{64}$')
);
INSERT INTO ccpun_article.activation(singleton,history_from,history_through,history_coverage,views_source_sha256,shares_source_sha256)
VALUES (true,'2023-09-29','2026-10-16','partial',
  '30c7d6ee09276291043d27f60cb7e8fc66fb68087c1728a0f29ed6c367a7927e',
  'c5115bac6edf79518c33915bbdfe1f59c39a304e91063bdbeb945799f9b3dc38')
ON CONFLICT (singleton) DO UPDATE SET history_from = excluded.history_from, history_through = excluded.history_through,
  history_coverage = excluded.history_coverage, views_source_sha256 = excluded.views_source_sha256,
  shares_source_sha256 = excluded.shares_source_sha256;

CREATE TABLE IF NOT EXISTS ccpun_article.metrics (
  article_id text PRIMARY KEY CHECK (article_id ~ '^[A-Za-z0-9_.-]{1,128}$' AND article_id NOT LIKE 'drafts.%'),
  baseline_views bigint CHECK (baseline_views >= 0),
  baseline_shares bigint CHECK (baseline_shares >= 0),
  baseline_hearts bigint CHECK (baseline_hearts >= 0),
  new_views bigint NOT NULL DEFAULT 0 CHECK (new_views >= 0),
  new_shares bigint NOT NULL DEFAULT 0 CHECK (new_shares >= 0),
  new_hearts bigint NOT NULL DEFAULT 0 CHECK (new_hearts >= 0)
);
-- Historical openings (not unique people/lifetime). Unknown stays NULL.
-- Tax shares are the specifically approved recorded GA4 zero, not proof of coverage.
INSERT INTO ccpun_article.metrics(article_id,baseline_views,baseline_shares,baseline_hearts) VALUES
  ('91b217d8-72f3-4e8b-a217-bed78cac437c', 2, 0, NULL),
  ('ccpun-article-aia-health-ci-hero-guide', 35, NULL, NULL),
  ('ccpun-article-aia-health-happy-describe', 76, NULL, NULL),
  ('ccpun-article-aia-senior-happy', 13, NULL, NULL),
  ('ccpun-article-aia-vitality', 59, NULL, NULL),
  ('ccpun-article-copayment-vs-deductible-health-insurance', NULL, NULL, NULL),
  ('ccpun-article-critical-illness-insurance', 28, NULL, NULL),
  ('ccpun-article-financial-pyramid', 37, NULL, NULL),
  ('ccpun-article-tax-deduction', 7, NULL, NULL),
  ('ccpun-motor-car-insurance-types', 8, NULL, NULL),
  ('f07d8601-41b1-4b70-b81f-3462694f9250', 11, NULL, NULL)
ON CONFLICT (article_id) DO UPDATE SET baseline_views = excluded.baseline_views,
  baseline_shares = excluded.baseline_shares, baseline_hearts = excluded.baseline_hearts;

CREATE TABLE IF NOT EXISTS ccpun_article.event_nonce (
  article_id text NOT NULL REFERENCES ccpun_article.metrics(article_id),
  event_type text NOT NULL CHECK (event_type IN ('view','share')),
  event_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(article_id,event_type,event_id)
);
CREATE TABLE IF NOT EXISTS ccpun_article.heart_state (
  article_id text NOT NULL REFERENCES ccpun_article.metrics(article_id),
  heart_hash text NOT NULL CHECK (heart_hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY(article_id,heart_hash)
);

CREATE OR REPLACE FUNCTION ccpun_article.read_article_metrics(p_article_id text,p_heart_hash text DEFAULT NULL)
RETURNS TABLE(views bigint,shares bigint,hearts bigint,liked boolean,activated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
BEGIN
  IF p_article_id IS NULL OR p_article_id !~ '^[A-Za-z0-9_.-]{1,128}$' OR p_article_id LIKE 'drafts.%'
    OR (p_heart_hash IS NOT NULL AND p_heart_hash !~ '^[0-9a-f]{64}$')
  THEN RAISE EXCEPTION 'Invalid article metric input'; END IF;
  RETURN QUERY SELECT
    CASE WHEN m.baseline_views IS NOT NULL THEN m.baseline_views + m.new_views WHEN m.new_views > 0 THEN m.new_views ELSE NULL END,
    CASE WHEN m.baseline_shares IS NOT NULL THEN m.baseline_shares + m.new_shares WHEN m.new_shares > 0 THEN m.new_shares ELSE NULL END,
    CASE WHEN m.baseline_hearts IS NOT NULL THEN m.baseline_hearts + m.new_hearts WHEN m.new_hearts > 0 THEN m.new_hearts ELSE NULL END,
    EXISTS(SELECT 1 FROM ccpun_article.heart_state h WHERE h.article_id = p_article_id AND h.heart_hash = p_heart_hash),
    a.activated_at
  FROM ccpun_article.activation a LEFT JOIN ccpun_article.metrics m ON m.article_id = p_article_id
  WHERE a.singleton;
END
$function$;

CREATE OR REPLACE FUNCTION ccpun_article.record_article_event(p_article_id text,p_event_type text,p_event_id uuid,p_heart_hash text DEFAULT NULL)
RETURNS TABLE(views bigint,shares bigint,hearts bigint,liked boolean,activated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE inserted_count integer;
BEGIN
  IF p_article_id IS NULL OR p_article_id !~ '^[A-Za-z0-9_.-]{1,128}$' OR p_article_id LIKE 'drafts.%'
    OR p_event_type IS NULL OR p_event_type NOT IN ('view','share') OR p_event_id IS NULL
    OR (p_heart_hash IS NOT NULL AND p_heart_hash !~ '^[0-9a-f]{64}$')
  THEN RAISE EXCEPTION 'Invalid article event input'; END IF;
  INSERT INTO ccpun_article.metrics(article_id) VALUES (p_article_id) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM ccpun_article.metrics m WHERE m.article_id = p_article_id FOR UPDATE;
  INSERT INTO ccpun_article.event_nonce(article_id,event_type,event_id) VALUES(p_article_id,p_event_type,p_event_id) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 1 THEN
    UPDATE ccpun_article.metrics m SET new_views = m.new_views + CASE WHEN p_event_type = 'view' THEN 1 ELSE 0 END,
      new_shares = m.new_shares + CASE WHEN p_event_type = 'share' THEN 1 ELSE 0 END WHERE m.article_id = p_article_id;
  END IF;
  RETURN QUERY SELECT * FROM ccpun_article.read_article_metrics(p_article_id,p_heart_hash);
END
$function$;

CREATE OR REPLACE FUNCTION ccpun_article.set_article_heart(p_article_id text,p_heart_hash text,p_liked boolean)
RETURNS TABLE(views bigint,shares bigint,hearts bigint,liked boolean,activated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE changed_count integer;
BEGIN
  IF p_article_id IS NULL OR p_article_id !~ '^[A-Za-z0-9_.-]{1,128}$' OR p_article_id LIKE 'drafts.%'
    OR p_heart_hash IS NULL OR p_heart_hash !~ '^[0-9a-f]{64}$' OR p_liked IS NULL
  THEN RAISE EXCEPTION 'Invalid article heart input'; END IF;
  INSERT INTO ccpun_article.metrics(article_id) VALUES (p_article_id) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM ccpun_article.metrics m WHERE m.article_id = p_article_id FOR UPDATE;
  IF p_liked THEN
    INSERT INTO ccpun_article.heart_state(article_id,heart_hash) VALUES(p_article_id,p_heart_hash) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS changed_count = ROW_COUNT;
    IF changed_count = 1 THEN UPDATE ccpun_article.metrics m SET new_hearts = m.new_hearts + 1 WHERE m.article_id = p_article_id; END IF;
  ELSE
    DELETE FROM ccpun_article.heart_state h WHERE h.article_id = p_article_id AND h.heart_hash = p_heart_hash;
    GET DIAGNOSTICS changed_count = ROW_COUNT;
    IF changed_count = 1 THEN UPDATE ccpun_article.metrics m SET new_hearts = m.new_hearts - 1 WHERE m.article_id = p_article_id; END IF;
  END IF;
  RETURN QUERY SELECT * FROM ccpun_article.read_article_metrics(p_article_id,p_heart_hash);
END
$function$;
REVOKE ALL ON ALL TABLES IN SCHEMA ccpun_article FROM PUBLIC,ccpun_article_runtime;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA ccpun_article FROM PUBLIC,ccpun_article_runtime;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ccpun_article FROM PUBLIC,ccpun_article_runtime;
REVOKE ALL ON SCHEMA ccpun_article FROM ccpun_article_runtime;
GRANT USAGE ON SCHEMA ccpun_article TO ccpun_article_runtime;
GRANT EXECUTE ON FUNCTION ccpun_article.read_article_metrics(text,text),
  ccpun_article.record_article_event(text,text,uuid,text),
  ccpun_article.set_article_heart(text,text,boolean) TO ccpun_article_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA ccpun_article REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA ccpun_article REVOKE ALL ON TABLES FROM PUBLIC;
COMMENT ON TABLE ccpun_article.activation IS 'Partial historical GA4 openings/share intent baseline, window 2023-09-29 through 2026-10-16; post-activation atomic deltas are separate. Unknown history is NULL, never invented zero.';
COMMENT ON TABLE ccpun_article.event_nonce IS 'Random client UUID idempotency keys only; no IP, UA, visitor, customer, or cross-article identity.';
COMMENT ON TABLE ccpun_article.heart_state IS 'Per-article salted hash of explicit-action random HttpOnly cookie; no raw tokens or cross-article identifier.';
-- checksum-source-end
INSERT INTO ccpun_article.schema_migration(version,checksum) VALUES('20261019_article_engagement_v1','sha256:3e80a2ab8492b18c66bc1b83d4be952e23d25de0be0889d291916120a873f9da')
ON CONFLICT (version) DO NOTHING;
COMMIT;

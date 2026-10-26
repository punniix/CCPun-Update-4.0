-- Investment fund catalog v1: SEC Open API v2 public reference data for the
-- บลจ. เอไอเอ fund tool, refreshed by the private VPS sync job.
-- Additive only: one new schema, new tables/functions and two NOLOGIN roles.
-- Apply on UAT first. Login and a password for each role are set later through
-- native Neon when its lane is activated; neither role is a fallback for another.
--   ccpun_fund_runtime  Public Web reader: read functions + live-fallback lease only.
--   ccpun_fund_sync     Private VPS writer: sync_* functions only.
-- No customer, visitor, IP or calculator data is stored here.
BEGIN;
SET LOCAL statement_timeout = '15s';
SELECT pg_advisory_xact_lock(hashtext('ccpun_fund:20261026_investment_fund_catalog_v1'));
DO $roles$
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'Incorrect fund catalog database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_fund_runtime') THEN
    CREATE ROLE ccpun_fund_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_fund_sync') THEN
    CREATE ROLE ccpun_fund_sync NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$roles$;
CREATE SCHEMA IF NOT EXISTS ccpun_fund;
REVOKE ALL ON SCHEMA ccpun_fund FROM PUBLIC;
CREATE TABLE IF NOT EXISTS ccpun_fund.schema_migration (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ccpun_fund.schema_migration FROM PUBLIC;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('ccpun_fund_runtime','ccpun_fund_sync')
    AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member IN ('ccpun_fund_runtime'::regrole,'ccpun_fund_sync'::regrole))
  THEN RAISE EXCEPTION 'Fund catalog role has excessive privileges or memberships'; END IF;
  -- Includes effective PUBLIC/inherited access: never silently change other schemas.
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('ccpun_fund_runtime'),('ccpun_fund_sync')) r(rolname)
    WHERE n.nspname NOT IN ('pg_catalog','information_schema','ccpun_fund')
      AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'
      AND c.relkind IN ('r','p','v','m','f')
      AND has_table_privilege(r.rolname,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  ) OR EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('ccpun_fund_runtime'),('ccpun_fund_sync')) r(rolname)
    WHERE n.nspname NOT IN ('pg_catalog','information_schema','ccpun_fund')
      AND p.prosecdef AND has_schema_privilege(r.rolname,n.oid,'USAGE')
      AND has_function_privilege(r.rolname,p.oid,'EXECUTE')
  ) THEN RAISE EXCEPTION 'Fund catalog role can access another application data plane'; END IF;
  IF EXISTS (SELECT 1 FROM ccpun_fund.schema_migration
    WHERE version = '20261026_investment_fund_catalog_v1' AND checksum <> 'sha256:235358a842cc669f241644fd88708183bc1d50df7bef9a1d672f0800b76f534e')
  THEN RAISE EXCEPTION 'Fund catalog migration checksum mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM ccpun_fund.schema_migration WHERE version = '20261026_investment_fund_catalog_v1')
    AND (to_regclass('ccpun_fund.catalog_state') IS NOT NULL OR to_regclass('ccpun_fund.fund') IS NOT NULL
      OR to_regclass('ccpun_fund.sync_run') IS NOT NULL OR to_regclass('ccpun_fund.sync_change') IS NOT NULL
      OR to_regclass('ccpun_fund.live_fallback_lease') IS NOT NULL)
  THEN RAISE EXCEPTION 'Fund catalog tables exist without a migration record'; END IF;
END
$guard$;

-- checksum-source-begin
-- One row per tool scope: the resolved SEC AMC and when its catalog was last fetched.
CREATE TABLE IF NOT EXISTS ccpun_fund.catalog_state (
  scope text PRIMARY KEY CHECK (scope IN ('aia')),
  amc_id text NOT NULL CHECK (amc_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  amc_name_th text NOT NULL CHECK (char_length(amc_name_th) BETWEEN 1 AND 300),
  amc_name_en text CHECK (amc_name_en IS NULL OR char_length(amc_name_en) BETWEEN 1 AND 300),
  catalog_fetched_at timestamptz NOT NULL,
  last_run_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'sec_v2' CHECK (source = 'sec_v2')
);

-- Funds are never deleted: cancelled, merged or no-longer-listed funds are hidden.
-- profile_rows/detail hold SEC v2 rows projected to the public fields the tool reads.
CREATE TABLE IF NOT EXISTS ccpun_fund.fund (
  scope text NOT NULL CHECK (scope IN ('aia')),
  project_id text NOT NULL CHECK (project_id ~ '^M[0-9]{4}_[0-9]{4}$'),
  amc_id text NOT NULL CHECK (amc_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  list_position integer NOT NULL CHECK (list_position BETWEEN 0 AND 100000),
  sec_status text NOT NULL CHECK (char_length(sec_status) BETWEEN 1 AND 64),
  visible boolean NOT NULL DEFAULT true,
  hidden_reason text CHECK (hidden_reason IS NULL OR hidden_reason IN ('cancelled','merged','inactive','not_listed')),
  profile_rows jsonb NOT NULL CHECK (jsonb_typeof(profile_rows) = 'array' AND jsonb_array_length(profile_rows) BETWEEN 1 AND 100
    AND octet_length(profile_rows::text) <= 131072),
  detail jsonb CHECK (detail IS NULL OR (jsonb_typeof(detail) = 'object' AND octet_length(detail::text) <= 524288)),
  profile_fetched_at timestamptz NOT NULL,
  detail_fetched_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  hidden_at timestamptz,
  source text NOT NULL DEFAULT 'sec_v2' CHECK (source = 'sec_v2'),
  PRIMARY KEY (scope, project_id),
  CHECK ((visible AND hidden_reason IS NULL AND hidden_at IS NULL) OR (NOT visible AND hidden_reason IS NOT NULL AND hidden_at IS NOT NULL)),
  CHECK ((detail IS NULL) = (detail_fetched_at IS NULL))
);

-- Run record per sync; the owner can review it later from Admin (read model pending).
CREATE TABLE IF NOT EXISTS ccpun_fund.sync_run (
  run_id uuid PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('aia')),
  trigger text NOT NULL CHECK (trigger IN ('timer','manual')),
  status text NOT NULL CHECK (status IN ('running','succeeded','partial','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  amc_id text CHECK (amc_id IS NULL OR amc_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  funds_listed integer CHECK (funds_listed IS NULL OR funds_listed >= 0),
  funds_added integer CHECK (funds_added IS NULL OR funds_added >= 0),
  funds_restored integer CHECK (funds_restored IS NULL OR funds_restored >= 0),
  funds_hidden integer CHECK (funds_hidden IS NULL OR funds_hidden >= 0),
  detail_failures integer CHECK (detail_failures IS NULL OR detail_failures >= 0),
  sec_requests integer CHECK (sec_requests IS NULL OR sec_requests >= 0),
  error_code text CHECK (error_code IS NULL OR error_code ~ '^[a-z0-9_]{1,64}$'),
  CHECK ((status = 'running') = (finished_at IS NULL))
);
CREATE INDEX IF NOT EXISTS sync_run_scope_started_idx ON ccpun_fund.sync_run (scope, started_at DESC);

-- Fund list changes per run: new funds, funds shown again, funds hidden (with SEC status).
CREATE TABLE IF NOT EXISTS ccpun_fund.sync_change (
  run_id uuid NOT NULL REFERENCES ccpun_fund.sync_run(run_id),
  project_id text NOT NULL CHECK (project_id ~ '^M[0-9]{4}_[0-9]{4}$'),
  change text NOT NULL CHECK (change IN ('added','restored','hidden')),
  reason text CHECK (reason IS NULL OR reason IN ('cancelled','merged','inactive','not_listed')),
  sec_status text CHECK (sec_status IS NULL OR char_length(sec_status) BETWEEN 1 AND 64),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, project_id, change),
  CHECK ((change = 'hidden') = (reason IS NOT NULL))
);

-- Cross-instance lock so a stale or empty store triggers one live SEC fallback at a time.
CREATE TABLE IF NOT EXISTS ccpun_fund.live_fallback_lease (
  lease_key text PRIMARY KEY CHECK (lease_key IN ('aia:catalog','aia:detail')),
  holder uuid NOT NULL,
  leased_until timestamptz NOT NULL
);

CREATE OR REPLACE FUNCTION ccpun_fund.read_catalog(p_scope text)
RETURNS TABLE(project_id text, list_position integer, profile_rows jsonb, profile_fetched_at timestamptz,
  amc_id text, amc_name_th text, amc_name_en text, catalog_fetched_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $function$
  SELECT f.project_id, f.list_position, f.profile_rows, f.profile_fetched_at,
    s.amc_id, s.amc_name_th, s.amc_name_en, s.catalog_fetched_at
  FROM ccpun_fund.catalog_state s
  LEFT JOIN ccpun_fund.fund f ON f.scope = s.scope AND f.visible
  WHERE s.scope = p_scope AND p_scope IN ('aia')
  ORDER BY f.list_position, f.project_id
  LIMIT 2000;
$function$;

CREATE OR REPLACE FUNCTION ccpun_fund.read_fund(p_scope text,p_project_id text)
RETURNS TABLE(visible boolean, hidden_reason text, sec_status text, profile_rows jsonb, detail jsonb,
  profile_fetched_at timestamptz, detail_fetched_at timestamptz, amc_id text, catalog_fetched_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $function$
  SELECT f.visible, f.hidden_reason, f.sec_status, f.profile_rows, f.detail,
    f.profile_fetched_at, f.detail_fetched_at, s.amc_id, s.catalog_fetched_at
  FROM ccpun_fund.fund f JOIN ccpun_fund.catalog_state s ON s.scope = f.scope
  WHERE f.scope = p_scope AND p_scope IN ('aia') AND f.project_id = p_project_id
    AND p_project_id ~ '^M[0-9]{4}_[0-9]{4}$';
$function$;

CREATE OR REPLACE FUNCTION ccpun_fund.claim_live_fallback(p_lease_key text,p_holder uuid,p_seconds integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE claimed integer;
BEGIN
  IF p_lease_key IS NULL OR p_lease_key NOT IN ('aia:catalog','aia:detail') OR p_holder IS NULL
    OR p_seconds IS NULL OR p_seconds < 5 OR p_seconds > 120
  THEN RAISE EXCEPTION 'Invalid fund catalog lease input'; END IF;
  INSERT INTO ccpun_fund.live_fallback_lease AS l(lease_key,holder,leased_until)
  VALUES (p_lease_key,p_holder,clock_timestamp() + make_interval(secs => p_seconds))
  ON CONFLICT (lease_key) DO UPDATE SET holder = excluded.holder, leased_until = excluded.leased_until
  WHERE l.leased_until <= clock_timestamp();
  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed = 1;
END
$function$;

CREATE OR REPLACE FUNCTION ccpun_fund.sync_begin(p_scope text,p_trigger text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE new_run uuid;
BEGIN
  IF p_scope IS NULL OR p_scope NOT IN ('aia') OR p_trigger IS NULL OR p_trigger NOT IN ('timer','manual')
  THEN RAISE EXCEPTION 'Invalid fund catalog sync input'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ccpun_fund:sync:' || p_scope));
  -- A run that never finished within two hours is closed as abandoned, never resumed.
  UPDATE ccpun_fund.sync_run r SET status = 'failed', finished_at = clock_timestamp(), error_code = 'abandoned'
  WHERE r.scope = p_scope AND r.status = 'running' AND r.started_at < clock_timestamp() - interval '2 hours';
  IF EXISTS (SELECT 1 FROM ccpun_fund.sync_run r WHERE r.scope = p_scope AND r.status = 'running') THEN RETURN NULL; END IF;
  new_run := gen_random_uuid();
  INSERT INTO ccpun_fund.sync_run(run_id,scope,trigger,status,started_at) VALUES (new_run,p_scope,p_trigger,'running',clock_timestamp());
  RETURN new_run;
END
$function$;

CREATE OR REPLACE FUNCTION ccpun_fund.sync_visible_projects(p_run_id uuid)
RETURNS TABLE(project_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $function$
  SELECT f.project_id FROM ccpun_fund.sync_run r JOIN ccpun_fund.fund f ON f.scope = r.scope AND f.visible
  WHERE r.run_id = p_run_id AND r.status = 'running' ORDER BY f.project_id;
$function$;

CREATE OR REPLACE FUNCTION ccpun_fund.sync_upsert_fund(p_run_id uuid,p_project_id text,p_amc_id text,p_list_position integer,
  p_sec_status text,p_profile_rows jsonb,p_detail jsonb)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE run_scope text; was_visible boolean; outcome text;
BEGIN
  SELECT r.scope INTO run_scope FROM ccpun_fund.sync_run r WHERE r.run_id = p_run_id AND r.status = 'running' FOR UPDATE;
  IF run_scope IS NULL THEN RAISE EXCEPTION 'Fund catalog sync run is not running'; END IF;
  IF p_project_id IS NULL OR p_project_id !~ '^M[0-9]{4}_[0-9]{4}$' OR p_amc_id IS NULL OR p_amc_id !~ '^[A-Za-z0-9_-]{1,64}$'
    OR p_list_position IS NULL OR p_sec_status IS NULL OR p_sec_status NOT IN ('Registered','IPO')
    OR p_profile_rows IS NULL OR jsonb_typeof(p_profile_rows) <> 'array'
    OR (p_detail IS NOT NULL AND jsonb_typeof(p_detail) <> 'object')
  THEN RAISE EXCEPTION 'Invalid fund catalog row'; END IF;
  SELECT f.visible INTO was_visible FROM ccpun_fund.fund f WHERE f.scope = run_scope AND f.project_id = p_project_id FOR UPDATE;
  outcome := CASE WHEN was_visible IS NULL THEN 'added' WHEN NOT was_visible THEN 'restored' ELSE 'updated' END;
  INSERT INTO ccpun_fund.fund AS f(scope,project_id,amc_id,list_position,sec_status,visible,hidden_reason,profile_rows,detail,
    profile_fetched_at,detail_fetched_at,first_seen_at,last_seen_at,hidden_at)
  VALUES (run_scope,p_project_id,p_amc_id,p_list_position,p_sec_status,true,NULL,p_profile_rows,p_detail,
    clock_timestamp(),CASE WHEN p_detail IS NULL THEN NULL ELSE clock_timestamp() END,clock_timestamp(),clock_timestamp(),NULL)
  ON CONFLICT (scope,project_id) DO UPDATE SET amc_id = excluded.amc_id, list_position = excluded.list_position,
    sec_status = excluded.sec_status, visible = true, hidden_reason = NULL, hidden_at = NULL,
    profile_rows = excluded.profile_rows, profile_fetched_at = excluded.profile_fetched_at,
    -- A failed detail fetch keeps the previous detail and its own fetch time.
    detail = COALESCE(excluded.detail, f.detail),
    detail_fetched_at = CASE WHEN excluded.detail IS NULL THEN f.detail_fetched_at ELSE excluded.detail_fetched_at END,
    last_seen_at = excluded.last_seen_at;
  IF outcome IN ('added','restored') THEN
    INSERT INTO ccpun_fund.sync_change(run_id,project_id,change) VALUES (p_run_id,p_project_id,outcome) ON CONFLICT DO NOTHING;
  END IF;
  RETURN outcome;
END
$function$;

CREATE OR REPLACE FUNCTION ccpun_fund.sync_hide_fund(p_run_id uuid,p_project_id text,p_reason text,p_sec_status text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE run_scope text; changed integer;
BEGIN
  SELECT r.scope INTO run_scope FROM ccpun_fund.sync_run r WHERE r.run_id = p_run_id AND r.status = 'running' FOR UPDATE;
  IF run_scope IS NULL THEN RAISE EXCEPTION 'Fund catalog sync run is not running'; END IF;
  IF p_project_id IS NULL OR p_project_id !~ '^M[0-9]{4}_[0-9]{4}$'
    OR p_reason IS NULL OR p_reason NOT IN ('cancelled','merged','inactive','not_listed')
    OR (p_sec_status IS NOT NULL AND char_length(p_sec_status) NOT BETWEEN 1 AND 64)
  THEN RAISE EXCEPTION 'Invalid fund catalog hide input'; END IF;
  UPDATE ccpun_fund.fund f SET visible = false, hidden_reason = p_reason, hidden_at = clock_timestamp(),
    sec_status = COALESCE(p_sec_status, f.sec_status)
  WHERE f.scope = run_scope AND f.project_id = p_project_id AND f.visible;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 1 THEN
    INSERT INTO ccpun_fund.sync_change(run_id,project_id,change,reason,sec_status)
    VALUES (p_run_id,p_project_id,'hidden',p_reason,p_sec_status) ON CONFLICT DO NOTHING;
  END IF;
  RETURN changed = 1;
END
$function$;

CREATE OR REPLACE FUNCTION ccpun_fund.sync_finish(p_run_id uuid,p_status text,p_amc_id text,p_amc_name_th text,p_amc_name_en text,
  p_funds_listed integer,p_detail_failures integer,p_sec_requests integer,p_error_code text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE run_scope text;
BEGIN
  SELECT r.scope INTO run_scope FROM ccpun_fund.sync_run r WHERE r.run_id = p_run_id AND r.status = 'running' FOR UPDATE;
  IF run_scope IS NULL THEN RAISE EXCEPTION 'Fund catalog sync run is not running'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('succeeded','partial','failed')
    OR (p_status <> 'failed' AND (p_amc_id IS NULL OR p_amc_name_th IS NULL))
    OR (p_error_code IS NOT NULL AND p_error_code !~ '^[a-z0-9_]{1,64}$')
  THEN RAISE EXCEPTION 'Invalid fund catalog finish input'; END IF;
  UPDATE ccpun_fund.sync_run r SET status = p_status, finished_at = clock_timestamp(), amc_id = p_amc_id,
    funds_listed = p_funds_listed, detail_failures = p_detail_failures, sec_requests = p_sec_requests, error_code = p_error_code,
    funds_added = (SELECT count(*) FROM ccpun_fund.sync_change c WHERE c.run_id = p_run_id AND c.change = 'added'),
    funds_restored = (SELECT count(*) FROM ccpun_fund.sync_change c WHERE c.run_id = p_run_id AND c.change = 'restored'),
    funds_hidden = (SELECT count(*) FROM ccpun_fund.sync_change c WHERE c.run_id = p_run_id AND c.change = 'hidden')
  WHERE r.run_id = p_run_id;
  IF p_status <> 'failed' THEN
    INSERT INTO ccpun_fund.catalog_state AS s(scope,amc_id,amc_name_th,amc_name_en,catalog_fetched_at,last_run_id)
    VALUES (run_scope,p_amc_id,p_amc_name_th,p_amc_name_en,clock_timestamp(),p_run_id)
    ON CONFLICT (scope) DO UPDATE SET amc_id = excluded.amc_id, amc_name_th = excluded.amc_name_th,
      amc_name_en = excluded.amc_name_en, catalog_fetched_at = excluded.catalog_fetched_at, last_run_id = excluded.last_run_id;
  END IF;
END
$function$;

REVOKE ALL ON ALL TABLES IN SCHEMA ccpun_fund FROM PUBLIC,ccpun_fund_runtime,ccpun_fund_sync;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA ccpun_fund FROM PUBLIC,ccpun_fund_runtime,ccpun_fund_sync;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ccpun_fund FROM PUBLIC,ccpun_fund_runtime,ccpun_fund_sync;
REVOKE ALL ON SCHEMA ccpun_fund FROM ccpun_fund_runtime,ccpun_fund_sync;
GRANT USAGE ON SCHEMA ccpun_fund TO ccpun_fund_runtime,ccpun_fund_sync;
GRANT EXECUTE ON FUNCTION ccpun_fund.read_catalog(text),
  ccpun_fund.read_fund(text,text),
  ccpun_fund.claim_live_fallback(text,uuid,integer) TO ccpun_fund_runtime;
GRANT EXECUTE ON FUNCTION ccpun_fund.sync_begin(text,text),
  ccpun_fund.sync_visible_projects(uuid),
  ccpun_fund.sync_upsert_fund(uuid,text,text,integer,text,jsonb,jsonb),
  ccpun_fund.sync_hide_fund(uuid,text,text,text),
  ccpun_fund.sync_finish(uuid,text,text,text,text,integer,integer,integer,text) TO ccpun_fund_sync;
ALTER DEFAULT PRIVILEGES IN SCHEMA ccpun_fund REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA ccpun_fund REVOKE ALL ON TABLES FROM PUBLIC;
COMMENT ON SCHEMA ccpun_fund IS 'Public SEC Open API v2 fund reference data for the investment tools; not personal data, not ops telemetry.';
COMMENT ON TABLE ccpun_fund.fund IS 'SEC v2 rows projected to public fields. Cancelled/merged/unlisted funds are hidden (visible=false), never deleted.';
COMMENT ON TABLE ccpun_fund.sync_change IS 'Fund list changes per sync run (added, restored, hidden with SEC status) for owner review.';
COMMENT ON TABLE ccpun_fund.live_fallback_lease IS 'Short lease keys only; no visitor, IP or request data.';
-- checksum-source-end
INSERT INTO ccpun_fund.schema_migration(version,checksum) VALUES('20261026_investment_fund_catalog_v1','sha256:235358a842cc669f241644fd88708183bc1d50df7bef9a1d672f0800b76f534e')
ON CONFLICT (version) DO NOTHING;
COMMIT;

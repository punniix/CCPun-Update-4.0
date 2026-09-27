BEGIN;
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN 1 ELSE 0 END AS role_guard;
SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM ccpun_admin.system_identity WHERE singleton=true) THEN 1 ELSE 0 END AS identity_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260927_analytics_daily_raw_v1'));
SELECT 1 / CASE WHEN NOT EXISTS (SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260927_analytics_daily_raw_v1' AND checksum<>'sha256:96bb27179454643c5f0e8e991e5a41193a344755d3b65cc3b8dadf0b8e9cf076') THEN 1 ELSE 0 END AS checksum_guard;

-- checksum-source-begin
CREATE TABLE IF NOT EXISTS ccpun_admin.analytics_daily_batch (
  batch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('gsc','ga4','meta','ubersuggest')),
  collection_date date NOT NULL,
  collection_key text NOT NULL DEFAULT 'daily',
  status text NOT NULL CHECK (status IN ('running','completed','failed')),
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 2),
  attempted_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  error_category text CHECK (error_category IS NULL OR error_category IN ('not-configured','source-unavailable','invalid-response','batch-too-large')),
  UNIQUE(source,collection_date,collection_key)
);
CREATE TABLE IF NOT EXISTS ccpun_admin.analytics_raw_page (
  batch_id uuid NOT NULL REFERENCES ccpun_admin.analytics_daily_batch(batch_id),
  attempt integer NOT NULL,
  report text NOT NULL,
  page integer NOT NULL CHECK (page >= 0),
  collected_at timestamptz NOT NULL,
  origin text NOT NULL CHECK (origin IN ('provider-response','existing-private-store','owner-web-csv')),
  body jsonb NOT NULL,
  canonical_json text NOT NULL,
  request_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash text NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$' AND hash=encode(sha256(convert_to(canonical_json,'UTF8')),'hex')),
  CHECK (CASE WHEN origin='provider-response' THEN (canonical_json::jsonb->'body' IS NOT DISTINCT FROM body) AND (canonical_json::jsonb->'requestMeta' IS NOT DISTINCT FROM request_meta) ELSE canonical_json::jsonb=body END),
  PRIMARY KEY(batch_id,attempt,report,page)
);
CREATE TABLE IF NOT EXISTS ccpun_admin.analytics_completed_report (
  batch_id uuid NOT NULL REFERENCES ccpun_admin.analytics_daily_batch(batch_id),
  report text NOT NULL CHECK (report IN ('gsc-summary','gsc-query-page','ga4-summary','ga4-organic-landing','social-performance','seo-intelligence','ubersuggest-web-keywords')),
  data jsonb NOT NULL,
  PRIMARY KEY(batch_id,report)
);
REVOKE ALL ON ccpun_admin.analytics_daily_batch,ccpun_admin.analytics_raw_page,ccpun_admin.analytics_completed_report FROM PUBLIC,ccpun_admin_runtime;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_begin_analytics_daily(p_source text,p_date date,p_key text DEFAULT 'daily')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $analytics_begin$
DECLARE b ccpun_admin.analytics_daily_batch; claimed boolean := false;
BEGIN
  IF p_source NOT IN ('gsc','ga4','meta','ubersuggest') OR p_date<>(now() AT TIME ZONE 'Asia/Bangkok')::date OR NOT (p_key='daily' OR (p_source='ubersuggest' AND p_key ~ '^web:[0-9a-f]{64}$')) THEN RAISE EXCEPTION 'INVALID_ANALYTICS_COLLECTION'; END IF;
  INSERT INTO ccpun_admin.analytics_daily_batch(source,collection_date,collection_key,status) VALUES(p_source,p_date,p_key,'running') ON CONFLICT DO NOTHING RETURNING * INTO b;
  IF FOUND THEN claimed := true;
  ELSE
    SELECT * INTO b FROM ccpun_admin.analytics_daily_batch WHERE source=p_source AND collection_date=p_date AND collection_key=p_key FOR UPDATE;
    IF b.status<>'completed' AND b.attempt<2 AND (b.status='failed' OR b.attempted_at<now()-interval '5 minutes') THEN
      UPDATE ccpun_admin.analytics_daily_batch SET status='running',attempt=attempt+1,attempted_at=now(),error_category=NULL WHERE batch_id=b.batch_id RETURNING * INTO b;
      claimed := true;
    END IF;
  END IF;
  RETURN jsonb_build_object('status',CASE WHEN claimed THEN 'claimed' ELSE b.status END,'batchId',b.batch_id,'attempt',b.attempt);
END $analytics_begin$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_finish_analytics_daily(p jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $analytics_finish$
DECLARE b ccpun_admin.analytics_daily_batch; item jsonb; err text := p->>'error';
BEGIN
  IF octet_length(p::text)>20000000 OR jsonb_typeof(p->'raw') IS DISTINCT FROM 'array' OR jsonb_typeof(p->'reports') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_ANALYTICS_BATCH'; END IF;
  SELECT * INTO b FROM ccpun_admin.analytics_daily_batch WHERE batch_id=(p->>'batchId')::uuid FOR UPDATE;
  IF NOT FOUND OR b.status<>'running' OR b.attempt<>(p->>'attempt')::integer THEN RAISE EXCEPTION 'ANALYTICS_CLAIM_CONFLICT'; END IF;
  IF err IS NOT NULL AND err NOT IN ('not-configured','source-unavailable','invalid-response','batch-too-large') THEN RAISE EXCEPTION 'INVALID_ANALYTICS_ERROR'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'raw') LOOP
    INSERT INTO ccpun_admin.analytics_raw_page(batch_id,attempt,report,page,collected_at,origin,body,canonical_json,hash,request_meta)
    VALUES(b.batch_id,b.attempt,item->>'report',(item->>'page')::integer,(item->>'collectedAt')::timestamptz,item->>'origin',item->'body',item->>'canonicalJson',item->>'hash',COALESCE(item->'requestMeta','{}'::jsonb));
  END LOOP;
  IF err IS NULL THEN
    IF jsonb_array_length(p->'reports')=0 OR jsonb_array_length(p->'raw')=0 THEN RAISE EXCEPTION 'EMPTY_ANALYTICS_BATCH'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p->'reports') LOOP
      IF item->>'source' IS DISTINCT FROM b.source OR item->>'batchId' IS DISTINCT FROM b.batch_id::text OR jsonb_typeof(item->'rows') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'rows')>50000 THEN RAISE EXCEPTION 'INVALID_ANALYTICS_REPORT'; END IF;
      INSERT INTO ccpun_admin.analytics_completed_report(batch_id,report,data) VALUES(b.batch_id,item->>'report',item);
    END LOOP;
  END IF;
  UPDATE ccpun_admin.analytics_daily_batch SET status=CASE WHEN err IS NULL THEN 'completed' ELSE 'failed' END,completed_at=now(),error_category=err WHERE batch_id=b.batch_id;
  RETURN CASE WHEN err IS NULL THEN 'completed' ELSE 'failed' END;
END $analytics_finish$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_analytics_daily(p_cutoff timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $analytics_read$
WITH sources AS (SELECT unnest(ARRAY['gsc','ga4','meta','ubersuggest']) AS source),
attempts AS (SELECT DISTINCT ON(source) source,CASE WHEN completed_at>p_cutoff THEN 'running' ELSE status END AS status,CASE WHEN completed_at>p_cutoff THEN NULL ELSE error_category END AS error_category,attempted_at FROM ccpun_admin.analytics_daily_batch WHERE attempted_at<=p_cutoff ORDER BY source,attempted_at DESC),
reports AS (SELECT DISTINCT ON(r.report) r.report,r.data,b.source FROM ccpun_admin.analytics_completed_report r JOIN ccpun_admin.analytics_daily_batch b USING(batch_id) WHERE b.status='completed' AND b.completed_at<=p_cutoff ORDER BY r.report,b.completed_at DESC)
SELECT jsonb_build_object(
  'sources',(SELECT jsonb_agg(jsonb_build_object('source',s.source,'lastAttemptAt',to_char(a.attempted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'lastAttemptStatus',a.status,'lastError',a.error_category) ORDER BY s.source) FROM sources s LEFT JOIN attempts a USING(source)),
  'datasets',COALESCE((SELECT jsonb_agg(r.data||jsonb_build_object('lastAttemptAt',to_char(a.attempted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'lastAttemptStatus',a.status) ORDER BY r.report) FROM reports r LEFT JOIN attempts a USING(source)),'[]'::jsonb))
$analytics_read$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_analytics_research()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $analytics_research$
SELECT COALESCE(jsonb_agg(jsonb_build_object('id',r.id,'keyword',r.keyword,'provider',r.provider,'scope',r.scope,'location',r.location,'language',r.language,'volume',r.volume,'difficulty',r.difficulty,'intent',r.intent,'competitors',r.competitors_json,'serp',r.serp_json,'serpCount',jsonb_array_length(r.serp_json),'checkedAt',to_char(r.checked_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'trustClass',r.trust_class) ORDER BY r.checked_at DESC),'[]'::jsonb)
FROM (SELECT * FROM ccpun_admin.research_snapshot WHERE keyword NOT IN ('ccpun_csv_uat_20260927_alpha','ccpun_csv_uat_20260927_beta') ORDER BY checked_at DESC,id DESC LIMIT 50001) r
$analytics_research$;

REVOKE ALL ON FUNCTION ccpun_admin.admin_begin_analytics_daily(text,date,text),ccpun_admin.admin_finish_analytics_daily(jsonb),ccpun_admin.admin_read_analytics_daily(timestamptz),ccpun_admin.admin_read_analytics_research() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_begin_analytics_daily(text,date,text),ccpun_admin.admin_finish_analytics_daily(jsonb),ccpun_admin.admin_read_analytics_daily(timestamptz),ccpun_admin.admin_read_analytics_research() TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum) VALUES('20260927_analytics_daily_raw_v1','sha256:96bb27179454643c5f0e8e991e5a41193a344755d3b65cc3b8dadf0b8e9cf076') ON CONFLICT(version) DO NOTHING;
COMMIT;

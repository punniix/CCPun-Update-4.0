BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN current_database()='neondb' AND EXISTS(SELECT 1 FROM ccpun_admin.system_identity WHERE singleton=true AND ((project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394') OR (project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w'))) THEN 1 ELSE 0 END AS identity_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260927_marketing_local_analysis_v2' AND checksum='sha256:eb0d7a8a1637ccde4bc17d5bc60952da831aec8736123eb42970c467e5306f30') THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260928_analytics_source_timing_v1'));
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_analytics_source_timing_v1' AND checksum<>'sha256:d03599c3782fa62bf437dfec2281acbd58013e8ea94864147f3b813b1b358b7d') THEN 1 ELSE 0 END AS checksum_guard;
-- checksum-source-begin
CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_analytics_daily(p_cutoff timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $analytics_read$
WITH sources AS (SELECT unnest(ARRAY['gsc','ga4','meta','ubersuggest']) AS source),
attempts AS (
  SELECT DISTINCT ON(source) source,
    CASE WHEN completed_at>p_cutoff THEN 'running' ELSE status END AS status,
    CASE WHEN completed_at>p_cutoff THEN NULL ELSE error_category END AS error_category,
    attempted_at,
    CASE WHEN status IN('completed','failed') AND completed_at<=p_cutoff
      THEN greatest(0,round(extract(epoch FROM completed_at-attempted_at)*1000))::bigint
      ELSE NULL END AS duration_ms
  FROM ccpun_admin.analytics_daily_batch
  WHERE attempted_at<=p_cutoff
  ORDER BY source,attempted_at DESC
),
reports AS (
  SELECT DISTINCT ON(r.report) r.report,r.data,b.source
  FROM ccpun_admin.analytics_completed_report r JOIN ccpun_admin.analytics_daily_batch b USING(batch_id)
  WHERE b.status='completed' AND b.completed_at<=p_cutoff
  ORDER BY r.report,CASE WHEN r.report IN('gsc-daily-page','gsc-daily-query-page','ga4-daily-organic','ga4-content-events') THEN (r.data->>'periodEnd')::date END DESC NULLS LAST,b.completed_at DESC
)
SELECT jsonb_build_object(
  'sources',(SELECT jsonb_agg(jsonb_build_object('source',s.source,'lastAttemptAt',to_char(a.attempted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'lastAttemptStatus',a.status,'lastError',a.error_category,'lastAttemptDurationMs',a.duration_ms) ORDER BY s.source) FROM sources s LEFT JOIN attempts a USING(source)),
  'datasets',COALESCE((SELECT jsonb_agg(r.data||jsonb_build_object('lastAttemptAt',to_char(a.attempted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'lastAttemptStatus',a.status) ORDER BY r.report) FROM reports r LEFT JOIN attempts a USING(source)),'[]'::jsonb))
$analytics_read$;
-- checksum-source-end
INSERT INTO ccpun_admin.schema_migration(version,checksum) VALUES('20260928_analytics_source_timing_v1','sha256:d03599c3782fa62bf437dfec2281acbd58013e8ea94864147f3b813b1b358b7d') ON CONFLICT(version) DO NOTHING;
COMMIT;

BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS(
  SELECT 1 FROM ccpun_admin.schema_migration
  WHERE version='20260927_marketing_local_analysis_v2'
    AND checksum='sha256:eb0d7a8a1637ccde4bc17d5bc60952da831aec8736123eb42970c467e5306f30'
) THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260929_marketing_traffic_quality_v1'));
SELECT 1 / CASE WHEN NOT EXISTS(
  SELECT 1 FROM ccpun_admin.schema_migration
  WHERE version='20260929_marketing_traffic_quality_v1'
    AND checksum<>'sha256:917fe5957301170fd6c19d61cbe7d6cfb1c1e87cdd1185ea398122843450704d'
) THEN 1 ELSE 0 END AS checksum_guard;

-- checksum-source-begin
CREATE OR REPLACE FUNCTION ccpun_admin.admin_marketing_traffic_quality(
  p_now timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,ccpun_admin
AS $traffic_quality$
WITH per_day AS (
  SELECT
    day,
    sum(event_count) FILTER(WHERE event_name='ci_landing_view') AS ci_landing,
    sum(event_count) FILTER(WHERE event_name='ci_calculator_start') AS ci_start,
    sum(event_count) FILTER(WHERE event_name='ci_calculator_complete') AS ci_complete,
    sum(event_count) FILTER(WHERE event_name='fhc_landing_view') AS fhc_landing,
    sum(event_count) FILTER(WHERE event_name='fhc_calculator_start') AS fhc_start,
    sum(event_count) FILTER(WHERE event_name='fhc_calculator_complete') AS fhc_complete
  FROM ccpun_admin.marketing_event_current
  WHERE report='ga4-content-events'
    AND day BETWEEN (p_now AT TIME ZONE 'Asia/Bangkok')::date-90
                AND (p_now AT TIME ZONE 'Asia/Bangkok')::date
  GROUP BY day
),
anomalies AS (
  SELECT *
  FROM per_day
  WHERE ci_landing>0 AND ci_start>0 AND ci_complete>0
    AND fhc_landing>0 AND fhc_start>0 AND fhc_complete>0
    AND ci_landing=fhc_landing
    AND ci_start=fhc_start
    AND ci_complete=fhc_complete
)
SELECT jsonb_build_object(
  'trafficClassification','production',
  'supportedClassifications',jsonb_build_array('production','internal','qa','unknown'),
  'rawEvidencePreserved',true,
  'anomalies',
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'date',day,
            'classification','unknown',
            'reason','mirrored_ci_fhc_event_pattern',
            'ci',jsonb_build_object('landing',ci_landing,'start',ci_start,'complete',ci_complete),
            'fhc',jsonb_build_object('landing',fhc_landing,'start',fhc_start,'complete',fhc_complete),
            'evidenceRef','ga4-content-events:'||day::text
          )
          ORDER BY day
        )
        FROM anomalies
      ),
      '[]'::jsonb
    )
)
$traffic_quality$;

REVOKE ALL ON FUNCTION ccpun_admin.admin_marketing_traffic_quality(timestamptz) FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_marketing_traffic_quality(timestamptz) TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260929_marketing_traffic_quality_v1','sha256:917fe5957301170fd6c19d61cbe7d6cfb1c1e87cdd1185ea398122843450704d')
ON CONFLICT(version) DO NOTHING;
COMMIT;

BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS(
  SELECT 1 FROM pg_roles
  WHERE rolname='ccpun_admin_runtime'
    AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls
) THEN 1 ELSE 0 END AS role_guard;
SELECT 1 / CASE WHEN EXISTS(
  SELECT 1 FROM ccpun_admin.local_ai_identity
  WHERE singleton=true
    AND database_name='neondb'
    AND migration_version='20260919_local_ai_control_plane_v1'
    AND migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6'
    AND (
      (lane='uat' AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394')
      OR
      (lane='production' AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w')
    )
) THEN 1 ELSE 0 END AS identity_guard;
SELECT 1 / CASE WHEN EXISTS(
  SELECT 1 FROM ccpun_admin.schema_migration
  WHERE version='20260927_marketing_local_analysis_v2'
    AND checksum='sha256:eb0d7a8a1637ccde4bc17d5bc60952da831aec8736123eb42970c467e5306f30'
) THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260929_marketing_export_integrity_v3'));
SELECT 1 / CASE WHEN NOT EXISTS(
  SELECT 1 FROM ccpun_admin.schema_migration
  WHERE version='20260929_marketing_export_integrity_v3'
    AND checksum<>'sha256:d9ab47684fbb9b7752b1224bdaec1b2f07b6bea1dbffe5aad3459b037a8dca4e'
) THEN 1 ELSE 0 END AS checksum_guard;

-- checksum-source-begin
CREATE OR REPLACE FUNCTION ccpun_admin.marketing_window_calendar(
  p_key text,
  p_end date,
  p_calendar date
) RETURNS jsonb
LANGUAGE sql IMMUTABLE
AS $cal$
WITH constants AS (
  SELECT
    date_trunc('week',p_calendar::timestamp)::date AS calendar_week_start,
    date_trunc('month',p_calendar::timestamp)::date AS calendar_month_start
),
raw_window AS (
  SELECT
    CASE p_key
      WHEN 'this_week' THEN CASE WHEN p_end>=calendar_week_start THEN calendar_week_start ELSE date_trunc('week',p_end::timestamp)::date END
      WHEN 'last_week' THEN CASE WHEN p_end>=calendar_week_start-7 THEN calendar_week_start-7 ELSE date_trunc('week',p_end::timestamp)::date END
      WHEN 'this_month' THEN CASE WHEN p_end>=calendar_month_start THEN calendar_month_start ELSE date_trunc('month',p_end::timestamp)::date END
      WHEN 'last_month' THEN CASE WHEN p_end>=(calendar_month_start-interval '1 month')::date THEN (calendar_month_start-interval '1 month')::date ELSE date_trunc('month',p_end::timestamp)::date END
    END AS s,
    CASE p_key
      WHEN 'this_week' THEN p_end
      WHEN 'last_week' THEN CASE WHEN p_end>=calendar_week_start-7 THEN least(calendar_week_start-1,p_end) ELSE p_end END
      WHEN 'this_month' THEN p_end
      WHEN 'last_month' THEN CASE WHEN p_end>=(calendar_month_start-interval '1 month')::date THEN least(calendar_month_start-1,p_end) ELSE p_end END
    END AS raw_e,
    CASE
      WHEN p_key='this_week' AND p_end<calendar_week_start THEN 'latest_mature_period'
      WHEN p_key='last_week' AND p_end<calendar_week_start-7 THEN 'latest_mature_period'
      WHEN p_key='this_month' AND p_end<calendar_month_start THEN 'latest_mature_period'
      WHEN p_key='last_month' AND p_end<(calendar_month_start-interval '1 month')::date THEN 'latest_mature_period'
      ELSE 'mature_data'
    END AS availability
  FROM constants
),
with_previous AS (
  SELECT
    s,
    raw_e,
    CASE WHEN p_key IN('this_week','last_week') THEN s-7 ELSE (s-interval '1 month')::date END AS ps,
    availability
  FROM raw_window
),
capped AS (
  SELECT
    s,
    CASE WHEN p_key IN('this_month','last_month') THEN s+least(raw_e-s,(s-1)-ps) ELSE raw_e END AS e,
    ps,
    CASE WHEN p_key IN('this_month','last_month') THEN ps+least(raw_e-s,(s-1)-ps) ELSE raw_e-7 END AS pe,
    availability
  FROM with_previous
)
SELECT CASE
  WHEN p_key IN('rolling_7','rolling_28') AND p_end IS NOT NULL THEN
    ccpun_admin.marketing_window(p_key,p_end)
    || jsonb_build_object(
      'availability','mature_data',
      'calendarPolicy','Rolling period ending at the common mature provider cutoff and current and previous durations are equal'
    )
  WHEN p_end IS NULL OR p_calendar IS NULL THEN
    jsonb_build_object(
      'key',p_key,'currentStart',NULL,'currentEnd',NULL,
      'previousStart',NULL,'previousEnd',NULL,
      'availability','no_mature_data',
      'calendarPolicy','No mature comparable provider period is available'
    )
  WHEN p_key NOT IN('this_week','last_week','this_month','last_month','rolling_7','rolling_28') THEN
    jsonb_build_object(
      'key',p_key,'currentStart',NULL,'currentEnd',NULL,
      'previousStart',NULL,'previousEnd',NULL,
      'availability','no_mature_data',
      'calendarPolicy','Invalid marketing window key'
    )
  WHEN (SELECT e<s OR pe<ps OR (e-s)<>(pe-ps) FROM capped) THEN
    jsonb_build_object(
      'key',p_key,'currentStart',NULL,'currentEnd',NULL,
      'previousStart',NULL,'previousEnd',NULL,
      'availability','no_mature_data',
      'calendarPolicy','No mature equal-duration comparable provider period is available'
    )
  ELSE
    (
      SELECT jsonb_build_object(
        'key',p_key,
        'currentStart',s,
        'currentEnd',e,
        'previousStart',ps,
        'previousEnd',pe,
        'availability',availability,
        'calendarPolicy',
          CASE WHEN availability='latest_mature_period'
            THEN 'Requested calendar period is not mature and the latest mature equal-duration comparable provider period is used without relabelling provider dates'
            ELSE 'Business calendar Asia/Bangkok with a common mature provider cutoff and equal-duration current and previous periods'
          END
      )
      FROM capped
    )
END
$cal$;

CREATE OR REPLACE VIEW ccpun_admin.marketing_social_unified AS
SELECT
  s.platform,
  s.object_id,
  s.captured_at,
  s.published_at,
  s.url,
  s.content_type,
  s.views,
  s.reach,
  s.interactions,
  s.shares,
  s.saves,
  'analytics-batch:'||s.batch_id::text AS provenance_ref,
  coalesce(c.text_content,stored.text_content) AS text_content,
  coalesce(c.content_id,stored.content_id) AS content_id,
  c.publication_id,
  c.master_content_id
FROM ccpun_admin.marketing_social_snapshot s
JOIN ccpun_admin.analytics_daily_batch b USING(batch_id)
LEFT JOIN LATERAL (
  SELECT
    current.content_id,
    current.publication_id,
    current.master_content_id,
    current.text_content
  FROM ccpun_social.marketing_content_current current
  WHERE lower(current.platform)=lower(s.platform)
    AND current.provider_object_id=s.object_id
  ORDER BY current.last_seen_at DESC NULLS LAST,current.content_id
  LIMIT 1
) c ON true
LEFT JOIN LATERAL (
  SELECT
    nullif(row->>'เนื้อหา','') AS text_content,
    nullif(row->>'Content ID','') AS content_id
  FROM ccpun_admin.analytics_completed_report report
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(report.data->'rows','[]'::jsonb)) row
  WHERE report.batch_id=s.batch_id
    AND report.report='social-performance'
    AND row->>'Provider Object ID'=s.object_id
    AND lower(coalesce(row->>'แพลตฟอร์ม',''))=lower(s.platform)
  LIMIT 1
) stored ON true
WHERE b.status='completed'
UNION ALL
SELECT
  CASE c.platform WHEN 'facebook' THEN 'Facebook' ELSE 'Instagram' END,
  c.provider_object_id,
  snapshot.fetched_at,
  c.published_at_utc,
  c.permalink,
  c.provider_media_type,
  NULL::numeric,
  performance.reach,
  NULL::numeric,
  performance.shares,
  performance.saves,
  'social-mart:'||snapshot.id::text,
  c.text_content,
  c.content_id,
  c.publication_id,
  c.master_content_id
FROM ccpun_social.social_provider_metric_snapshot snapshot
JOIN ccpun_social.marketing_content_current c ON c.content_id=snapshot.content_id
JOIN ccpun_social.post_performance_snapshot performance ON performance.snapshot_id=snapshot.id
WHERE c.platform IN('facebook','instagram');

CREATE OR REPLACE FUNCTION ccpun_admin.marketing_enrich_social_asset(
  p_asset jsonb,
  p_now timestamptz
) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path=pg_catalog,ccpun_admin
AS $enrich$
WITH latest AS (
  SELECT s.*
  FROM ccpun_admin.marketing_social_unified s
  WHERE 'social:'||s.platform||':'||s.object_id=p_asset->>'assetId'
    AND s.captured_at<=p_now
  ORDER BY s.captured_at DESC,s.provenance_ref DESC
  LIMIT 1
),
enriched AS (
  SELECT
    p_asset
    || jsonb_build_object(
      'contentEntityId',
        coalesce(
          CASE WHEN nullif(s.master_content_id,'') IS NOT NULL THEN 'social-master:'||s.master_content_id END,
          CASE WHEN nullif(s.content_id,'') IS NOT NULL THEN 'social-content:'||s.content_id END,
          p_asset->>'assetId'
        ),
      'providerObjectId',s.object_id,
      'textContent',s.text_content,
      'title',coalesce(nullif(s.text_content,''),p_asset->>'title',s.object_id),
      'mappingStatus',
        CASE
          WHEN nullif(s.master_content_id,'') IS NOT NULL OR nullif(s.publication_id,'') IS NOT NULL THEN 'linked'
          WHEN nullif(s.content_id,'') IS NOT NULL OR nullif(s.object_id,'') IS NOT NULL THEN 'standalone'
          ELSE 'unresolved'
        END,
      'metricSemantics','lifetime_snapshot',
      'snapshotAt',s.captured_at,
      'previous',NULL,
      'absoluteChange',NULL,
      'percentageChange',NULL
    )
    || CASE
      WHEN p_asset ? 'metrics' AND jsonb_typeof(p_asset->'metrics')='array' THEN
        jsonb_build_object(
          'metrics',
          (
            SELECT coalesce(
              jsonb_agg(
                metric
                || jsonb_build_object(
                  'metricSemantics','lifetime_snapshot',
                  'snapshotAt',s.captured_at,
                  'previous',NULL,
                  'absoluteChange',NULL,
                  'percentageChange',NULL,
                  'coverageStatus','native_snapshot_not_period_activity'
                )
              ),
              '[]'::jsonb
            )
            FROM jsonb_array_elements(p_asset->'metrics') metric
          )
        )
      ELSE '{}'::jsonb
    END AS value
  FROM latest s
)
SELECT coalesce((SELECT value FROM enriched),p_asset)
$enrich$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_marketing_v3(
  p_key text DEFAULT 'rolling_7',
  p_now timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,ccpun_admin
AS $facts_v3$
WITH base AS (
  SELECT ccpun_admin.admin_read_marketing_v2(p_key,p_now) AS d
),
content_enriched AS (
  SELECT jsonb_set(
    d,
    '{contentPerformance}',
    (
      SELECT coalesce(
        jsonb_agg(ccpun_admin.marketing_enrich_social_asset(asset,p_now) ORDER BY ord),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(d->'contentPerformance') WITH ORDINALITY item(asset,ord)
    )
  ) AS d
  FROM base
),
leaderboards_enriched AS (
  SELECT jsonb_set(
    d,
    '{leaderboards}',
    (
      SELECT coalesce(
        jsonb_agg(
          board
          || jsonb_build_object(
            'rows',
            (
              SELECT coalesce(
                jsonb_agg(ccpun_admin.marketing_enrich_social_asset(row,p_now) ORDER BY row_ord),
                '[]'::jsonb
              )
              FROM jsonb_array_elements(coalesce(board->'rows','[]'::jsonb)) WITH ORDINALITY rows(row,row_ord)
            )
          )
          ORDER BY board_ord
        ),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(d->'leaderboards') WITH ORDINALITY boards(board,board_ord)
    )
  ) AS d
  FROM content_enriched
),
manifest_enriched AS (
  SELECT jsonb_set(
    d,
    '{manifest}',
    (
      SELECT coalesce(
        jsonb_agg(
          manifest_item
          || jsonb_build_object('resourceScope',source.resource_scope)
          ORDER BY manifest_ord
        ),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(d->'manifest') WITH ORDINALITY items(manifest_item,manifest_ord)
      LEFT JOIN ccpun_admin.marketing_report_manifest source
        ON source.batch_id=(manifest_item->>'batchId')::uuid
       AND source.report=manifest_item->>'report'
    )
  ) AS d
  FROM leaderboards_enriched
)
SELECT d FROM manifest_enriched
$facts_v3$;

REVOKE ALL ON FUNCTION ccpun_admin.marketing_enrich_social_asset(jsonb,timestamptz) FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;
REVOKE ALL ON ccpun_admin.marketing_social_unified FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;
REVOKE ALL ON FUNCTION ccpun_admin.marketing_window_calendar(text,date,date) FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;
REVOKE ALL ON FUNCTION ccpun_admin.admin_read_marketing_v3(text,timestamptz) FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_read_marketing_v3(text,timestamptz) TO ccpun_admin_runtime;

-- checksum-source-end
INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260929_marketing_export_integrity_v3','sha256:d9ab47684fbb9b7752b1224bdaec1b2f07b6bea1dbffe5aad3459b037a8dca4e')
ON CONFLICT(version) DO NOTHING;
COMMIT;

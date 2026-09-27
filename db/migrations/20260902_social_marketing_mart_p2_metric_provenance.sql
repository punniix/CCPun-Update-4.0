BEGIN;

SELECT pg_advisory_xact_lock(hashtext('ccpun_social:20260902_social_marketing_mart_p2_metric_provenance'));
SELECT 1 / CASE WHEN EXISTS (
    SELECT 1 FROM ccpun_social.schema_migration
    WHERE version = '20260902_social_marketing_mart_p2_full_backfill_clean'
      AND checksum = 'sha256:1dfbe426656ada42fa59f4b0d0727a39c293534abf964690bbbe0d8c6294727f'
  ) THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT 1 / CASE WHEN NOT EXISTS (
  SELECT 1 FROM ccpun_social.schema_migration
  WHERE version='20260902_social_marketing_mart_p2_metric_provenance'
    AND checksum<>'sha256:5b421a7bb67798d6b45911c1b05e3f54bc9f50c0482b48857f6780e7379ef866'
) THEN 1 ELSE 0 END AS checksum_guard;

-- checksum-source-begin
ALTER TABLE ccpun_social.social_metric_capability
  ADD COLUMN IF NOT EXISTS collection_profile text
  CHECK (collection_profile IS NULL OR collection_profile ~ '^[a-z0-9_.:-]{1,120}$');

UPDATE ccpun_social.social_metric_capability
SET collection_profile = CASE
  WHEN provider='meta' AND platform='facebook'
    AND metric_key IN ('reactions_total','comments_total','shares')
    THEN 'meta-base-content-v1'
  WHEN provider='meta' AND platform='instagram'
    AND metric_key IN ('likes','comments_total')
    THEN 'meta-base-content-v1'
  WHEN provider='meta' AND platform='facebook'
    AND metric_key IN (
      'views','clicks','reaction_like','reaction_love','reaction_care',
      'reaction_wow','reaction_haha','reaction_sad','reaction_angry'
    )
    THEN 'meta-p1-insights-v1'
  WHEN provider='meta' AND platform='instagram'
    AND metric_key IN (
      'views','reach','saves','shares','total_interactions',
      'reel_total_watch_time_ms','reel_average_watch_time_ms'
    )
    THEN 'meta-p1-insights-v1'
  ELSE collection_profile
END,
updated_at = now()
WHERE provider='meta';

CREATE OR REPLACE VIEW ccpun_social.post_metric_status_latest AS
WITH latest_snapshot AS (
  SELECT DISTINCT ON (snapshot.content_id)
    snapshot.id AS snapshot_id,
    snapshot.content_id,
    snapshot.provider,
    snapshot.platform,
    snapshot.provider_object_id,
    snapshot.fetched_at,
    snapshot.native_metrics
  FROM ccpun_social.social_provider_metric_snapshot AS snapshot
  ORDER BY snapshot.content_id, snapshot.fetched_at DESC, snapshot.created_at DESC, snapshot.id DESC
), observations AS (
  SELECT
    snapshot.snapshot_id,
    snapshot.content_id,
    metric->>'key' AS native_metric_key,
    (metric->>'value')::numeric AS metric_value,
    metric->>'unit' AS unit,
    metric->>'dimension' AS dimension
  FROM latest_snapshot AS snapshot
  CROSS JOIN LATERAL jsonb_array_elements(snapshot.native_metrics) AS metric
), latest_attempt AS (
  SELECT *
  FROM ccpun_social.post_metric_collection_latest
  WHERE collection_profile = 'meta-p1-insights-v1'
), attempted_status AS (
  SELECT
    attempt.content_id,
    status->>'key' AS metric_key,
    status->>'status' AS metric_status,
    attempt.attempted_at,
    attempt.provider_api_version
  FROM latest_attempt AS attempt
  CROSS JOIN LATERAL jsonb_array_elements(attempt.metric_statuses) AS status
)
SELECT
  content.content_id,
  content.provider,
  content.platform,
  content.provider_object_id,
  content.provider_media_type,
  content.format_standard,
  snapshot.snapshot_id,
  snapshot.fetched_at AS snapshot_at,
  capability.metric_key,
  capability.native_metric_key,
  observation.metric_value,
  observation.unit,
  observation.dimension,
  CASE
    WHEN capability.applies_to_format IS NOT NULL
      AND capability.applies_to_format <> content.format_standard THEN 'unsupported'
    WHEN capability.collection_profile = 'meta-p1-insights-v1'
      AND attempted.metric_status = 'available'
      AND observation.native_metric_key IS NOT NULL THEN 'available'
    WHEN capability.collection_profile = 'meta-p1-insights-v1'
      AND attempted.metric_status = 'available' THEN 'fetch_error'
    WHEN capability.collection_profile = 'meta-p1-insights-v1'
      AND attempted.metric_status IS NOT NULL THEN attempted.metric_status
    WHEN capability.collection_profile = 'meta-p1-insights-v1'
      AND observation.native_metric_key IS NOT NULL THEN 'available'
    WHEN capability.collection_profile = 'meta-p1-insights-v1' THEN 'not_fetched'
    WHEN capability.collection_profile = 'meta-base-content-v1'
      AND observation.native_metric_key IS NOT NULL THEN 'available'
    WHEN capability.collection_profile = 'meta-base-content-v1'
      AND snapshot.snapshot_id IS NOT NULL THEN 'not_returned'
    WHEN observation.native_metric_key IS NOT NULL THEN 'available'
    WHEN capability.collection_state = 'requested' THEN 'not_fetched'
    ELSE capability.collection_state
  END AS metric_status,
  coalesce(
    capability.collection_profile = 'meta-p1-insights-v1'
      AND observation.native_metric_key IS NOT NULL
      AND attempted.metric_status IN ('permission_denied','rate_limited','fetch_error'),
    false
  ) AS metric_value_stale,
  COALESCE(attempted.provider_api_version, capability.provider_api_version) AS provider_api_version,
  attempted.attempted_at AS collection_attempted_at,
  capability.note AS capability_note
FROM ccpun_social.marketing_content_current AS content
LEFT JOIN latest_snapshot AS snapshot ON snapshot.content_id = content.content_id
JOIN ccpun_social.social_metric_capability AS capability
  ON capability.provider = content.provider AND capability.platform = content.platform
LEFT JOIN observations AS observation
  ON observation.content_id = content.content_id
  AND observation.native_metric_key = capability.native_metric_key
LEFT JOIN attempted_status AS attempted
  ON attempted.content_id = content.content_id
  AND attempted.metric_key = capability.metric_key;
-- checksum-source-end

INSERT INTO ccpun_social.schema_migration (version, checksum)
VALUES ('20260902_social_marketing_mart_p2_metric_provenance', 'sha256:5b421a7bb67798d6b45911c1b05e3f54bc9f50c0482b48857f6780e7379ef866')
ON CONFLICT (version) DO NOTHING;

COMMIT;

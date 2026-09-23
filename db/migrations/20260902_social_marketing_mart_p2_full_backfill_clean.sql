BEGIN;

SELECT pg_advisory_xact_lock(hashtext('ccpun_social:20260902_social_marketing_mart_p2_full_backfill_clean'));
SELECT 1 / CASE WHEN EXISTS (
    SELECT 1 FROM ccpun_social.schema_migration
    WHERE version = '20260902_social_marketing_mart_p1_meta_insights'
      AND checksum = 'sha256:7bdc2c2b80b59d7364d92ec88dd66ccd5472390291bf0bc3ba82ec424718f671'
  ) THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT 1 / CASE WHEN NOT EXISTS (
  SELECT 1 FROM ccpun_social.schema_migration
  WHERE version='20260902_social_marketing_mart_p2_full_backfill_clean'
    AND checksum<>'sha256:1dfbe426656ada42fa59f4b0d0727a39c293534abf964690bbbe0d8c6294727f'
) THEN 1 ELSE 0 END AS checksum_guard;

-- checksum-source-begin
CREATE TABLE IF NOT EXISTS ccpun_social.social_provider_metric_collection_attempt (
  id text PRIMARY KEY CHECK (id ~ '^provider-collection:[0-9a-f]{64}$'),
  content_id text NOT NULL REFERENCES ccpun_social.social_provider_content(id),
  provider text NOT NULL CHECK (provider IN ('meta', 'youtube', 'tiktok')),
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'youtube', 'tiktok')),
  collection_profile text NOT NULL CHECK (collection_profile ~ '^[a-z0-9_.:-]{1,120}$'),
  provider_api_version text NOT NULL CHECK (provider_api_version ~ '^v[0-9]{1,2}\.[0-9]{1,2}$'),
  request_ref text NOT NULL CHECK (length(request_ref) BETWEEN 1 AND 120),
  attempted_at timestamptz NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('complete', 'partial', 'failed')),
  requested_metric_keys jsonb NOT NULL CHECK (
    jsonb_typeof(requested_metric_keys) = 'array'
    AND jsonb_array_length(requested_metric_keys) BETWEEN 1 AND 20
  ),
  metric_statuses jsonb NOT NULL CHECK (
    jsonb_typeof(metric_statuses) = 'array'
    AND jsonb_array_length(metric_statuses) BETWEEN 1 AND 20
  ),
  requested_metric_count integer NOT NULL CHECK (requested_metric_count BETWEEN 1 AND 20),
  available_metric_count integer NOT NULL CHECK (
    available_metric_count BETWEEN 0 AND requested_metric_count
  ),
  error_category text CHECK (
    error_category IS NULL OR error_category IN ('permission_denied', 'rate_limited', 'fetch_error')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, collection_profile, request_ref)
);

CREATE INDEX IF NOT EXISTS social_provider_metric_collection_attempt_lookup_idx
  ON ccpun_social.social_provider_metric_collection_attempt
  (collection_profile, content_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS social_provider_metric_collection_attempt_outcome_idx
  ON ccpun_social.social_provider_metric_collection_attempt
  (collection_profile, outcome, attempted_at DESC);

CREATE OR REPLACE VIEW ccpun_social.post_metric_collection_latest AS
SELECT DISTINCT ON (attempt.content_id, attempt.collection_profile)
  attempt.id,
  attempt.content_id,
  attempt.provider,
  attempt.platform,
  attempt.collection_profile,
  attempt.provider_api_version,
  attempt.request_ref,
  attempt.attempted_at,
  attempt.outcome,
  attempt.requested_metric_keys,
  attempt.metric_statuses,
  attempt.requested_metric_count,
  attempt.available_metric_count,
  attempt.error_category
FROM ccpun_social.social_provider_metric_collection_attempt AS attempt
ORDER BY attempt.content_id, attempt.collection_profile, attempt.attempted_at DESC, attempt.created_at DESC;

CREATE OR REPLACE VIEW ccpun_social.post_performance_latest AS
SELECT DISTINCT ON (performance.content_id)
  performance.*
FROM ccpun_social.post_performance_snapshot AS performance
ORDER BY performance.content_id, performance.snapshot_at DESC, performance.snapshot_id DESC;

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
    WHEN attempted.metric_status = 'available' AND observation.native_metric_key IS NOT NULL THEN 'available'
    WHEN attempted.metric_status = 'available' THEN 'fetch_error'
    WHEN attempted.metric_status IS NOT NULL THEN attempted.metric_status
    WHEN observation.native_metric_key IS NOT NULL THEN 'available'
    WHEN capability.collection_state = 'requested' THEN 'not_fetched'
    ELSE capability.collection_state
  END AS metric_status,
  coalesce(
    observation.native_metric_key IS NOT NULL
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

CREATE OR REPLACE VIEW ccpun_social.post_metric_coverage_summary AS
SELECT
  status.provider,
  status.platform,
  status.metric_key,
  status.native_metric_key,
  count(*) AS total_posts,
  count(*) FILTER (WHERE status.metric_status NOT IN ('unsupported','not_requested')) AS eligible_posts,
  count(*) FILTER (WHERE status.metric_status = 'available') AS available_posts,
  count(*) FILTER (WHERE status.metric_status = 'not_returned') AS not_returned_posts,
  count(*) FILTER (WHERE status.metric_status = 'not_fetched') AS not_fetched_posts,
  count(*) FILTER (WHERE status.metric_status = 'unsupported') AS unsupported_posts,
  count(*) FILTER (WHERE status.metric_status = 'not_requested') AS not_requested_posts,
  count(*) FILTER (WHERE status.metric_status = 'permission_denied') AS permission_denied_posts,
  count(*) FILTER (WHERE status.metric_status = 'rate_limited') AS rate_limited_posts,
  count(*) FILTER (WHERE status.metric_status = 'fetch_error') AS fetch_error_posts,
  CASE
    WHEN count(*) FILTER (WHERE status.metric_status NOT IN ('unsupported','not_requested')) = 0 THEN NULL
    ELSE count(*) FILTER (WHERE status.metric_status = 'available')::numeric
      / count(*) FILTER (WHERE status.metric_status NOT IN ('unsupported','not_requested'))
  END AS availability_rate
FROM ccpun_social.post_metric_status_latest AS status
GROUP BY status.provider, status.platform, status.metric_key, status.native_metric_key;

CREATE OR REPLACE VIEW ccpun_social.post_performance_clean AS
WITH base AS (
  SELECT
    performance.*,
    content.text_content,
    quality.data_quality_status AS facebook_share_quality_status,
    quality.data_quality_note AS facebook_share_quality_note,
    CASE
      WHEN performance.reaction_like IS NOT NULL
        OR performance.reaction_love IS NOT NULL
        OR performance.reaction_care IS NOT NULL
        OR performance.reaction_wow IS NOT NULL
        OR performance.reaction_haha IS NOT NULL
        OR performance.reaction_sad IS NOT NULL
        OR performance.reaction_angry IS NOT NULL
      THEN coalesce(performance.reaction_like, 0)
        + coalesce(performance.reaction_love, 0)
        + coalesce(performance.reaction_care, 0)
        + coalesce(performance.reaction_wow, 0)
        + coalesce(performance.reaction_haha, 0)
        + coalesce(performance.reaction_sad, 0)
        + coalesce(performance.reaction_angry, 0)
      ELSE NULL
    END AS facebook_reaction_breakdown_sum,
    CASE
      WHEN performance.platform = 'instagram'
        AND performance.likes IS NOT NULL
        AND performance.comments_total IS NOT NULL
        AND performance.shares IS NOT NULL
        AND performance.saves IS NOT NULL
      THEN performance.likes + performance.comments_total + performance.shares + performance.saves
      ELSE NULL
    END AS instagram_visible_interaction_sum
  FROM ccpun_social.post_performance_latest AS performance
  JOIN ccpun_social.marketing_content_current AS content ON content.content_id = performance.content_id
  LEFT JOIN ccpun_social.post_data_quality AS quality
    ON quality.snapshot_id = performance.snapshot_id
), coverage AS (
  SELECT
    status.content_id,
    count(*) FILTER (
      WHERE status.metric_status = 'available'
        AND (
          (status.platform = 'facebook' AND status.metric_key IN ('reactions_total','comments_total','shares','views','clicks'))
          OR
          (status.platform = 'instagram' AND status.metric_key IN ('likes','comments_total','views','reach','saves','shares','total_interactions'))
          OR
          (status.platform = 'instagram' AND status.format_standard = 'video'
            AND status.metric_key IN ('reel_total_watch_time_ms','reel_average_watch_time_ms'))
        )
    ) AS available_core_metric_count
  FROM ccpun_social.post_metric_status_latest AS status
  GROUP BY status.content_id
)
SELECT
  base.*,
  CASE
    WHEN base.platform = 'facebook' THEN 5
    WHEN base.platform = 'instagram' AND base.format_standard = 'video' THEN 9
    WHEN base.platform = 'instagram' THEN 7
    ELSE 0
  END AS expected_core_metric_count,
  coalesce(coverage.available_core_metric_count, 0) AS available_core_metric_count,
  CASE
    WHEN base.platform = 'facebook' THEN coalesce(coverage.available_core_metric_count, 0)::numeric / 5
    WHEN base.platform = 'instagram' AND base.format_standard = 'video' THEN coalesce(coverage.available_core_metric_count, 0)::numeric / 9
    WHEN base.platform = 'instagram' THEN coalesce(coverage.available_core_metric_count, 0)::numeric / 7
    ELSE NULL
  END AS metric_coverage_rate,
  CASE
    WHEN base.reactions_total IS NOT NULL
      OR base.likes IS NOT NULL
      OR base.comments_total IS NOT NULL
      OR base.shares IS NOT NULL
      OR base.saves IS NOT NULL
    THEN coalesce(base.reactions_total, base.likes, 0)
      + coalesce(base.comments_total, 0)
      + coalesce(base.shares, 0)
      + coalesce(base.saves, 0)
    ELSE NULL
  END AS known_engagement_total,
  CASE
    WHEN base.comments_total IS NOT NULL OR base.shares IS NOT NULL OR base.saves IS NOT NULL
    THEN coalesce(base.comments_total, 0) + coalesce(base.shares, 0) + coalesce(base.saves, 0)
    ELSE NULL
  END AS known_deep_engagement_total,
  CASE
    WHEN base.platform = 'facebook'
      THEN base.reactions_total IS NOT NULL AND base.comments_total IS NOT NULL AND base.shares IS NOT NULL
    WHEN base.platform = 'instagram'
      THEN base.likes IS NOT NULL AND base.comments_total IS NOT NULL AND base.shares IS NOT NULL AND base.saves IS NOT NULL
    ELSE false
  END AS engagement_components_complete,
  NULL::numeric AS creator_comments,
  NULL::numeric AS audience_comments,
  'not_collected'::text AS comment_attribution_status,
  base.engagement_rate_by_reach AS known_engagement_rate_by_reach,
  base.deep_engagement_rate AS known_deep_engagement_rate_by_reach,
  NULL::numeric AS audience_engagement_rate_by_reach,
  NULL::numeric AS audience_deep_engagement_rate_by_reach,
  CASE
    WHEN base.views IS NULL OR base.views = 0 OR base.clicks IS NULL THEN NULL
    ELSE base.clicks / base.views
  END AS clicks_per_view,
  CASE
    WHEN base.platform <> 'facebook' THEN 'not_applicable'
    WHEN base.facebook_reaction_breakdown_sum IS NULL THEN 'unavailable'
    WHEN base.reactions_total IS NULL THEN 'provider_definition_review'
    WHEN base.facebook_reaction_breakdown_sum = base.reactions_total THEN 'observed_consistent'
    ELSE 'needs_review'
  END AS facebook_reaction_definition_status,
  CASE
    WHEN base.platform <> 'instagram' THEN 'not_applicable'
    WHEN base.total_interactions IS NULL OR base.instagram_visible_interaction_sum IS NULL THEN 'unavailable'
    WHEN base.total_interactions = base.instagram_visible_interaction_sum THEN 'observed_consistent'
    ELSE 'provider_definition_review'
  END AS instagram_interaction_definition_status,
  CASE
    WHEN base.facebook_share_quality_status = 'needs_review'
      OR (base.platform = 'facebook' AND base.facebook_reaction_breakdown_sum IS NOT NULL
        AND base.reactions_total IS NOT NULL AND base.facebook_reaction_breakdown_sum <> base.reactions_total)
      OR (base.platform = 'instagram' AND base.total_interactions IS NOT NULL
        AND base.instagram_visible_interaction_sum IS NOT NULL
        AND base.total_interactions <> base.instagram_visible_interaction_sum)
    THEN 'needs_review'
    ELSE 'usable_with_limitations'
  END AS data_quality_status,
  CASE
    WHEN base.platform = 'instagram' AND base.reach IS NOT NULL AND base.reach > 0
      AND coalesce(coverage.available_core_metric_count, 0) >= CASE WHEN base.format_standard = 'video' THEN 9 ELSE 7 END
      THEN 'exposure_normalized_with_comment_limit'
    WHEN base.platform = 'instagram' AND base.reach IS NOT NULL AND base.reach > 0
      THEN 'exposure_normalized_with_gaps'
    WHEN base.platform = 'facebook' AND base.views IS NOT NULL AND base.views > 0
      THEN 'exposure_ready_without_reach'
    WHEN coalesce(coverage.available_core_metric_count, 0) > 0 THEN 'partial'
    ELSE 'insufficient'
  END AS analysis_status
FROM base
LEFT JOIN coverage ON coverage.content_id = base.content_id;

REVOKE ALL PRIVILEGES ON ccpun_social.social_provider_metric_collection_attempt FROM ccpun_social_runtime;
GRANT SELECT, INSERT ON ccpun_social.social_provider_metric_collection_attempt TO ccpun_social_runtime;
GRANT SELECT ON
  ccpun_social.post_metric_collection_latest,
  ccpun_social.post_performance_latest,
  ccpun_social.post_metric_status_latest,
  ccpun_social.post_metric_coverage_summary,
  ccpun_social.post_performance_clean
TO ccpun_social_runtime;
-- checksum-source-end

INSERT INTO ccpun_social.schema_migration (version, checksum)
VALUES ('20260902_social_marketing_mart_p2_full_backfill_clean', 'sha256:1dfbe426656ada42fa59f4b0d0727a39c293534abf964690bbbe0d8c6294727f')
ON CONFLICT (version) DO NOTHING;

COMMIT;

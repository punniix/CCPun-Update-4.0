BEGIN;

SELECT pg_advisory_xact_lock(hashtext('ccpun_social:20260902_social_marketing_mart_p1_meta_insights'));
SELECT 1 / CASE WHEN EXISTS (
    SELECT 1 FROM ccpun_social.schema_migration
    WHERE version = '20260902_social_marketing_mart_p0'
      AND checksum = 'sha256:ebd2a708c4dc6c524cf93147a3446c3c3cd92b76cb626291a6662c2b7ca878f0'
  ) THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT 1 / CASE WHEN NOT EXISTS (
  SELECT 1 FROM ccpun_social.schema_migration
  WHERE version='20260902_social_marketing_mart_p1_meta_insights'
    AND checksum<>'sha256:7bdc2c2b80b59d7364d92ec88dd66ccd5472390291bf0bc3ba82ec424718f671'
) THEN 1 ELSE 0 END AS checksum_guard;

-- checksum-source-begin
ALTER TABLE ccpun_social.social_metric_capability
  ADD COLUMN IF NOT EXISTS applies_to_format text
  CHECK (applies_to_format IS NULL OR applies_to_format IN ('text','image','multi_image','carousel','video','reel','story','link','other'));

INSERT INTO ccpun_social.social_metric_capability
(provider,platform,metric_key,native_metric_key,collection_state,note,applies_to_format)
VALUES
  ('meta','facebook','views','facebook.views','requested','Current Production capability probe verified post_media_view; collector stores it under facebook.views.',NULL),
  ('meta','facebook','clicks','facebook.clicks','requested','Current Production capability probe verified post_clicks.',NULL),
  ('meta','facebook','reaction_like','facebook.reaction_like','requested','Breakdown from post_reactions_by_type_total.',NULL),
  ('meta','facebook','reaction_love','facebook.reaction_love','requested','Breakdown from post_reactions_by_type_total.',NULL),
  ('meta','facebook','reaction_care','facebook.reaction_care','requested','Breakdown from post_reactions_by_type_total when returned by Meta.',NULL),
  ('meta','facebook','reaction_wow','facebook.reaction_wow','requested','Breakdown from post_reactions_by_type_total.',NULL),
  ('meta','facebook','reaction_haha','facebook.reaction_haha','requested','Breakdown from post_reactions_by_type_total.',NULL),
  ('meta','facebook','reaction_sad','facebook.reaction_sad','requested','Breakdown from post_reactions_by_type_total.',NULL),
  ('meta','facebook','reaction_angry','facebook.reaction_angry','requested','Breakdown from post_reactions_by_type_total.',NULL),
  ('meta','instagram','views','instagram.views','requested','Current Production capability probe verified views.',NULL),
  ('meta','instagram','reach','instagram.reach','requested','Current Production capability probe verified reach.',NULL),
  ('meta','instagram','saves','instagram.saves','requested','Current Production capability probe verified saved; normalized key remains saves.',NULL),
  ('meta','instagram','shares','instagram.shares','requested','Current Production capability probe verified shares.',NULL),
  ('meta','instagram','total_interactions','instagram.total_interactions','requested','Current Production capability probe verified total_interactions.',NULL),
  ('meta','instagram','reel_total_watch_time_ms','instagram.ig_reels_video_view_total_time','requested','Meta returns Reel total watch time in milliseconds.','video'),
  ('meta','instagram','reel_average_watch_time_ms','instagram.ig_reels_avg_watch_time','requested','Meta returns Reel average watch time in milliseconds.','video')
ON CONFLICT (provider,platform,metric_key) DO UPDATE SET
  native_metric_key = EXCLUDED.native_metric_key,
  collection_state = EXCLUDED.collection_state,
  note = EXCLUDED.note,
  applies_to_format = EXCLUDED.applies_to_format,
  updated_at = now();

CREATE OR REPLACE VIEW ccpun_social.post_metric_status AS
WITH observations AS (
  SELECT
    snapshot.id AS snapshot_id,
    snapshot.content_id,
    snapshot.provider,
    snapshot.platform,
    snapshot.provider_object_id,
    snapshot.fetched_at AS snapshot_at,
    metric->>'key' AS native_metric_key,
    (metric->>'value')::numeric AS metric_value,
    metric->>'unit' AS unit,
    metric->>'dimension' AS dimension
  FROM ccpun_social.social_provider_metric_snapshot AS snapshot
  CROSS JOIN LATERAL jsonb_array_elements(snapshot.native_metrics) AS metric
)
SELECT
  snapshot.id AS snapshot_id,
  snapshot.content_id,
  snapshot.provider,
  snapshot.platform,
  snapshot.provider_object_id,
  snapshot.fetched_at AS snapshot_at,
  capability.metric_key,
  capability.native_metric_key,
  observation.metric_value,
  observation.unit,
  observation.dimension,
  CASE
    WHEN capability.applies_to_format IS NOT NULL AND capability.applies_to_format <> content.format_standard THEN 'unsupported'
    WHEN observation.native_metric_key IS NOT NULL THEN 'available'
    WHEN capability.collection_state = 'requested' THEN 'not_returned'
    ELSE capability.collection_state
  END AS metric_status,
  capability.provider_api_version,
  capability.note AS capability_note
FROM ccpun_social.social_provider_metric_snapshot AS snapshot
JOIN ccpun_social.marketing_content_current AS content ON content.content_id = snapshot.content_id
JOIN ccpun_social.social_metric_capability AS capability
  ON capability.provider = snapshot.provider AND capability.platform = snapshot.platform
LEFT JOIN observations AS observation
  ON observation.snapshot_id = snapshot.id AND observation.native_metric_key = capability.native_metric_key;

CREATE OR REPLACE VIEW ccpun_social.post_performance_snapshot AS
WITH metrics AS (
  SELECT
    status.snapshot_id,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'reactions_total') AS reactions_total,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'likes') AS likes,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'comments_total') AS comments_total,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'shares') AS shares,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'saves') AS saves,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'reach') AS reach,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'impressions') AS impressions,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'views') AS views,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'clicks') AS clicks,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'total_interactions') AS total_interactions,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'reaction_like') AS reaction_like,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'reaction_love') AS reaction_love,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'reaction_care') AS reaction_care,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'reaction_wow') AS reaction_wow,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'reaction_haha') AS reaction_haha,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'reaction_sad') AS reaction_sad,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'reaction_angry') AS reaction_angry,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'reel_total_watch_time_ms') AS reel_total_watch_time_ms,
    max(status.metric_value) FILTER (WHERE status.metric_key = 'reel_average_watch_time_ms') AS reel_average_watch_time_ms
  FROM ccpun_social.post_metric_status AS status
  WHERE status.metric_status = 'available'
  GROUP BY status.snapshot_id
), base AS (
  SELECT
    snapshot.id AS snapshot_id,
    current.content_id,
    current.publication_id,
    current.provider,
    current.platform,
    current.provider_account_id,
    current.provider_object_id,
    current.permalink,
    current.thumbnail,
    current.provider_media_type,
    current.format_standard,
    current.published_at_utc,
    current.published_at_bkk,
    current.publish_date_bkk,
    current.publish_day_of_week,
    current.publish_hour_bkk,
    snapshot.fetched_at AS snapshot_at,
    extract(epoch FROM (snapshot.fetched_at - current.published_at_utc)) / 3600.0 AS post_age_hours
  FROM ccpun_social.social_provider_metric_snapshot AS snapshot
  JOIN ccpun_social.marketing_content_current AS current ON current.content_id = snapshot.content_id
)
SELECT
  base.*,
  CASE
    WHEN base.post_age_hours BETWEEN 18 AND 30 THEN '24h'
    WHEN base.post_age_hours BETWEEN 144 AND 192 THEN '7d'
    WHEN base.post_age_hours BETWEEN 600 AND 744 THEN '28d'
    ELSE 'latest'
  END AS metric_window,
  CASE
    WHEN base.post_age_hours BETWEEN 18 AND 30 THEN 24
    WHEN base.post_age_hours BETWEEN 144 AND 192 THEN 168
    WHEN base.post_age_hours BETWEEN 600 AND 744 THEN 672
    ELSE NULL
  END AS target_window_hours,
  metrics.reactions_total,
  metrics.likes,
  metrics.comments_total,
  metrics.shares,
  metrics.saves,
  metrics.reach,
  metrics.impressions,
  CASE
    WHEN metrics.reach IS NULL OR metrics.reach = 0 THEN NULL
    ELSE (coalesce(metrics.reactions_total,metrics.likes,0) + coalesce(metrics.comments_total,0) + coalesce(metrics.shares,0) + coalesce(metrics.saves,0)) / metrics.reach
  END AS engagement_rate_by_reach,
  CASE
    WHEN metrics.reach IS NULL OR metrics.reach = 0 THEN NULL
    ELSE (coalesce(metrics.comments_total,0) + coalesce(metrics.shares,0) + coalesce(metrics.saves,0)) / metrics.reach
  END AS deep_engagement_rate,
  metrics.views,
  metrics.clicks,
  metrics.total_interactions,
  metrics.reaction_like,
  metrics.reaction_love,
  metrics.reaction_care,
  metrics.reaction_wow,
  metrics.reaction_haha,
  metrics.reaction_sad,
  metrics.reaction_angry,
  metrics.reel_total_watch_time_ms,
  metrics.reel_average_watch_time_ms
FROM base
LEFT JOIN metrics ON metrics.snapshot_id = base.snapshot_id;
-- checksum-source-end

INSERT INTO ccpun_social.schema_migration (version, checksum)
VALUES ('20260902_social_marketing_mart_p1_meta_insights', 'sha256:7bdc2c2b80b59d7364d92ec88dd66ccd5472390291bf0bc3ba82ec424718f671')
ON CONFLICT (version) DO NOTHING;

COMMIT;

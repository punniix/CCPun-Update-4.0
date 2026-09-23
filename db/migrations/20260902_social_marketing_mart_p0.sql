BEGIN;

SELECT pg_advisory_xact_lock(hashtext('ccpun_social:20260902_social_marketing_mart_p0'));
SELECT 1 / CASE WHEN EXISTS (
    SELECT 1 FROM ccpun_social.schema_migration
    WHERE version = '20260901_website_42_social_provider_native_history'
      AND checksum = 'sha256:cc4c2516ad261983d3d3997796711fb9b0290afe8625ab82fc002f4536bc549c'
  ) THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT 1 / CASE WHEN NOT EXISTS (
  SELECT 1 FROM ccpun_social.schema_migration
  WHERE version='20260902_social_marketing_mart_p0'
    AND checksum<>'sha256:ebd2a708c4dc6c524cf93147a3446c3c3cd92b76cb626291a6662c2b7ca878f0'
) THEN 1 ELSE 0 END AS checksum_guard;

-- checksum-source-begin
CREATE TABLE IF NOT EXISTS ccpun_social.social_metric_capability (
  provider text NOT NULL CHECK (provider IN ('meta', 'youtube', 'tiktok')),
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'youtube', 'tiktok')),
  metric_key text NOT NULL CHECK (metric_key ~ '^[a-z0-9_]{1,80}$'),
  native_metric_key text CHECK (native_metric_key IS NULL OR length(native_metric_key) BETWEEN 1 AND 120),
  collection_state text NOT NULL CHECK (collection_state IN (
    'requested', 'not_requested', 'unsupported', 'permission_denied', 'deprecated'
  )),
  provider_api_version text,
  note text CHECK (note IS NULL OR length(note) <= 1000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, platform, metric_key)
);

INSERT INTO ccpun_social.social_metric_capability
(provider,platform,metric_key,native_metric_key,collection_state,note)
VALUES
  ('meta','facebook','reactions_total','facebook.likes','requested','Current collector reads reactions.summary.total_count; marketing layer names this reactions_total rather than likes.'),
  ('meta','facebook','comments_total','facebook.comments','requested','Current collector reads comments.summary.total_count.'),
  ('meta','facebook','shares','facebook.shares','requested','Current collector reads shares.count; values remain provider truth and are subject to QA review.'),
  ('meta','facebook','reach','facebook.reach','not_requested','Adapter can represent Reach but the current Meta collector does not request it.'),
  ('meta','facebook','impressions','facebook.impressions','not_requested','Not requested by the current Meta collector.'),
  ('meta','facebook','saves','facebook.saves','not_requested','Not requested by the current Meta collector.'),
  ('meta','instagram','likes','instagram.likes','requested','Current collector reads like_count.'),
  ('meta','instagram','comments_total','instagram.comments','requested','Current collector reads comments_count.'),
  ('meta','instagram','shares','instagram.shares','not_requested','Not requested by the current Meta collector; API availability must be audited before use.'),
  ('meta','instagram','saves','instagram.saves','not_requested','Not requested by the current Meta collector; API availability must be audited before use.'),
  ('meta','instagram','reach','instagram.reach','not_requested','Not requested by the current Meta collector; API availability must be audited before use.'),
  ('meta','instagram','impressions','instagram.impressions','not_requested','Not requested by the current Meta collector; API availability must be audited before use.')
ON CONFLICT (provider,platform,metric_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS ccpun_social.social_data_quality_review (
  content_id text NOT NULL REFERENCES ccpun_social.social_provider_content(id),
  rule_key text NOT NULL CHECK (rule_key ~ '^[A-Z0-9_]{1,80}$'),
  status text NOT NULL CHECK (status IN ('unreviewed', 'verified', 'needs_review', 'provider_limitation', 'suspected_mapping_issue')),
  note text CHECK (note IS NULL OR length(note) <= 2000),
  verified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, rule_key)
);

CREATE OR REPLACE VIEW ccpun_social.marketing_content_current AS
SELECT
  content.id AS content_id,
  content.linked_publication_id AS publication_id,
  publication.variant_id,
  variant.master_content_id,
  content.provider,
  content.platform,
  content.provider_account_id,
  content.provider_object_id,
  content.published_at AS published_at_utc,
  content.published_at AT TIME ZONE 'Asia/Bangkok' AS published_at_bkk,
  (content.published_at AT TIME ZONE 'Asia/Bangkok')::date AS publish_date_bkk,
  extract(isodow FROM content.published_at AT TIME ZONE 'Asia/Bangkok')::smallint AS publish_day_of_week,
  extract(hour FROM content.published_at AT TIME ZONE 'Asia/Bangkok')::smallint AS publish_hour_bkk,
  content.text_content,
  content.media_type AS provider_media_type,
  CASE
    WHEN lower(content.media_type) IN ('mobile_status_update','text','text-post') THEN 'text'
    WHEN lower(content.media_type) IN ('multi_image') THEN 'multi_image'
    WHEN lower(content.media_type) IN ('carousel_album','carousel') THEN 'carousel'
    WHEN lower(content.media_type) IN ('added_photos','photo-post','image','image-post') THEN 'image'
    WHEN lower(content.media_type) IN ('added_video','video','video-post') THEN 'video'
    WHEN lower(content.media_type) IN ('reel','reels') THEN 'reel'
    WHEN lower(content.media_type) = 'story' THEN 'story'
    WHEN lower(content.media_type) = 'link' THEN 'link'
    ELSE 'other'
  END AS format_standard,
  content.permalink_url AS permalink,
  content.thumbnail_url AS thumbnail,
  content.first_seen_at,
  content.last_seen_at,
  'current'::text AS record_type
FROM ccpun_social.social_provider_content AS content
LEFT JOIN ccpun_social.social_publication AS publication ON publication.id = content.linked_publication_id
LEFT JOIN ccpun_social.social_variant_link AS variant ON variant.variant_id = publication.variant_id;

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
    WHEN observation.native_metric_key IS NOT NULL THEN 'available'
    WHEN capability.collection_state = 'requested' THEN 'not_returned'
    ELSE capability.collection_state
  END AS metric_status,
  capability.provider_api_version,
  capability.note AS capability_note
FROM ccpun_social.social_provider_metric_snapshot AS snapshot
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
    max(status.metric_value) FILTER (WHERE status.metric_key = 'impressions') AS impressions
  FROM ccpun_social.post_metric_status AS status
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
  END AS deep_engagement_rate
FROM base
LEFT JOIN metrics ON metrics.snapshot_id = base.snapshot_id;

CREATE OR REPLACE VIEW ccpun_social.post_data_quality AS
SELECT
  performance.content_id,
  performance.snapshot_id,
  performance.platform,
  'FB_SHARE_OUTLIER'::text AS rule_key,
  CASE
    WHEN review.status IS NOT NULL THEN review.status
    WHEN performance.platform = 'facebook'
      AND performance.shares IS NOT NULL
      AND performance.reactions_total IS NOT NULL
      AND performance.reactions_total > 0
      AND performance.shares > performance.reactions_total * 5
      THEN 'needs_review'
    ELSE 'unreviewed'
  END AS data_quality_status,
  COALESCE(
    review.note,
    CASE
      WHEN performance.platform = 'facebook'
        AND performance.shares IS NOT NULL
        AND performance.reactions_total IS NOT NULL
        AND performance.reactions_total > 0
        AND performance.shares > performance.reactions_total * 5
      THEN 'Facebook shares exceed 5x reactions_total; preserve provider value and verify definition/source before interpretation.'
      ELSE 'No automatic FB share outlier detected; provider metric definition has not been manually verified for this snapshot.'
    END
  ) AS data_quality_note,
  review.verified_at
FROM ccpun_social.post_performance_snapshot AS performance
LEFT JOIN ccpun_social.social_data_quality_review AS review
  ON review.content_id = performance.content_id AND review.rule_key = 'FB_SHARE_OUTLIER';

REVOKE ALL PRIVILEGES ON ccpun_social.social_metric_capability, ccpun_social.social_data_quality_review FROM ccpun_social_runtime;
GRANT SELECT ON ccpun_social.social_metric_capability, ccpun_social.social_data_quality_review TO ccpun_social_runtime;
GRANT SELECT ON ccpun_social.marketing_content_current, ccpun_social.post_metric_status, ccpun_social.post_performance_snapshot, ccpun_social.post_data_quality TO ccpun_social_runtime;
-- checksum-source-end

INSERT INTO ccpun_social.schema_migration (version, checksum)
VALUES ('20260902_social_marketing_mart_p0', 'sha256:ebd2a708c4dc6c524cf93147a3446c3c3cd92b76cb626291a6662c2b7ca878f0')
ON CONFLICT (version) DO NOTHING;

COMMIT;

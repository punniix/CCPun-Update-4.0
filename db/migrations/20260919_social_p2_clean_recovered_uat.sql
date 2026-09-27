BEGIN;

SELECT pg_advisory_xact_lock(hashtext('ccpun_social:20260919_social_p2_clean_recovered_uat'));
SELECT 1 / CASE WHEN EXISTS (
  SELECT 1 FROM ccpun_social.schema_migration
  WHERE version='20260902_social_marketing_mart_p1_meta_insights'
    AND checksum='sha256:7bdc2c2b80b59d7364d92ec88dd66ccd5472390291bf0bc3ba82ec424718f671'
) THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT 1 / CASE WHEN NOT EXISTS (
  SELECT 1 FROM ccpun_social.schema_migration
  WHERE version='20260919_social_p2_clean_recovered_uat'
    AND checksum<>'sha256:67af0f20447f5d6bcfc3d3c7078a2a0fb22a81475bbb40d5886e8a9b83906eb4'
) THEN 1 ELSE 0 END AS checksum_guard;

-- Recovered from Production pg_get_viewdef() because the Production ledger
-- contains 20260902_social_marketing_mart_p2_clean but GitHub had no source file.
-- checksum-source-begin
ALTER TABLE ccpun_social.social_metric_capability
  ADD COLUMN IF NOT EXISTS required_for_clean boolean NOT NULL DEFAULT true;

UPDATE ccpun_social.social_metric_capability
SET required_for_clean=false,updated_at=now()
WHERE provider='meta' AND platform='facebook'
  AND metric_key IN ('reaction_like','reaction_love','reaction_care','reaction_wow','reaction_haha','reaction_sad','reaction_angry');

CREATE OR REPLACE VIEW ccpun_social.metric_observation_latest_clean AS
 WITH ranked AS (
         SELECT snapshot.id AS snapshot_id,
            snapshot.content_id,
            snapshot.provider,
            snapshot.platform,
            snapshot.provider_object_id,
            snapshot.fetched_at AS metric_fetched_at,
            metric.value ->> 'key'::text AS native_metric_key,
            metric.value ->> 'label'::text AS metric_label,
            (metric.value ->> 'value'::text)::numeric AS metric_value,
            metric.value ->> 'unit'::text AS metric_unit,
            metric.value ->> 'dimension'::text AS metric_dimension,
            row_number() OVER (PARTITION BY snapshot.content_id, (metric.value ->> 'key'::text) ORDER BY snapshot.fetched_at DESC, snapshot.id DESC) AS recency_rank
           FROM ccpun_social.social_provider_metric_snapshot snapshot
             CROSS JOIN LATERAL jsonb_array_elements(snapshot.native_metrics) metric(value)
          WHERE jsonb_typeof(metric.value -> 'value'::text) = 'number'::text
        )
 SELECT snapshot_id,
    content_id,
    provider,
    platform,
    provider_object_id,
    metric_fetched_at,
    native_metric_key,
    metric_label,
    metric_value,
    metric_unit,
    metric_dimension
   FROM ranked
  WHERE recency_rank = 1;;

CREATE OR REPLACE VIEW ccpun_social.post_metric_latest_clean AS
 SELECT content.content_id,
    content.publication_id,
    content.variant_id,
    content.master_content_id,
    content.provider,
    content.platform,
    content.provider_account_id,
    content.provider_object_id,
    content.provider_media_type,
    content.format_standard,
    content.published_at_utc,
    content.published_at_bkk,
    content.publish_date_bkk,
    content.publish_day_of_week,
    content.publish_hour_bkk,
    capability.metric_key,
    capability.native_metric_key,
    capability.collection_state,
    capability.required_for_clean,
    capability.applies_to_format,
    observation.metric_value,
    observation.metric_unit,
    observation.metric_dimension,
    observation.metric_fetched_at,
        CASE
            WHEN capability.applies_to_format IS NOT NULL AND capability.applies_to_format <> content.format_standard THEN 'unsupported'::text
            WHEN observation.native_metric_key IS NOT NULL THEN 'available'::text
            WHEN capability.collection_state = 'requested'::text THEN 'missing_requested'::text
            ELSE capability.collection_state
        END AS metric_status,
    capability.provider_api_version,
    capability.note AS metric_note
   FROM ccpun_social.marketing_content_current content
     JOIN ccpun_social.social_metric_capability capability ON capability.provider = content.provider AND capability.platform = content.platform
     LEFT JOIN ccpun_social.metric_observation_latest_clean observation ON observation.content_id = content.content_id AND observation.native_metric_key = capability.native_metric_key;;

CREATE OR REPLACE VIEW ccpun_social.post_performance_current_clean AS
 WITH metric_pivot AS (
         SELECT post_metric_latest_clean.content_id,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'reactions_total'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS reactions_total,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'likes'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS likes,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'comments_total'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS comments_total,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'shares'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS shares,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'saves'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS saves,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'reach'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS reach,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'impressions'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS impressions,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'views'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS views,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'clicks'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS clicks,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'total_interactions'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS total_interactions,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'reaction_like'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS reaction_like,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'reaction_love'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS reaction_love,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'reaction_care'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS reaction_care,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'reaction_wow'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS reaction_wow,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'reaction_haha'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS reaction_haha,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'reaction_sad'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS reaction_sad,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'reaction_angry'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS reaction_angry,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'reel_total_watch_time_ms'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS reel_total_watch_time_ms,
            max(post_metric_latest_clean.metric_value) FILTER (WHERE post_metric_latest_clean.metric_key = 'reel_average_watch_time_ms'::text AND post_metric_latest_clean.metric_status = 'available'::text) AS reel_average_watch_time_ms,
            min(post_metric_latest_clean.metric_fetched_at) FILTER (WHERE post_metric_latest_clean.metric_status = 'available'::text) AS oldest_available_metric_at,
            max(post_metric_latest_clean.metric_fetched_at) FILTER (WHERE post_metric_latest_clean.metric_status = 'available'::text) AS latest_available_metric_at
           FROM ccpun_social.post_metric_latest_clean
          GROUP BY post_metric_latest_clean.content_id
        ), coverage AS (
         SELECT post_metric_latest_clean.content_id,
            count(*) FILTER (WHERE post_metric_latest_clean.collection_state = 'requested'::text AND post_metric_latest_clean.required_for_clean AND post_metric_latest_clean.metric_status <> 'unsupported'::text)::integer AS requested_metric_count,
            count(*) FILTER (WHERE post_metric_latest_clean.collection_state = 'requested'::text AND post_metric_latest_clean.required_for_clean AND post_metric_latest_clean.metric_status = 'available'::text)::integer AS available_requested_metric_count,
            count(*) FILTER (WHERE post_metric_latest_clean.collection_state = 'requested'::text AND post_metric_latest_clean.required_for_clean AND post_metric_latest_clean.metric_status = 'missing_requested'::text)::integer AS missing_requested_metric_count,
            count(*) FILTER (WHERE post_metric_latest_clean.metric_status = 'unsupported'::text)::integer AS unsupported_metric_count
           FROM ccpun_social.post_metric_latest_clean
          GROUP BY post_metric_latest_clean.content_id
        ), snapshot_counts AS (
         SELECT social_provider_metric_snapshot.content_id,
            count(*)::integer AS snapshot_count
           FROM ccpun_social.social_provider_metric_snapshot
          GROUP BY social_provider_metric_snapshot.content_id
        ), base AS (
         SELECT content.content_id,
            content.publication_id,
            content.variant_id,
            content.master_content_id,
            content.provider,
            content.platform,
            content.provider_account_id,
            content.provider_object_id,
            content.permalink,
            content.thumbnail,
            content.provider_media_type,
            content.format_standard,
            content.published_at_utc,
            content.published_at_bkk,
            content.publish_date_bkk,
            content.publish_day_of_week,
            content.publish_hour_bkk,
            content.text_content AS copy_text_raw,
            regexp_replace(btrim(content.text_content), '[[:space:]]+'::text, ' '::text, 'g'::text) AS copy_text_clean,
            char_length(content.text_content) AS copy_length_chars,
            content.first_seen_at,
            content.last_seen_at,
            COALESCE(snapshot_counts.snapshot_count, 0) AS snapshot_count,
            COALESCE(coverage.requested_metric_count, 0) AS requested_metric_count,
            COALESCE(coverage.available_requested_metric_count, 0) AS available_requested_metric_count,
            COALESCE(coverage.missing_requested_metric_count, 0) AS missing_requested_metric_count,
            COALESCE(coverage.unsupported_metric_count, 0) AS unsupported_metric_count,
            metric_pivot.reactions_total,
            metric_pivot.likes,
            metric_pivot.comments_total,
            metric_pivot.shares,
            metric_pivot.saves,
            metric_pivot.reach,
            metric_pivot.impressions,
            metric_pivot.views,
            metric_pivot.clicks,
            metric_pivot.total_interactions,
            metric_pivot.reaction_like,
            metric_pivot.reaction_love,
            metric_pivot.reaction_care,
            metric_pivot.reaction_wow,
            metric_pivot.reaction_haha,
            metric_pivot.reaction_sad,
            metric_pivot.reaction_angry,
            metric_pivot.reel_total_watch_time_ms,
            metric_pivot.reel_average_watch_time_ms,
            metric_pivot.oldest_available_metric_at,
            metric_pivot.latest_available_metric_at
           FROM ccpun_social.marketing_content_current content
             LEFT JOIN metric_pivot ON metric_pivot.content_id = content.content_id
             LEFT JOIN coverage ON coverage.content_id = content.content_id
             LEFT JOIN snapshot_counts ON snapshot_counts.content_id = content.content_id
        ), derived AS (
         SELECT base.content_id,
            base.publication_id,
            base.variant_id,
            base.master_content_id,
            base.provider,
            base.platform,
            base.provider_account_id,
            base.provider_object_id,
            base.permalink,
            base.thumbnail,
            base.provider_media_type,
            base.format_standard,
            base.published_at_utc,
            base.published_at_bkk,
            base.publish_date_bkk,
            base.publish_day_of_week,
            base.publish_hour_bkk,
            base.copy_text_raw,
            base.copy_text_clean,
            base.copy_length_chars,
            base.first_seen_at,
            base.last_seen_at,
            base.snapshot_count,
            base.requested_metric_count,
            base.available_requested_metric_count,
            base.missing_requested_metric_count,
            base.unsupported_metric_count,
            base.reactions_total,
            base.likes,
            base.comments_total,
            base.shares,
            base.saves,
            base.reach,
            base.impressions,
            base.views,
            base.clicks,
            base.total_interactions,
            base.reaction_like,
            base.reaction_love,
            base.reaction_care,
            base.reaction_wow,
            base.reaction_haha,
            base.reaction_sad,
            base.reaction_angry,
            base.reel_total_watch_time_ms,
            base.reel_average_watch_time_ms,
            base.oldest_available_metric_at,
            base.latest_available_metric_at,
                CASE
                    WHEN base.requested_metric_count = 0 THEN NULL::numeric
                    ELSE base.available_requested_metric_count::numeric / base.requested_metric_count::numeric
                END AS metric_completeness_rate,
            EXTRACT(epoch FROM base.latest_available_metric_at - base.oldest_available_metric_at) / 3600.0 AS metric_time_spread_hours,
                CASE
                    WHEN base.platform = 'facebook'::text AND base.reactions_total IS NOT NULL AND base.comments_total IS NOT NULL AND base.shares IS NOT NULL THEN base.reactions_total + base.comments_total + base.shares
                    WHEN base.platform = 'instagram'::text AND base.likes IS NOT NULL AND base.comments_total IS NOT NULL AND base.shares IS NOT NULL AND base.saves IS NOT NULL THEN base.likes + base.comments_total + base.shares + base.saves
                    ELSE NULL::numeric
                END AS known_engagement_total,
                CASE
                    WHEN base.platform = 'facebook'::text AND base.comments_total IS NOT NULL AND base.shares IS NOT NULL THEN base.comments_total + base.shares
                    WHEN base.platform = 'instagram'::text AND base.comments_total IS NOT NULL AND base.shares IS NOT NULL AND base.saves IS NOT NULL THEN base.comments_total + base.shares + base.saves
                    ELSE NULL::numeric
                END AS known_deep_engagement_total,
                CASE
                    WHEN base.platform = 'facebook'::text AND (base.reaction_like IS NOT NULL OR base.reaction_love IS NOT NULL OR base.reaction_care IS NOT NULL OR base.reaction_wow IS NOT NULL OR base.reaction_haha IS NOT NULL OR base.reaction_sad IS NOT NULL OR base.reaction_angry IS NOT NULL) THEN COALESCE(base.reaction_like, 0::numeric) + COALESCE(base.reaction_love, 0::numeric) + COALESCE(base.reaction_care, 0::numeric) + COALESCE(base.reaction_wow, 0::numeric) + COALESCE(base.reaction_haha, 0::numeric) + COALESCE(base.reaction_sad, 0::numeric) + COALESCE(base.reaction_angry, 0::numeric)
                    ELSE NULL::numeric
                END AS reaction_breakdown_sum,
                CASE
                    WHEN base.platform = 'instagram'::text AND base.likes IS NOT NULL AND base.comments_total IS NOT NULL AND base.shares IS NOT NULL AND base.saves IS NOT NULL THEN base.likes + base.comments_total + base.shares + base.saves
                    ELSE NULL::numeric
                END AS instagram_visible_interaction_sum
           FROM base
        )
 SELECT content_id,
    publication_id,
    variant_id,
    master_content_id,
    provider,
    platform,
    provider_account_id,
    provider_object_id,
    permalink,
    thumbnail,
    provider_media_type,
    format_standard,
    published_at_utc,
    published_at_bkk,
    publish_date_bkk,
    publish_day_of_week,
    publish_hour_bkk,
    copy_text_raw,
    copy_text_clean,
    copy_length_chars,
    first_seen_at,
    last_seen_at,
    snapshot_count,
    requested_metric_count,
    available_requested_metric_count,
    missing_requested_metric_count,
    unsupported_metric_count,
    reactions_total,
    likes,
    comments_total,
    shares,
    saves,
    reach,
    impressions,
    views,
    clicks,
    total_interactions,
    reaction_like,
    reaction_love,
    reaction_care,
    reaction_wow,
    reaction_haha,
    reaction_sad,
    reaction_angry,
    reel_total_watch_time_ms,
    reel_average_watch_time_ms,
    oldest_available_metric_at,
    latest_available_metric_at,
    metric_completeness_rate,
    metric_time_spread_hours,
    known_engagement_total,
    known_deep_engagement_total,
    reaction_breakdown_sum,
    instagram_visible_interaction_sum,
        CASE
            WHEN reach IS NULL OR reach = 0::numeric OR known_engagement_total IS NULL THEN NULL::numeric
            ELSE known_engagement_total / reach
        END AS engagement_rate_by_reach,
        CASE
            WHEN reach IS NULL OR reach = 0::numeric OR known_deep_engagement_total IS NULL THEN NULL::numeric
            ELSE known_deep_engagement_total / reach
        END AS deep_engagement_rate,
        CASE
            WHEN views IS NULL OR views = 0::numeric OR clicks IS NULL THEN NULL::numeric
            ELSE clicks / views
        END AS click_rate_by_view,
        CASE
            WHEN reach IS NULL OR reach = 0::numeric OR shares IS NULL THEN NULL::numeric
            ELSE shares / reach
        END AS share_rate_by_reach,
        CASE
            WHEN reach IS NULL OR reach = 0::numeric OR saves IS NULL THEN NULL::numeric
            ELSE saves / reach
        END AS save_rate_by_reach,
    reel_total_watch_time_ms / 1000.0 AS reel_total_watch_time_seconds,
    reel_average_watch_time_ms / 1000.0 AS reel_average_watch_time_seconds,
        CASE
            WHEN platform <> 'facebook'::text THEN 'not_applicable'::text
            WHEN reaction_breakdown_sum IS NULL OR reactions_total IS NULL THEN 'insufficient_data'::text
            WHEN reaction_breakdown_sum = reactions_total THEN 'consistent_same_observation'::text
            ELSE 'needs_review_definition_or_window'::text
        END AS facebook_reaction_consistency_status,
        CASE
            WHEN platform <> 'instagram'::text THEN 'not_applicable'::text
            WHEN instagram_visible_interaction_sum IS NULL OR total_interactions IS NULL THEN 'insufficient_data'::text
            WHEN instagram_visible_interaction_sum = total_interactions THEN 'consistent_same_observation'::text
            ELSE 'needs_review_provider_components'::text
        END AS instagram_interaction_consistency_status,
        CASE
            WHEN platform <> 'facebook'::text THEN 'not_applicable'::text
            WHEN shares IS NULL OR reactions_total IS NULL OR reactions_total = 0::numeric THEN 'insufficient_data'::text
            WHEN shares > (reactions_total * 5::numeric) THEN 'needs_review'::text
            ELSE 'unreviewed'::text
        END AS facebook_share_quality_status,
        CASE
            WHEN platform = 'facebook'::text AND reaction_breakdown_sum IS NOT NULL AND reactions_total IS NOT NULL AND reaction_breakdown_sum <> reactions_total OR platform = 'instagram'::text AND instagram_visible_interaction_sum IS NOT NULL AND total_interactions IS NOT NULL AND instagram_visible_interaction_sum <> total_interactions OR platform = 'facebook'::text AND shares IS NOT NULL AND reactions_total IS NOT NULL AND reactions_total > 0::numeric AND shares > (reactions_total * 5::numeric) THEN 'needs_review'::text
            WHEN missing_requested_metric_count > 0 THEN 'partial_metrics'::text
            ELSE 'usable'::text
        END AS data_quality_status,
    NULLIF(concat_ws(' | '::text,
        CASE
            WHEN platform = 'facebook'::text AND reaction_breakdown_sum IS NOT NULL AND reactions_total IS NOT NULL AND reaction_breakdown_sum <> reactions_total THEN 'Facebook reaction breakdown differs from the legacy reaction total; preserve both native definitions.'::text
            ELSE NULL::text
        END,
        CASE
            WHEN platform = 'instagram'::text AND instagram_visible_interaction_sum IS NOT NULL AND total_interactions IS NOT NULL AND instagram_visible_interaction_sum <> total_interactions THEN 'Instagram total_interactions differs from the visible component sum; preserve the native total independently.'::text
            ELSE NULL::text
        END,
        CASE
            WHEN platform = 'facebook'::text AND shares IS NOT NULL AND reactions_total IS NOT NULL AND reactions_total > 0::numeric AND shares > (reactions_total * 5::numeric) THEN 'Facebook shares exceed five times the legacy reactions counter; verify provider definition before interpretation.'::text
            ELSE NULL::text
        END), ''::text) AS data_quality_note
   FROM derived;;

CREATE OR REPLACE VIEW ccpun_social.platform_metric_coverage_clean AS
 SELECT provider,
    platform,
    format_standard,
    metric_key,
    native_metric_key,
    max(metric_unit) FILTER (WHERE metric_status = 'available'::text) AS metric_unit,
    max(metric_dimension) FILTER (WHERE metric_status = 'available'::text) AS metric_dimension,
    count(*)::integer AS content_count,
    count(*) FILTER (WHERE metric_status = 'available'::text)::integer AS available_count,
    count(*) FILTER (WHERE metric_status = 'missing_requested'::text)::integer AS missing_requested_count,
    count(*) FILTER (WHERE metric_status = 'unsupported'::text)::integer AS unsupported_count,
        CASE
            WHEN count(*) FILTER (WHERE metric_status <> 'unsupported'::text) = 0 THEN NULL::numeric
            ELSE count(*) FILTER (WHERE metric_status = 'available'::text)::numeric / count(*) FILTER (WHERE metric_status <> 'unsupported'::text)::numeric
        END AS availability_rate,
    min(metric_value) FILTER (WHERE metric_status = 'available'::text) AS min_value,
    max(metric_value) FILTER (WHERE metric_status = 'available'::text) AS max_value,
    max(metric_fetched_at) FILTER (WHERE metric_status = 'available'::text) AS latest_metric_at
   FROM ccpun_social.post_metric_latest_clean
  GROUP BY provider, platform, format_standard, metric_key, native_metric_key;;

CREATE OR REPLACE VIEW ccpun_social.platform_metric_benchmark_clean AS
 SELECT provider,
    platform,
    format_standard,
    metric_key,
    max(metric_unit) AS metric_unit,
    max(metric_dimension) AS metric_dimension,
    count(*)::integer AS sample_size,
    min(metric_value) AS min_value,
    percentile_cont(0.25::double precision) WITHIN GROUP (ORDER BY (metric_value::double precision)) AS p25,
    percentile_cont(0.50::double precision) WITHIN GROUP (ORDER BY (metric_value::double precision)) AS median,
    percentile_cont(0.75::double precision) WITHIN GROUP (ORDER BY (metric_value::double precision)) AS p75,
    percentile_cont(0.90::double precision) WITHIN GROUP (ORDER BY (metric_value::double precision)) AS p90,
    max(metric_value) AS max_value,
    max(metric_fetched_at) AS latest_metric_at,
        CASE
            WHEN count(*) < 10 THEN 'insufficient'::text
            WHEN count(*) < 20 THEN 'exploratory'::text
            ELSE 'usable'::text
        END AS benchmark_status
   FROM ccpun_social.post_metric_latest_clean
  WHERE metric_status = 'available'::text
  GROUP BY provider, platform, format_standard, metric_key;;

REVOKE ALL ON ccpun_social.metric_observation_latest_clean,
  ccpun_social.post_metric_latest_clean,
  ccpun_social.post_performance_current_clean,
  ccpun_social.platform_metric_coverage_clean,
  ccpun_social.platform_metric_benchmark_clean FROM PUBLIC;
GRANT SELECT ON ccpun_social.metric_observation_latest_clean,
  ccpun_social.post_metric_latest_clean,
  ccpun_social.post_performance_current_clean,
  ccpun_social.platform_metric_coverage_clean,
  ccpun_social.platform_metric_benchmark_clean TO ccpun_social_runtime;
-- checksum-source-end

INSERT INTO ccpun_social.schema_migration(version,checksum)
VALUES('20260919_social_p2_clean_recovered_uat','sha256:67af0f20447f5d6bcfc3d3c7078a2a0fb22a81475bbb40d5886e8a9b83906eb4')
ON CONFLICT(version) DO NOTHING;

COMMIT;

SELECT
  EXISTS (
    SELECT 1 FROM ccpun_social.schema_migration
    WHERE version = '20260902_social_marketing_mart_p2_metric_provenance'
      AND checksum = 'sha256:5b421a7bb67798d6b45911c1b05e3f54bc9f50c0482b48857f6780e7379ef866'
  ) AS migration_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='ccpun_social' AND table_name='social_metric_capability'
      AND column_name='collection_profile'
  ) AS collection_profile_column_ok,
  EXISTS (
    SELECT 1 FROM ccpun_social.social_metric_capability
    WHERE provider='meta' AND platform='facebook' AND metric_key='shares'
      AND collection_profile='meta-base-content-v1'
  ) AS facebook_shares_base_profile_ok,
  EXISTS (
    SELECT 1 FROM ccpun_social.social_metric_capability
    WHERE provider='meta' AND platform='facebook' AND metric_key='views'
      AND collection_profile='meta-p1-insights-v1'
  ) AS facebook_views_insights_profile_ok,
  EXISTS (
    SELECT 1 FROM ccpun_social.social_metric_capability
    WHERE provider='meta' AND platform='instagram' AND metric_key='comments_total'
      AND collection_profile='meta-base-content-v1'
  ) AS instagram_comments_base_profile_ok,
  EXISTS (
    SELECT 1 FROM ccpun_social.social_metric_capability
    WHERE provider='meta' AND platform='instagram' AND metric_key='reach'
      AND collection_profile='meta-p1-insights-v1'
  ) AS instagram_reach_insights_profile_ok,
  NOT EXISTS (
    SELECT 1 FROM ccpun_social.post_metric_status_latest
    WHERE provider='meta' AND platform='facebook' AND metric_key='shares'
      AND metric_status='not_fetched'
  ) AS facebook_share_not_fetched_eliminated,
  EXISTS (
    SELECT 1 FROM ccpun_social.post_metric_status_latest
    WHERE provider='meta' AND platform='facebook' AND metric_key='shares'
      AND metric_status='not_returned'
  ) AS facebook_share_not_returned_present,
  NOT EXISTS (
    SELECT 1 FROM ccpun_social.post_metric_status_latest
    WHERE provider='meta' AND metric_value_stale
  ) AS no_stale_meta_values,
  (
    (SELECT count(*) FROM ccpun_social.post_performance_clean WHERE provider='meta')
      = (SELECT count(*) FROM ccpun_social.marketing_content_current WHERE provider='meta')
    AND (SELECT count(*) FROM ccpun_social.post_performance_clean WHERE provider='meta')
      = (SELECT count(DISTINCT content_id) FROM ccpun_social.post_performance_clean WHERE provider='meta')
  ) AS clean_post_count_ok,
  has_table_privilege('ccpun_social_runtime','ccpun_social.post_metric_status_latest','SELECT') AS runtime_status_read_ok,
  has_table_privilege('ccpun_social_runtime','ccpun_social.post_metric_coverage_summary','SELECT') AS runtime_coverage_read_ok,
  has_table_privilege('ccpun_social_runtime','ccpun_social.post_performance_clean','SELECT') AS runtime_clean_read_ok;

SELECT
  EXISTS (
    SELECT 1 FROM ccpun_social.schema_migration
    WHERE version = '20260902_social_marketing_mart_p0'
      AND checksum = 'sha256:ebd2a708c4dc6c524cf93147a3446c3c3cd92b76cb626291a6662c2b7ca878f0'
  ) AS migration_ok,
  to_regclass('ccpun_social.social_metric_capability') IS NOT NULL AS capability_table_ok,
  to_regclass('ccpun_social.social_data_quality_review') IS NOT NULL AS qa_review_table_ok,
  to_regclass('ccpun_social.marketing_content_current') IS NOT NULL AS content_view_ok,
  to_regclass('ccpun_social.post_metric_status') IS NOT NULL AS metric_status_view_ok,
  to_regclass('ccpun_social.post_performance_snapshot') IS NOT NULL AS performance_view_ok,
  to_regclass('ccpun_social.post_data_quality') IS NOT NULL AS data_quality_view_ok,
  NOT EXISTS (
    SELECT seed.platform, seed.metric_key
    FROM (VALUES
      ('facebook','reactions_total'),
      ('facebook','comments_total'),
      ('facebook','shares'),
      ('facebook','reach'),
      ('facebook','impressions'),
      ('facebook','saves'),
      ('instagram','likes'),
      ('instagram','comments_total'),
      ('instagram','shares'),
      ('instagram','saves'),
      ('instagram','reach'),
      ('instagram','impressions')
    ) AS seed(platform,metric_key)
    EXCEPT
    SELECT capability.platform, capability.metric_key
    FROM ccpun_social.social_metric_capability AS capability
    WHERE capability.provider='meta'
  ) AS meta_capability_seed_ok,
  has_table_privilege('ccpun_social_runtime','ccpun_social.social_metric_capability','SELECT') AS runtime_capability_read_ok,
  has_table_privilege('ccpun_social_runtime','ccpun_social.social_data_quality_review','SELECT') AS runtime_qa_read_ok,
  has_table_privilege('ccpun_social_runtime','ccpun_social.marketing_content_current','SELECT') AS runtime_content_view_read_ok,
  has_table_privilege('ccpun_social_runtime','ccpun_social.post_metric_status','SELECT') AS runtime_metric_view_read_ok,
  has_table_privilege('ccpun_social_runtime','ccpun_social.post_performance_snapshot','SELECT') AS runtime_performance_view_read_ok,
  NOT has_table_privilege('ccpun_social_runtime','ccpun_social.social_data_quality_review','INSERT,UPDATE,DELETE') AS runtime_qa_write_denied;

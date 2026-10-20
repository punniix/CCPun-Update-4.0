-- Run only after the durable migration on a verified UAT/Production branch.
-- All fields are metadata; no provider tokens or editorial payloads are emitted.
SELECT
  current_database() AS database_name,
  current_user AS inspected_by,
  (SELECT project_id FROM ccpun_admin.system_identity WHERE singleton=true) AS project_id,
  (SELECT branch_id FROM ccpun_admin.system_identity WHERE singleton=true) AS branch_id,
  to_regclass('ccpun_admin.seo_post_publish_job') IS NOT NULL AS outbox_exists,
  has_table_privilege('ccpun_admin_runtime','ccpun_admin.seo_post_publish_job','SELECT,INSERT') AS admin_producer_ready,
  has_column_privilege('ccpun_admin_runtime','ccpun_admin.seo_post_publish_job','owner_approved','UPDATE') AS owner_approval_ready,
  has_table_privilege('ccpun_seo_post_publish_worker','ccpun_admin.seo_post_publish_job','SELECT,INSERT,UPDATE') AS private_worker_ready,
  (SELECT count(*) FROM ccpun_admin.seo_post_publish_job) AS existing_job_count;

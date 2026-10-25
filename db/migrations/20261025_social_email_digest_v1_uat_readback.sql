BEGIN READ ONLY;

-- Run as ccpun_social_runtime on UAT after applying 20261025_social_email_digest_v1_uat.sql.
SELECT
  current_user='ccpun_social_runtime' AND current_database()='neondb' AS runtime_current,
  EXISTS (SELECT 1 FROM ccpun_social.schema_migration WHERE version='20261025_social_email_digest_v1'
    AND checksum='sha256:b5cc30b064ab9713a1131122eb9ac6cdc6ee14a45e2e50e2d3b7ce9795afc695') AS ledger_current,
  to_regclass('ccpun_social.social_email_digest') IS NOT NULL AS digest_table_current,
  to_regclass('ccpun_social.social_worker_job') IS NOT NULL AS worker_job_table_current,
  to_regclass('ccpun_social.social_worker_request_nonce') IS NOT NULL AS nonce_table_current,
  to_regclass('ccpun_social.social_email_digest_active_month') IS NOT NULL AS month_index_current,
  has_function_privilege(current_user,'ccpun_social.social_require_write(boolean,text)','EXECUTE') AS require_write_current,
  NOT has_table_privilege(current_user,'ccpun_social.social_email_digest','DELETE,TRUNCATE')
    AND NOT has_table_privilege(current_user,'ccpun_social.social_worker_job','DELETE,TRUNCATE')
    AND NOT has_table_privilege(current_user,'ccpun_social.social_worker_request_nonce','DELETE,TRUNCATE,UPDATE')
    AS no_delete_current,
  has_table_privilege(current_user,'ccpun_social.social_execution_audit','INSERT')
    AND NOT has_table_privilege(current_user,'ccpun_social.social_execution_audit','UPDATE,DELETE,TRUNCATE')
    AS audit_append_only;

ROLLBACK;

SELECT
  current_database() = 'neondb' AS database_ok,
  EXISTS (
    SELECT 1 FROM ccpun_admin.schema_migration
    WHERE version = '20260913_admin_operations_production_v1'
      AND checksum = 'sha256:5895b0882bf199c2017e761b15d87cac5a94bab44c5c832f68fa2b3cf385ac51'
  ) AS checksum_ok,
  EXISTS (
    SELECT 1 FROM ccpun_admin.system_identity
    WHERE singleton = true
      AND project_id = 'lively-bar-43618798'
      AND branch_id = 'br-long-resonance-b3ys5xrv'
      AND endpoint_id = 'ep-broad-butterfly-b3ro7u8w'
      AND database_name = 'neondb'
      AND migration_version = '20260913_admin_operations_production_v1'
      AND migration_checksum = 'sha256:5895b0882bf199c2017e761b15d87cac5a94bab44c5c832f68fa2b3cf385ac51'
  ) AS identity_ok,
  EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_admin_runtime') AS runtime_role_exists,
  EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'ccpun_admin_runtime'
      AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls
  ) AS runtime_role_restricted,
  has_database_privilege('ccpun_admin_runtime', 'neondb', 'CONNECT') AS database_connect_ok,
  has_schema_privilege('ccpun_admin_runtime', 'ccpun_admin', 'USAGE') AS admin_schema_usage_ok,
  NOT has_schema_privilege('ccpun_admin_runtime', 'ccpun_social', 'USAGE') AS social_schema_denied,
  (
    SELECT count(*) = 5
    FROM information_schema.role_table_grants
    WHERE grantee = 'ccpun_admin_runtime'
      AND table_schema = 'ccpun_admin'
      AND table_name IN ('system_identity','schema_migration','audit_log','research_snapshot','seo_suggestion')
      AND privilege_type = 'SELECT'
  ) AS admin_table_grants_ok,
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'ccpun_admin_runtime'
      AND table_schema = 'ccpun_social'
  ) AS social_objects_denied,
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_usage_grants
    WHERE grantee = 'ccpun_admin_runtime'
      AND object_schema = 'ccpun_social'
  ) AS social_sequences_denied,
  EXISTS (
    SELECT 1
    FROM information_schema.role_column_grants
    WHERE grantee = 'ccpun_admin_runtime'
      AND table_schema = 'ccpun_admin'
      AND table_name = 'seo_suggestion'
      AND privilege_type = 'UPDATE'
      AND column_name = 'status'
  ) AS seo_update_columns_ok,
  EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'ccpun_admin_runtime'
      AND table_schema = 'ccpun_admin'
      AND table_name = 'article_schedule'
      AND privilege_type = 'SELECT'
  ) AS scheduler_grants_preserved;

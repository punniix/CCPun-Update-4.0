SELECT
  current_database() = 'neondb' AS database_ok,
  EXISTS (
    SELECT 1 FROM private_line.schema_migration
    WHERE version = '20260917_private_line_runtime_v1_production'
      AND checksum = 'sha256:f562ba174f50cf617d0e12ffd13c46e5815b069dc823ecb7c8522d7b05d6c57b'
  ) AS checksum_ok,
  EXISTS (
    SELECT 1 FROM private_line.system_identity
    WHERE singleton = true
      AND project_id = 'lively-bar-43618798'
      AND branch_id = 'br-long-resonance-b3ys5xrv'
      AND endpoint_id = 'ep-broad-butterfly-b3ro7u8w'
      AND database_name = 'neondb'
      AND migration_version = '20260917_private_line_runtime_v1_production'
      AND migration_checksum = 'sha256:f562ba174f50cf617d0e12ffd13c46e5815b069dc823ecb7c8522d7b05d6c57b'
  ) AS identity_ok,
  EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'ccpun_line_ingress'
      AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls
  ) AS ingress_role_restricted,
  has_database_privilege('ccpun_line_ingress', 'neondb', 'CONNECT') AS ingress_connect_ok,
  has_schema_privilege('ccpun_line_ingress', 'private_line', 'USAGE') AS private_schema_usage_ok,
  NOT has_schema_privilege('ccpun_line_ingress', 'public', 'CREATE') AS public_schema_create_denied,
  has_function_privilege('ccpun_line_ingress', 'private_line.ingest_line_event(jsonb)', 'EXECUTE') AS ingest_execute_ok,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private_line' AND p.proname = 'ingest_line_event' AND p.prosecdef
  ) AS security_definer_ok,
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'ccpun_line_ingress' AND table_schema = 'private_line'
  ) AS private_tables_direct_denied,
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'ccpun_line_ingress' AND table_schema IN ('ccpun_admin','ccpun_social','neon_auth')
  ) AS other_private_tables_denied,
  NOT has_schema_privilege('ccpun_line_ingress', 'ccpun_admin', 'USAGE') AS admin_schema_denied,
  NOT has_schema_privilege('ccpun_line_ingress', 'ccpun_social', 'USAGE') AS social_schema_denied,
  (SELECT count(*) = 12 FROM information_schema.tables WHERE table_schema = 'private_line'
    AND table_name IN ('schema_migration','system_identity','customer','provider_identity','conversation','webhook_event','message','document','lead','advisor_case','safe_journey_state','message_tombstone')) AS table_shape_ok;

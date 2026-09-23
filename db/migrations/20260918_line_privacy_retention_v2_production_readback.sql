SELECT
  EXISTS(
    SELECT 1 FROM private_line.schema_migration
    WHERE version='20260918_line_privacy_retention_v2_production'
      AND checksum='sha256:ce3a55a27969b4effecb70af0bc8f5e4de4f9dc023fbd32fc91ded69a08005f8'
  ) AS migration_checksum_ok,
  to_regclass('private_line.privacy_export_manifest') IS NOT NULL AS export_manifest_table_ok,
  to_regclass('private_line.privacy_delete_audit_tombstone') IS NOT NULL AS delete_tombstone_table_ok,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_prepare_privacy_export(uuid)','EXECUTE') AS admin_export_prepare_ok,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_prepare_privacy_delete(uuid)','EXECUTE') AS admin_delete_prepare_ok,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_update_retention_policy(jsonb)','EXECUTE') AS admin_retention_update_ok,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_read_privacy_safety_health()','EXECUTE') AS admin_privacy_health_ok,
  NOT has_function_privilege('ccpun_line_ingress','private_line.admin_prepare_privacy_export(uuid)','EXECUTE') AS ingress_export_prepare_denied,
  NOT has_function_privilege('ccpun_line_ingress','private_line.admin_prepare_privacy_delete(uuid)','EXECUTE') AS ingress_delete_prepare_denied,
  (SELECT NOT EXISTS (
    SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f',p.proowner))) a
    WHERE a.grantee=0 AND a.privilege_type='EXECUTE'
  ) FROM pg_proc p WHERE p.oid='private_line.admin_prepare_privacy_export(uuid)'::regprocedure) AS public_export_prepare_denied,
  (SELECT NOT EXISTS (
    SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f',p.proowner))) a
    WHERE a.grantee=0 AND a.privilege_type='EXECUTE'
  ) FROM pg_proc p WHERE p.oid='private_line.admin_prepare_privacy_delete(uuid)'::regprocedure) AS public_delete_prepare_denied,
  (SELECT policy_mode='manual_review' AND automatic_delete_enabled=false
     FROM private_line.retention_policy WHERE singleton=true) AS retention_fail_closed_ok,
  (SELECT attachment_unsend_action='revoke_then_delete'
     FROM private_line.retention_policy WHERE singleton=true) AS attachment_policy_ok,
  position('raw_payload_materialized=false' in pg_get_functiondef('private_line.admin_prepare_privacy_export(uuid)'::regprocedure)) > 0 AS export_never_materializes_raw_ok,
  position('content_included=false' in pg_get_functiondef('private_line.admin_prepare_privacy_delete(uuid)'::regprocedure)) > 0 AS delete_tombstone_content_free_ok,
  position('false' in pg_get_functiondef('private_line.admin_prepare_privacy_delete(uuid)'::regprocedure)) > 0 AS destructive_execution_false_ok,
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    JOIN information_schema.tables t
      ON t.table_schema=g.table_schema AND t.table_name=g.table_name
    WHERE g.grantee='ccpun_admin_runtime'
      AND g.table_schema='private_line'
      AND t.table_type='BASE TABLE'
  ) AS admin_no_base_table_grants,
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    JOIN information_schema.tables t
      ON t.table_schema=g.table_schema AND t.table_name=g.table_name
    WHERE g.grantee='ccpun_line_ingress'
      AND g.table_schema='private_line'
      AND t.table_type='BASE TABLE'
  ) AS ingress_no_base_table_grants;

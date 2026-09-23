SELECT
  EXISTS(SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_document_media_activation_v1_uat' AND checksum='sha256:fcab7e746a62850711493cfa849548975c6dfdb8365417d3b142fdc26ae1026f') AS migration_checksum_ok,
  to_regclass('private_line.line_runtime_health') IS NOT NULL AS runtime_health_table_ok,
  to_regclass('private_line.customer_drive_folder') IS NOT NULL AS drive_folder_table_ok,
  to_regclass('private_line.document_storage_object') IS NOT NULL AS storage_object_table_ok,
  to_regclass('private_line.document_media_attempt') IS NOT NULL AS media_attempt_table_ok,
  has_function_privilege('ccpun_line_ingress','private_line.ingress_record_line_runtime_health(jsonb)','EXECUTE') AS ingress_runtime_health_write_ok,
  NOT has_function_privilege('ccpun_admin_runtime','private_line.ingress_record_line_runtime_health(jsonb)','EXECUTE') AS admin_runtime_health_write_denied,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_read_document_media_health()','EXECUTE') AS admin_media_health_read_ok,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_read_document_fetch_source(uuid)','EXECUTE') AS admin_document_fetch_source_ok,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_checkpoint_document_fetch(jsonb)','EXECUTE') AS admin_document_fetch_checkpoint_ok,
  NOT has_function_privilege('ccpun_line_ingress','private_line.admin_read_document_fetch_source(uuid)','EXECUTE') AS ingress_document_fetch_source_denied,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_prepare_document_upload(jsonb)','EXECUTE') AS admin_document_prepare_ok,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_checkpoint_document_upload(jsonb)','EXECUTE') AS admin_document_checkpoint_ok,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_checkpoint_document_revoke(jsonb)','EXECUTE') AS admin_document_revoke_ok,
  NOT has_function_privilege('ccpun_line_ingress','private_line.admin_read_document_storage_target(uuid)','EXECUTE') AS ingress_storage_target_denied,
  (SELECT NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') FROM pg_proc p WHERE p.oid='private_line.ingress_record_line_runtime_health(jsonb)'::regprocedure) AS public_runtime_health_write_denied,
  (SELECT NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') FROM pg_proc p WHERE p.oid='private_line.admin_read_document_media_health()'::regprocedure) AS public_media_health_read_denied,
  (SELECT NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') FROM pg_proc p WHERE p.oid='private_line.admin_read_document_fetch_source(uuid)'::regprocedure) AS public_document_fetch_source_denied,
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    JOIN information_schema.tables t ON t.table_schema=g.table_schema AND t.table_name=g.table_name
    WHERE g.grantee='ccpun_admin_runtime' AND g.table_schema='private_line' AND t.table_type='BASE TABLE'
  ) AS admin_no_base_table_grants,
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    JOIN information_schema.tables t ON t.table_schema=g.table_schema AND t.table_name=g.table_name
    WHERE g.grantee='ccpun_line_ingress' AND g.table_schema='private_line' AND t.table_type='BASE TABLE'
  ) AS ingress_no_base_table_grants,
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='private_line' AND table_name='advisor_document_safe'
      AND lower(column_name) ~ '(external|folder|file_id|drive|idempotency|error)'
  ) AS advisor_document_external_ids_absent,
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='private_line_document_storage_sync'
      AND tgrelid='private_line.document'::regclass
      AND NOT tgisinternal
  ) AS unsend_storage_target_trigger_ok;

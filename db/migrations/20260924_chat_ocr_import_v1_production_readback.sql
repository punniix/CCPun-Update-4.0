SELECT
  EXISTS(
    SELECT 1 FROM private_line.schema_migration
    WHERE version='20260924_chat_ocr_import_v1_production'
      AND checksum='sha256:e62e2ec9868ea5cb3f7350fb8ffa07f11ef4cf4cd9e101d6ddca57192509f9d7'
  ) AS migration_current,
  to_regprocedure('private_line.admin_import_chat_ocr_archive_message(jsonb)') IS NOT NULL AS import_fn_present,
  NOT has_table_privilege('ccpun_admin_runtime','private_line.line_conversation_archive','SELECT')
    AND NOT has_table_privilege('ccpun_admin_runtime','private_line.line_conversation_archive','INSERT')
    AND NOT has_table_privilege('ccpun_admin_runtime','private_line.line_conversation_archive','UPDATE')
    AND NOT has_table_privilege('ccpun_admin_runtime','private_line.line_conversation_archive','DELETE') AS archive_direct_denied,
  has_function_privilege(
    'ccpun_admin_runtime',
    'private_line.admin_import_chat_ocr_archive_message(jsonb)',
    'EXECUTE'
  ) AS import_fn_allowed,
  EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conrelid='private_line.line_conversation_archive'::regclass
      AND conname='line_conversation_archive_source_kind_v2_check'
      AND pg_get_constraintdef(oid) LIKE '%manual_ocr%'
  ) AS manual_ocr_source_allowed,
  EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conrelid='private_line.line_conversation_archive'::regclass
      AND conname='line_conversation_archive_content_purpose_v2_check'
      AND pg_get_constraintdef(oid) LIKE '%chat-ocr-import-content%'
  ) AS ocr_content_purpose_allowed;

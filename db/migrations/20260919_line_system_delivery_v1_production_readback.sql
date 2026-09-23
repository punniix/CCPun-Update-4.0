SELECT
  EXISTS (
    SELECT 1 FROM private_line.schema_migration
    WHERE version='20260919_line_system_delivery_v1_production'
      AND checksum='sha256:61d1e71b9ca7a0f27e2dd99f0902a514dff7216e5bfbcbc7bd1fda9e04b47e45'
  ) AS migration_current,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='private_line'
      AND table_name='outbound_message'
      AND column_name='dispatch_token_digest'
  ) AS dispatch_digest_column_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='private_line'
      AND table_name='outbound_message'
      AND column_name='lead_id'
      AND is_nullable='YES'
  ) AS system_notice_can_be_leadless,
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='private_line'
      AND t.relname='outbound_message'
      AND c.conname='outbound_message_system_delivery_contract'
  ) AS system_delivery_constraint_exists,
  private_line.line_delivery_retry_class('content_unavailable')='retryable' AS content_retry_class_ok,
  has_function_privilege('ccpun_line_ingress','private_line.ingress_enqueue_line_system_outbound(jsonb)','EXECUTE') AS ingress_can_enqueue,
  NOT has_function_privilege('ccpun_admin_runtime','private_line.ingress_enqueue_line_system_outbound(jsonb)','EXECUTE') AS admin_cannot_ingress_enqueue,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_claim_line_system_outbound(jsonb)','EXECUTE') AS admin_can_claim_system,
  NOT has_function_privilege('ccpun_line_ingress','private_line.admin_claim_line_system_outbound(jsonb)','EXECUTE') AS ingress_cannot_claim_system,
  NOT has_table_privilege('ccpun_line_ingress','private_line.outbound_message','INSERT') AS ingress_has_no_direct_insert,
  NOT has_table_privilege('ccpun_admin_runtime','private_line.outbound_message','SELECT') AS admin_has_no_direct_table_read;

SELECT
  EXISTS(SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_delivery_activation_v1_production' AND checksum='sha256:0ae7539cbc55299979f1821984875181e66259efec4ddc16cc3e549a056eabfa') AS migration_checksum_ok,
  private_line.line_delivery_retry_class('rate_limited')='retryable' AS rate_limit_retryable_ok,
  private_line.line_delivery_retry_class('provider_unavailable')='retryable' AS provider_unavailable_retryable_ok,
  private_line.line_delivery_retry_class('provider_rejected')='permanent' AS provider_rejected_dead_letter_ok,
  private_line.line_delivery_retry_class('decrypt_failed')='permanent' AS decrypt_failed_dead_letter_ok,
  private_line.line_delivery_retry_class('provider_result_ambiguous')='ambiguous' AS ambiguous_reconciliation_ok,
  position('line_delivery_retry_class(om.last_error_class)=''retryable''' in pg_get_functiondef('private_line.admin_claim_line_outbound(jsonb)'::regprocedure)) > 0 AS outbound_retry_filter_ok,
  position('line_delivery_retry_class(d.last_error_class)=''retryable''' in pg_get_functiondef('private_line.admin_claim_line_campaign_delivery(jsonb)'::regprocedure)) > 0 AS campaign_retry_filter_ok,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_read_line_delivery_health()','EXECUTE') AS admin_delivery_health_ok,
  NOT has_function_privilege('ccpun_line_ingress','private_line.admin_read_line_delivery_health()','EXECUTE') AS ingress_delivery_health_denied,
  (SELECT NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') FROM pg_proc p WHERE p.oid='private_line.admin_read_line_delivery_health()'::regprocedure) AS public_delivery_health_denied,
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    JOIN information_schema.tables t ON t.table_schema=g.table_schema AND t.table_name=g.table_name
    WHERE g.grantee='ccpun_admin_runtime' AND g.table_schema='private_line' AND t.table_type='BASE TABLE'
  ) AS admin_no_base_table_grants,
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    JOIN information_schema.tables t ON t.table_schema=g.table_schema AND t.table_name=g.table_name
    WHERE g.grantee='ccpun_line_ingress' AND g.table_schema='private_line' AND t.table_type='BASE TABLE'
  ) AS ingress_no_base_table_grants;

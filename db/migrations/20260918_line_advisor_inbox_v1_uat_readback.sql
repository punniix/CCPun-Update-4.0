SELECT
  current_database() = 'neondb' AS database_ok,
  EXISTS (
    SELECT 1 FROM private_line.schema_migration
    WHERE version = '20260918_line_advisor_inbox_v1_uat'
      AND checksum = 'sha256:99519369562761cfb4cb95fe7d6e14f5d0a158ba31b116200d729eb865a451e0'
  ) AS advisor_inbox_checksum_ok,
  EXISTS (
    SELECT 1 FROM private_line.system_identity
    WHERE singleton = true
      AND project_id = 'young-term-47483330'
      AND branch_id = 'br-crimson-mouse-az7ajkv8'
      AND endpoint_id = 'ep-mute-frost-aztvz394'
      AND database_name = 'neondb'
      AND migration_version = '20260917_private_line_runtime_v1_uat'
      AND migration_checksum = 'sha256:19a7dfaf26d2cc4f6cbf01d7ff2380056383f8e87dd079a6e141e73b878985d3'
  ) AS base_identity_unchanged,
  to_regclass('private_line.advisor_inbox_safe') IS NOT NULL AS safe_view_exists,
  (
    SELECT array_agg(column_name::text ORDER BY ordinal_position) = ARRAY[
      'lead_id','advisor_case_id','customer_code','stage','journey','material_received',
      'conversation_status','unread_count','last_activity_at','priority','assigned_advisor',
      'latest_message_type','latest_message_status','latest_message_needs_human','updated_at'
    ]::text[]
    FROM information_schema.columns
    WHERE table_schema = 'private_line' AND table_name = 'advisor_inbox_safe'
  ) AS safe_view_shape_ok,
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'private_line' AND table_name = 'advisor_inbox_safe'
      AND lower(column_name) ~ '(line|external|provider|cipher|nonce|auth_tag|document|file|message_id|content|text|phone|email|name|income|asset|debt|health|medical)'
  ) AS sensitive_columns_absent,
  has_schema_privilege('ccpun_admin_runtime', 'private_line', 'USAGE') AS admin_schema_usage_ok,
  has_table_privilege('ccpun_admin_runtime', 'private_line.advisor_inbox_safe', 'SELECT') AS admin_safe_view_select_ok,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants g
    JOIN information_schema.tables t
      ON t.table_schema = g.table_schema AND t.table_name = g.table_name
    WHERE g.grantee = 'ccpun_admin_runtime'
      AND g.table_schema = 'private_line'
      AND t.table_type = 'BASE TABLE'
  ) AS admin_base_tables_direct_denied,
  NOT has_table_privilege('ccpun_line_ingress', 'private_line.advisor_inbox_safe', 'SELECT') AS ingress_safe_view_select_denied,
  has_function_privilege('ccpun_line_ingress', 'private_line.ingest_line_event(jsonb)', 'EXECUTE') AS ingress_execute_unchanged,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants g
    JOIN information_schema.tables t
      ON t.table_schema = g.table_schema AND t.table_name = g.table_name
    WHERE g.grantee = 'ccpun_line_ingress'
      AND g.table_schema = 'private_line'
      AND t.table_type = 'BASE TABLE'
  ) AS ingress_base_tables_direct_denied;

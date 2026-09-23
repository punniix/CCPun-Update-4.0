SELECT
 EXISTS(SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_private_context_compat_v1_production' AND checksum='sha256:83c0b6c89014bd11cf3e1aa51d4b7ce0233bfce62b33d594a397514c02e832a0') AS context_compat_checksum_ok,
 (SELECT array_agg(column_name::text ORDER BY ordinal_position)=ARRAY['lead_id','advisor_case_id','customer_code','stage','journey','material_received','conversation_status','unread_count','last_activity_at','priority','assigned_advisor','latest_message_type','latest_message_status','latest_message_needs_human','updated_at']::text[] FROM information_schema.columns WHERE table_schema='private_line' AND table_name='advisor_inbox_safe') AS advisor_inbox_shape_restored,
 to_regclass('private_line.lead_context_safe') IS NOT NULL AS lead_context_safe_exists,
 has_table_privilege('ccpun_admin_runtime','private_line.lead_context_safe','SELECT') AS admin_context_select,
 NOT has_table_privilege('ccpun_line_ingress','private_line.lead_context_safe','SELECT') AS ingress_context_select_denied,
 NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='private_line' AND table_name='lead_context_safe' AND lower(column_name) ~ '(external|provider|cipher|nonce|auth_tag|document|file|message_id|phone|email|name|income|asset|debt|health|medical)') AS context_sensitive_columns_absent;

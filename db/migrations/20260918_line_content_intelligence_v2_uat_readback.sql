SELECT
  EXISTS(
    SELECT 1 FROM private_line.schema_migration
    WHERE version='20260918_line_content_intelligence_v2_uat'
      AND checksum='sha256:084d1063b0d0fbc1c48762ea8de88994210f7d063f244874c2b17c5ff55147af'
  ) AS migration_checksum_ok,
  to_regclass('private_line.safe_knowledge_event') IS NOT NULL AS safe_knowledge_event_table_ok,
  has_function_privilege('ccpun_line_ingress','private_line.ingress_record_safe_knowledge_event(jsonb)','EXECUTE') AS ingress_question_write_ok,
  NOT has_function_privilege('ccpun_admin_runtime','private_line.ingress_record_safe_knowledge_event(jsonb)','EXECUTE') AS admin_question_write_denied,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_read_content_intelligence_v2(integer)','EXECUTE') AS admin_content_v2_read_ok,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_read_content_revenue_by_currency(integer)','EXECUTE') AS admin_content_revenue_read_ok,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_read_safe_question_frequency(integer)','EXECUTE') AS admin_question_frequency_read_ok,
  has_function_privilege('ccpun_admin_runtime','private_line.admin_read_content_gap_inputs(integer)','EXECUTE') AS admin_content_gap_read_ok,
  NOT has_function_privilege('ccpun_line_ingress','private_line.admin_read_content_gap_inputs(integer)','EXECUTE') AS ingress_content_gap_denied,
  (SELECT NOT EXISTS (
    SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f',p.proowner))) a
    WHERE a.grantee=0 AND a.privilege_type='EXECUTE'
  ) FROM pg_proc p WHERE p.oid='private_line.ingress_record_safe_knowledge_event(jsonb)'::regprocedure) AS public_question_write_denied,
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
  ) AS ingress_no_base_table_grants,
  position('WHERE e.event_type=''line_continue''' in pg_get_functiondef('private_line.admin_read_content_intelligence_v2(integer)'::regprocedure)) > 0 AS journey_start_semantics_ok,
  position('count(DISTINCT r.revenue_id)>=3' in pg_get_functiondef('private_line.admin_read_content_revenue_by_currency(integer)'::regprocedure)) > 0 AS content_revenue_k3_suppression_ok,
  position('no_approved_answer' in pg_get_functiondef('private_line.admin_read_content_gap_inputs(integer)'::regprocedure)) > 0 AS gap_no_answer_signal_ok,
  position('source_unavailable' in pg_get_functiondef('private_line.admin_read_content_gap_inputs(integer)'::regprocedure)) > 0 AS gap_source_unavailable_signal_ok,
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='private_line'
      AND table_name='safe_knowledge_event'
      AND lower(column_name) ~ '(customer|lead|conversation|identity|message|cipher|file|drive|contact|health|income|asset|debt|policy)'
  ) AS safe_knowledge_no_customer_columns;

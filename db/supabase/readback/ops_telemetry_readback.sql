-- Read-only checks after applying the Supabase ops telemetry migrations.
-- Every row must show rls_enabled = true, client_role_grants = 0 and one
-- restrictive deny policy; the retention function must not be executable by
-- anon/authenticated.
SELECT c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (SELECT count(*) FROM information_schema.role_table_grants g
     WHERE g.table_schema = 'public' AND g.table_name = c.relname AND g.grantee IN ('anon', 'authenticated', 'PUBLIC')) AS client_role_grants,
  (SELECT count(*) FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = c.relname AND p.policyname = 'ops_deny_client_roles' AND p.permissive = 'RESTRICTIVE') AS deny_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('ops_lane_identity', 'ops_workflow_runs', 'ops_workflow_run_daily', 'ops_raw_daily_pulls', 'ops_daily_job_status')
ORDER BY c.relname;

SELECT r.rolname, has_function_privilege(r.rolname, 'public.ops_apply_run_log_retention(timestamptz, integer)', 'EXECUTE') AS can_execute
FROM pg_roles r WHERE r.rolname IN ('anon', 'authenticated', 'service_role') ORDER BY r.rolname;

SELECT lane FROM public.ops_lane_identity;

-- After 20261025000300 / 20261025000400 (Codex audit follow-ups F03/F06):
-- ops_alert_claims must show rls_enabled = true, client_role_grants = 0 and one
-- deny policy; only service_role may execute the claim functions; the late-row
-- guard trigger must exist and be enabled ('O').
SELECT c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (SELECT count(*) FROM information_schema.role_table_grants g
     WHERE g.table_schema = 'public' AND g.table_name = c.relname AND g.grantee IN ('anon', 'authenticated', 'PUBLIC')) AS client_role_grants,
  (SELECT count(*) FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = c.relname AND p.policyname = 'ops_deny_client_roles' AND p.permissive = 'RESTRICTIVE') AS deny_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'ops_alert_claims';

SELECT r.rolname,
  has_function_privilege(r.rolname, 'public.ops_claim_alert(text, text, integer, timestamptz)', 'EXECUTE') AS can_claim,
  has_function_privilege(r.rolname, 'public.ops_mark_alert_accepted(text, timestamptz)', 'EXECUTE') AS can_mark_accepted
FROM pg_roles r WHERE r.rolname IN ('anon', 'authenticated', 'service_role') ORDER BY r.rolname;

SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.ops_workflow_runs'::regclass AND tgname = 'ops_guard_workflow_run_date';

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

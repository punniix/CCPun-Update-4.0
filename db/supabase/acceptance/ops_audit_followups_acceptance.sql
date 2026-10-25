-- SQL acceptance for Codex audit follow-ups F03 (alert claims) and F06
-- (late-row guard). LOCAL OR DISPOSABLE DATABASE ONLY: it writes synthetic rows
-- inside one transaction and always ends with ROLLBACK. Never run it against a
-- real lane project. Requires migrations 20261025000100..000400 and the
-- Supabase roles (anon, authenticated, service_role). Any failed check raises.
--   psql -v ON_ERROR_STOP=1 -f db/supabase/acceptance/ops_audit_followups_acceptance.sql

BEGIN;
SET LOCAL ROLE service_role;

-- F03 -------------------------------------------------------------------------
DO $$
DECLARE
  t0 timestamptz := '2026-10-25T00:31:00Z';
  r jsonb;
BEGIN
  -- First claim wins; a re-render storm inside the TTL never re-claims.
  r := public.ops_claim_alert('admin-uat:daily-0600:missing:2026-10-25', 'daily-job-missing', 600, t0);
  ASSERT (r->>'claimed')::boolean AND r->>'state' = 'pending' AND (r->>'attempts')::int = 1, 'first claim';
  FOR i IN 1..20 LOOP
    r := public.ops_claim_alert('admin-uat:daily-0600:missing:2026-10-25', 'daily-job-missing', 600, t0 + make_interval(secs => i * 10));
    ASSERT NOT (r->>'claimed')::boolean AND r->>'state' = 'pending', 'storm inside TTL is refused';
  END LOOP;
  -- Crash after claim, before send: nothing marked accepted. After expiry the
  -- claim is taken again (attempt 2) and can be completed.
  r := public.ops_claim_alert('admin-uat:daily-0600:missing:2026-10-25', 'daily-job-missing', 600, t0 + interval '10 minutes');
  ASSERT (r->>'claimed')::boolean AND (r->>'attempts')::int = 2, 're-claim after expiry';
  ASSERT public.ops_mark_alert_accepted('admin-uat:daily-0600:missing:2026-10-25', t0 + interval '10 minutes 2 seconds'), 'relay accepted is recorded';
  -- Accepted is final: no further claim even long after expiry, no second mark.
  r := public.ops_claim_alert('admin-uat:daily-0600:missing:2026-10-25', 'daily-job-missing', 600, t0 + interval '3 hours');
  ASSERT NOT (r->>'claimed')::boolean AND r->>'state' = 'accepted', 'accepted is never re-claimed';
  ASSERT NOT public.ops_mark_alert_accepted('admin-uat:daily-0600:missing:2026-10-25', t0 + interval '3 hours'), 'accepted only once';
  ASSERT (SELECT relay_accepted_at = t0 + interval '10 minutes 2 seconds' AND sent_at IS NULL FROM public.ops_alert_claims WHERE reference = 'admin-uat:daily-0600:missing:2026-10-25'), 'relay accepted is not email sent';
  -- A different kind under the same reference is never claimed.
  r := public.ops_claim_alert('admin-uat:daily-0600:failed:7', 'daily-job-failed', 600, t0);
  ASSERT (r->>'claimed')::boolean, 'failed claim';
  r := public.ops_claim_alert('admin-uat:daily-0600:failed:7', 'daily-job-stuck', 600, t0 + interval '1 hour');
  ASSERT NOT (r->>'claimed')::boolean, 'kind mismatch refused';
  -- Bad input is refused.
  BEGIN
    PERFORM public.ops_claim_alert('Bad Reference', 'daily-job-failed', 600, t0);
    RAISE EXCEPTION 'reference check missing';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.ops_claim_alert('admin-uat:x', 'daily-job-failed', 5, t0);
    RAISE EXCEPTION 'ttl check missing';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'OPS_ALERT_TTL_INVALID' THEN RAISE; END IF;
  END;
END $$;

-- F06 -------------------------------------------------------------------------
DO $$
DECLARE
  d date := (timezone('Asia/Bangkok', now()))::date - 10;
  s public.ops_workflow_run_daily;
BEGIN
  INSERT INTO public.ops_workflow_runs (workflow_id, workflow_name, execution_id, step, status, started_at, finished_at, duration_ms)
  VALUES ('XOQHPkio5WzZIz0l', 'Acceptance', 'E1', 'gsc', 'succeeded', (d::text || 'T06:00:00+07')::timestamptz, (d::text || 'T06:00:01+07')::timestamptz, 1000),
         ('XOQHPkio5WzZIz0l', 'Acceptance', 'E1', 'ga4', 'succeeded', (d::text || 'T06:00:02+07')::timestamptz, (d::text || 'T06:00:03+07')::timestamptz, 1000);
  -- Retention evaluated 100 days ahead archives day d.
  PERFORM public.ops_apply_run_log_retention(now() + interval '100 days');
  SELECT * INTO s FROM public.ops_workflow_run_daily WHERE run_date = d AND workflow_id = 'XOQHPkio5WzZIz0l';
  ASSERT s.total_steps = 2 AND s.executions = 1 AND s.succeeded = 2 AND NOT s.detail_rows_retained, 'archived summary';
  -- Late step of the same execution and a replay of a counted step are refused.
  BEGIN
    INSERT INTO public.ops_workflow_runs (workflow_id, workflow_name, execution_id, step, status, started_at)
    VALUES ('XOQHPkio5WzZIz0l', 'Acceptance', 'E1', 'meta', 'failed', (d::text || 'T06:00:04+07')::timestamptz);
    RAISE EXCEPTION 'late step accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'OPS_RUN_LOG_DAY_ARCHIVED' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.ops_workflow_runs (workflow_id, workflow_name, execution_id, step, status, started_at)
    VALUES ('XOQHPkio5WzZIz0l', 'Acceptance', 'E1', 'gsc', 'succeeded', (d::text || 'T06:00:00+07')::timestamptz);
    RAISE EXCEPTION 'replayed step accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'OPS_RUN_LOG_DAY_ARCHIVED' THEN RAISE; END IF;
  END;
  PERFORM public.ops_apply_run_log_retention(now() + interval '100 days');
  SELECT * INTO s FROM public.ops_workflow_run_daily WHERE run_date = d AND workflow_id = 'XOQHPkio5WzZIz0l';
  ASSERT s.total_steps = 2 AND s.executions = 1 AND s.succeeded = 2 AND s.failed = 0, 'summary stays exact';
  -- Rows older than the 90-day window are refused at write time.
  BEGIN
    INSERT INTO public.ops_workflow_runs (workflow_id, workflow_name, execution_id, step, status, started_at)
    VALUES ('XOQHPkio5WzZIz0l', 'Acceptance', 'E9', 'gsc', 'succeeded', now() - interval '120 days');
    RAISE EXCEPTION 'old row accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'OPS_RUN_LOG_TOO_OLD' THEN RAISE; END IF;
  END;
  -- Another workflow on the same day, and a fresh day, are still accepted.
  INSERT INTO public.ops_workflow_runs (workflow_id, workflow_name, execution_id, step, status, started_at)
  VALUES ('pcDVd2P6ipg8b6p4', 'Acceptance relay', 'R1', 'gsc', 'succeeded', (d::text || 'T06:00:00+07')::timestamptz),
         ('XOQHPkio5WzZIz0l', 'Acceptance', 'E2', 'gsc', 'succeeded', now());
END $$;

-- Client roles stay denied on the new table and functions.
DO $$
BEGIN
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ops_alert_claims'::regclass), 'RLS on ops_alert_claims';
  ASSERT NOT has_table_privilege('anon', 'public.ops_alert_claims', 'SELECT'), 'anon denied';
  ASSERT NOT has_table_privilege('authenticated', 'public.ops_alert_claims', 'INSERT'), 'authenticated denied';
  ASSERT NOT has_function_privilege('anon', 'public.ops_claim_alert(text, text, integer, timestamptz)', 'EXECUTE'), 'anon cannot claim';
  ASSERT NOT has_function_privilege('authenticated', 'public.ops_mark_alert_accepted(text, timestamptz)', 'EXECUTE'), 'authenticated cannot mark';
  ASSERT has_function_privilege('service_role', 'public.ops_claim_alert(text, text, integer, timestamptz)', 'EXECUTE'), 'service_role can claim';
END $$;

SELECT 'ops audit follow-ups acceptance passed' AS result;
ROLLBACK;

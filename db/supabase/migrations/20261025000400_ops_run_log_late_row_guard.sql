-- Late-row guard for run-log retention (Codex audit F06, 2026-10-25). Additive only.
--
-- Reproduced on PostgreSQL 16 with 20261025000100/000200: execution E1 wrote
-- steps gsc+ga4 on day D; retention archived D (total_steps 2, executions 1);
-- a late step of the SAME execution (meta) plus a replay of gsc then landed on
-- D, and the next retention run merged them additively into the purged summary:
-- total_steps 4, executions 2, succeeded 3 (correct: 3, 1, 2). Once the detail
-- rows are gone, neither the unique key nor count(DISTINCT execution_id) can see
-- that the late row belongs to an already counted execution.
--
-- Fix: refuse detail rows that can no longer be counted exactly.
--   OPS_RUN_LOG_DAY_ARCHIVED - the (run_date, workflow_id) summary was already
--     archived (detail_rows_retained = false). This is the exact condition.
--   OPS_RUN_LOG_TOO_OLD - the row's Bangkok run date is older than the minimum
--     90-day window at write time. Such a row would be purged by the next
--     retention run anyway, so it is operationally impossible for n8n.
-- The trigger also takes the retention advisory lock in SHARED mode, so a row
-- cannot be inserted between retention summarizing a day and deleting it.
--
-- Count contract (ops_workflow_run_daily, per run_date + workflow_id): every
-- accepted detail row is counted exactly once. total_steps = distinct
-- (execution_id, step) rows; executions = distinct execution_id; succeeded/
-- failed/warning/skipped/started = rows with that status; an archived summary
-- is final. The additive merge in ops_apply_run_log_retention() stays for rows
-- accepted before this guard existed; for those, executions is an upper bound.
-- Mirrored in lib/admin/ops-telemetry/contracts.ts (insertRunLogRowInMemory).
--
-- n8n note: a refused insert raises check_violation; the n8n Supabase node that
-- writes ops_workflow_runs should continue on error so telemetry never fails
-- the job it observes.

BEGIN;
SELECT pg_advisory_xact_lock(hashtext('ccpun_ops:20261025000400_ops_run_log_late_row_guard'));

CREATE OR REPLACE FUNCTION public.ops_guard_workflow_run_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- run_date is a stored generated column and is not computed yet in a BEFORE trigger.
  v_run_date date := (timezone('Asia/Bangkok', NEW.started_at))::date;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(hashtext('ccpun_ops:run_log_retention'));
  IF v_run_date < (timezone('Asia/Bangkok', now()))::date - 90 THEN
    RAISE EXCEPTION 'OPS_RUN_LOG_TOO_OLD' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ops_workflow_run_daily d
    WHERE d.run_date = v_run_date AND d.workflow_id = NEW.workflow_id AND NOT d.detail_rows_retained
  ) THEN
    RAISE EXCEPTION 'OPS_RUN_LOG_DAY_ARCHIVED' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ops_guard_workflow_run_date() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ops_guard_workflow_run_date ON public.ops_workflow_runs;
CREATE TRIGGER ops_guard_workflow_run_date
  BEFORE INSERT OR UPDATE OF started_at, workflow_id ON public.ops_workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.ops_guard_workflow_run_date();

COMMIT;

-- Run-log retention (owner decision A5, 2026-10-25): keep workflow run detail
-- rows for 90 days and the per-day summaries forever.
--
-- public.ops_apply_run_log_retention() is idempotent: calling it again with the
-- same p_now changes nothing. The rules are mirrored and tested in
-- lib/admin/ops-telemetry/contracts.ts (applyRunLogRetentionInMemory).
--   1. Dates inside the window are fully recomputed from their detail rows.
--   2. Dates past the window are summarized (replacing a summary still backed
--      by detail rows, or merging late rows into an already-purged summary),
--      then their detail rows are deleted. Summaries are never deleted.
--
-- This migration only creates the function. It does NOT run it and does NOT
-- schedule it. Scheduling (n8n daily call or pg_cron) needs separate owner
-- approval per lane.

BEGIN;
SELECT pg_advisory_xact_lock(hashtext('ccpun_ops:20261025000200_ops_run_log_retention'));

CREATE OR REPLACE FUNCTION public.ops_apply_run_log_retention(p_now timestamptz DEFAULT now(), p_keep_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cutoff date;
  v_refreshed integer := 0;
  v_archived integer := 0;
  v_deleted integer := 0;
BEGIN
  IF p_now IS NULL THEN
    RAISE EXCEPTION 'OPS_RETENTION_NOW_REQUIRED';
  END IF;
  IF p_keep_days IS NULL OR p_keep_days < 90 THEN
    RAISE EXCEPTION 'OPS_RETENTION_TOO_SHORT';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ccpun_ops:run_log_retention'));
  v_cutoff := (timezone('Asia/Bangkok', p_now))::date - p_keep_days;

  -- 1. Fresh dates: full recompute, only rows that actually change are touched.
  WITH fresh AS (
    SELECT run_date, workflow_id,
      (array_agg(workflow_name ORDER BY started_at DESC))[1] AS workflow_name,
      count(*)::integer AS total_steps,
      count(DISTINCT execution_id)::integer AS executions,
      (count(*) FILTER (WHERE status = 'succeeded'))::integer AS succeeded,
      (count(*) FILTER (WHERE status = 'failed'))::integer AS failed,
      (count(*) FILTER (WHERE status = 'warning'))::integer AS warning,
      (count(*) FILTER (WHERE status = 'skipped'))::integer AS skipped,
      (count(*) FILTER (WHERE status = 'started'))::integer AS started,
      coalesce(sum(duration_ms), 0)::bigint AS total_duration_ms,
      max(duration_ms) AS max_duration_ms,
      min(started_at) AS first_started_at,
      max(finished_at) AS last_finished_at
    FROM public.ops_workflow_runs
    WHERE run_date >= v_cutoff
    GROUP BY run_date, workflow_id
  ), upserted AS (
    INSERT INTO public.ops_workflow_run_daily AS d (run_date, workflow_id, workflow_name, total_steps, executions, succeeded, failed, warning, skipped, started, total_duration_ms, max_duration_ms, first_started_at, last_finished_at, detail_rows_retained, summarized_at)
    SELECT run_date, workflow_id, workflow_name, total_steps, executions, succeeded, failed, warning, skipped, started, total_duration_ms, max_duration_ms, first_started_at, last_finished_at, true, p_now
    FROM fresh
    ON CONFLICT (run_date, workflow_id) DO UPDATE SET
      workflow_name = EXCLUDED.workflow_name,
      total_steps = EXCLUDED.total_steps,
      executions = EXCLUDED.executions,
      succeeded = EXCLUDED.succeeded,
      failed = EXCLUDED.failed,
      warning = EXCLUDED.warning,
      skipped = EXCLUDED.skipped,
      started = EXCLUDED.started,
      total_duration_ms = EXCLUDED.total_duration_ms,
      max_duration_ms = EXCLUDED.max_duration_ms,
      first_started_at = EXCLUDED.first_started_at,
      last_finished_at = EXCLUDED.last_finished_at,
      detail_rows_retained = true,
      summarized_at = EXCLUDED.summarized_at
    WHERE (d.workflow_name, d.total_steps, d.executions, d.succeeded, d.failed, d.warning, d.skipped, d.started, d.total_duration_ms, d.max_duration_ms, d.first_started_at, d.last_finished_at, d.detail_rows_retained)
      IS DISTINCT FROM (EXCLUDED.workflow_name, EXCLUDED.total_steps, EXCLUDED.executions, EXCLUDED.succeeded, EXCLUDED.failed, EXCLUDED.warning, EXCLUDED.skipped, EXCLUDED.started, EXCLUDED.total_duration_ms, EXCLUDED.max_duration_ms, EXCLUDED.first_started_at, EXCLUDED.last_finished_at, true)
    RETURNING 1
  )
  SELECT count(*) INTO v_refreshed FROM upserted;

  -- 2. Expiring dates: replace a still-backed summary, merge into a purged one.
  WITH expiring AS (
    SELECT run_date, workflow_id,
      (array_agg(workflow_name ORDER BY started_at DESC))[1] AS workflow_name,
      count(*)::integer AS total_steps,
      count(DISTINCT execution_id)::integer AS executions,
      (count(*) FILTER (WHERE status = 'succeeded'))::integer AS succeeded,
      (count(*) FILTER (WHERE status = 'failed'))::integer AS failed,
      (count(*) FILTER (WHERE status = 'warning'))::integer AS warning,
      (count(*) FILTER (WHERE status = 'skipped'))::integer AS skipped,
      (count(*) FILTER (WHERE status = 'started'))::integer AS started,
      coalesce(sum(duration_ms), 0)::bigint AS total_duration_ms,
      max(duration_ms) AS max_duration_ms,
      min(started_at) AS first_started_at,
      max(finished_at) AS last_finished_at
    FROM public.ops_workflow_runs
    WHERE run_date < v_cutoff
    GROUP BY run_date, workflow_id
  ), archived AS (
    INSERT INTO public.ops_workflow_run_daily AS d (run_date, workflow_id, workflow_name, total_steps, executions, succeeded, failed, warning, skipped, started, total_duration_ms, max_duration_ms, first_started_at, last_finished_at, detail_rows_retained, summarized_at)
    SELECT run_date, workflow_id, workflow_name, total_steps, executions, succeeded, failed, warning, skipped, started, total_duration_ms, max_duration_ms, first_started_at, last_finished_at, false, p_now
    FROM expiring
    ON CONFLICT (run_date, workflow_id) DO UPDATE SET
      workflow_name = EXCLUDED.workflow_name,
      total_steps = CASE WHEN d.detail_rows_retained THEN EXCLUDED.total_steps ELSE d.total_steps + EXCLUDED.total_steps END,
      executions = CASE WHEN d.detail_rows_retained THEN EXCLUDED.executions ELSE d.executions + EXCLUDED.executions END,
      succeeded = CASE WHEN d.detail_rows_retained THEN EXCLUDED.succeeded ELSE d.succeeded + EXCLUDED.succeeded END,
      failed = CASE WHEN d.detail_rows_retained THEN EXCLUDED.failed ELSE d.failed + EXCLUDED.failed END,
      warning = CASE WHEN d.detail_rows_retained THEN EXCLUDED.warning ELSE d.warning + EXCLUDED.warning END,
      skipped = CASE WHEN d.detail_rows_retained THEN EXCLUDED.skipped ELSE d.skipped + EXCLUDED.skipped END,
      started = CASE WHEN d.detail_rows_retained THEN EXCLUDED.started ELSE d.started + EXCLUDED.started END,
      total_duration_ms = CASE WHEN d.detail_rows_retained THEN EXCLUDED.total_duration_ms ELSE d.total_duration_ms + EXCLUDED.total_duration_ms END,
      max_duration_ms = CASE WHEN d.detail_rows_retained THEN EXCLUDED.max_duration_ms ELSE greatest(d.max_duration_ms, EXCLUDED.max_duration_ms) END,
      first_started_at = CASE WHEN d.detail_rows_retained THEN EXCLUDED.first_started_at ELSE least(d.first_started_at, EXCLUDED.first_started_at) END,
      last_finished_at = CASE WHEN d.detail_rows_retained THEN EXCLUDED.last_finished_at ELSE greatest(d.last_finished_at, EXCLUDED.last_finished_at) END,
      detail_rows_retained = false,
      summarized_at = EXCLUDED.summarized_at
    RETURNING 1
  )
  SELECT count(*) INTO v_archived FROM archived;

  -- 3. Purge expired detail rows (summaries above already hold their totals).
  DELETE FROM public.ops_workflow_runs WHERE run_date < v_cutoff;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'cutoff', to_char(v_cutoff, 'YYYY-MM-DD'),
    'keepDays', p_keep_days,
    'refreshedSummaries', v_refreshed,
    'archivedSummaries', v_archived,
    'deletedRows', v_deleted
  );
END;
$$;

-- Functions are executable by PUBLIC by default and PostgREST exposes public
-- functions as /rest/v1/rpc; keep this server-side only.
REVOKE ALL ON FUNCTION public.ops_apply_run_log_retention(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_apply_run_log_retention(timestamptz, integer) TO service_role;

COMMIT;

-- CCPun ops telemetry on Supabase (owner-approved data split, 2026-10-25).
--
-- Only high-frequency, non-sensitive n8n data lives here so Neon compute can
-- stay asleep: workflow run logs (detail rows + daily summaries), raw daily
-- GA4/GSC/social pulls and the 06:00 job status. LINE inbox, campaigns, audit,
-- analytics daily summaries/report manifest and the planning room stay in Neon.
--
-- Access model: RLS is enabled on every table and the anon/authenticated roles
-- are denied explicitly. Only server-side callers holding the service_role key
-- (Admin server env + n8n credential) can read or write. Never put customer
-- names, phone numbers, emails, LINE ids, message text or health/financial
-- answers in these tables.
--
-- Apply to each lane's own Supabase project (one for admin-uat, one for
-- production-admin), then apply exactly one file from db/supabase/lane/.

BEGIN;
SELECT pg_advisory_xact_lock(hashtext('ccpun_ops:20261025000100_ops_telemetry_foundation'));

-- Which Admin lane this project belongs to. Admin refuses to read or write when
-- this row does not match its own lane (fail closed, like the Neon identity).
CREATE TABLE IF NOT EXISTS public.ops_lane_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  lane text NOT NULL CHECK (lane IN ('admin-uat', 'production-admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Workflow run log: one row per workflow step per execution (detail rows, 90 days).
CREATE TABLE IF NOT EXISTS public.ops_workflow_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workflow_id text NOT NULL CHECK (workflow_id ~ '^[A-Za-z0-9]{8,32}$'),
  workflow_name text NOT NULL CHECK (char_length(workflow_name) BETWEEN 1 AND 200),
  execution_id text NOT NULL CHECK (char_length(execution_id) BETWEEN 1 AND 64),
  step text NOT NULL DEFAULT 'workflow' CHECK (char_length(step) BETWEEN 1 AND 120),
  status text NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'skipped', 'warning')),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 86400000),
  error_category text CHECK (error_category IS NULL OR error_category ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detail) = 'object' AND pg_column_size(detail) <= 8192),
  run_date date GENERATED ALWAYS AS ((timezone('Asia/Bangkok', started_at))::date) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, execution_id, step)
);
CREATE INDEX IF NOT EXISTS ops_workflow_runs_run_date_idx ON public.ops_workflow_runs (run_date);
CREATE INDEX IF NOT EXISTS ops_workflow_runs_recent_idx ON public.ops_workflow_runs (workflow_id, started_at DESC);

-- Daily summary per workflow, kept forever. Maintained by
-- public.ops_apply_run_log_retention() (next migration).
CREATE TABLE IF NOT EXISTS public.ops_workflow_run_daily (
  run_date date NOT NULL,
  workflow_id text NOT NULL CHECK (workflow_id ~ '^[A-Za-z0-9]{8,32}$'),
  workflow_name text NOT NULL,
  total_steps integer NOT NULL CHECK (total_steps >= 0),
  executions integer NOT NULL CHECK (executions >= 0),
  succeeded integer NOT NULL DEFAULT 0 CHECK (succeeded >= 0),
  failed integer NOT NULL DEFAULT 0 CHECK (failed >= 0),
  warning integer NOT NULL DEFAULT 0 CHECK (warning >= 0),
  skipped integer NOT NULL DEFAULT 0 CHECK (skipped >= 0),
  started integer NOT NULL DEFAULT 0 CHECK (started >= 0),
  total_duration_ms bigint NOT NULL DEFAULT 0 CHECK (total_duration_ms >= 0),
  max_duration_ms integer,
  first_started_at timestamptz,
  last_finished_at timestamptz,
  detail_rows_retained boolean NOT NULL DEFAULT true,
  summarized_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_date, workflow_id)
);

-- Raw daily provider pulls written by n8n (GSC/GA4 via the read-only relay, Meta,
-- Ubersuggest, social). Admin still validates and stores the analytics summary
-- and report manifest in Neon; these rows are the raw evidence only.
CREATE TABLE IF NOT EXISTS public.ops_raw_daily_pulls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('gsc', 'ga4', 'meta', 'ubersuggest', 'social')),
  report text NOT NULL CHECK (report ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  pull_date date NOT NULL,
  execution_id text NOT NULL CHECK (char_length(execution_id) BETWEEN 1 AND 64),
  page integer NOT NULL DEFAULT 0 CHECK (page >= 0),
  payload jsonb NOT NULL CHECK (pg_column_size(payload) <= 5242880),
  row_count integer CHECK (row_count IS NULL OR row_count >= 0),
  payload_sha256 text CHECK (payload_sha256 IS NULL OR payload_sha256 ~ '^[0-9a-f]{64}$'),
  collected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, report, pull_date, execution_id, page)
);
CREATE INDEX IF NOT EXISTS ops_raw_daily_pulls_date_idx ON public.ops_raw_daily_pulls (pull_date, source);

-- The 06:00 job: one row per execution (schedule, manual re-run or Admin re-run).
CREATE TABLE IF NOT EXISTS public.ops_daily_job_status (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_key text NOT NULL DEFAULT 'daily-0600' CHECK (job_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  run_date date NOT NULL,
  execution_id text NOT NULL CHECK (char_length(execution_id) BETWEEN 1 AND 64),
  trigger text NOT NULL DEFAULT 'schedule' CHECK (trigger IN ('schedule', 'manual', 'admin')),
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  failed_steps text[] NOT NULL DEFAULT '{}' CHECK (cardinality(failed_steps) <= 40),
  error_category text CHECK (error_category IS NULL OR error_category ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  alert_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_key, execution_id)
);
CREATE INDEX IF NOT EXISTS ops_daily_job_status_latest_idx ON public.ops_daily_job_status (job_key, run_date DESC, started_at DESC);

-- RLS on every table; deny the client roles explicitly. service_role bypasses
-- RLS by design and is the only role the Admin server and n8n use.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_lane_identity', 'ops_workflow_runs', 'ops_workflow_run_daily', 'ops_raw_daily_pulls', 'ops_daily_job_status'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS ops_deny_client_roles ON public.%I', t);
    EXECUTE format('CREATE POLICY ops_deny_client_roles ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

-- Identity sequences: no client role may draw ids.
DO $$
DECLARE
  s text;
BEGIN
  FOR s IN SELECT pg_get_serial_sequence('public.' || t, 'id') FROM unnest(ARRAY['ops_workflow_runs', 'ops_raw_daily_pulls', 'ops_daily_job_status']) AS t LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', s);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role', s);
  END LOOP;
END $$;

COMMIT;

BEGIN;
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN 1 ELSE 0 END AS role_guard;
SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM ccpun_admin.system_identity WHERE singleton=true) THEN 1 ELSE 0 END AS identity_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260927_analytics_marketing_reports_v2'));
SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260927_analytics_daily_raw_v1' AND checksum='sha256:96bb27179454643c5f0e8e991e5a41193a344755d3b65cc3b8dadf0b8e9cf076') THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT 1 / CASE WHEN NOT EXISTS (SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260927_analytics_marketing_reports_v2' AND checksum<>'sha256:c598e20cc95d2f36f709fbd9bdb5225c3893e77bcdb052cfc2674d6957e62657') THEN 1 ELSE 0 END AS checksum_guard;

-- checksum-source-begin
DO $analytics_marketing_guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.conrelid='ccpun_admin.analytics_completed_report'::regclass AND c.conname='analytics_completed_report_report_check' AND c.contype='c' AND c.convalidated AND c.conkey=ARRAY[a.attnum] AND a.attname='report') THEN
    RAISE EXCEPTION 'ANALYTICS_REPORT_CONSTRAINT_NOT_VERIFIED';
  END IF;
END $analytics_marketing_guard$;
-- Transactional, validated superset: preserve every v1 report, row, function and grant.
ALTER TABLE ccpun_admin.analytics_completed_report DROP CONSTRAINT analytics_completed_report_report_check;
ALTER TABLE ccpun_admin.analytics_completed_report ADD CONSTRAINT analytics_completed_report_report_check
  CHECK (report IN ('gsc-summary','gsc-query-page','ga4-summary','ga4-organic-landing','social-performance','seo-intelligence','ubersuggest-web-keywords','ga4-session-performance','ga4-marketing-events'));
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum) VALUES('20260927_analytics_marketing_reports_v2','sha256:c598e20cc95d2f36f709fbd9bdb5225c3893e77bcdb052cfc2674d6957e62657') ON CONFLICT(version) DO NOTHING;
COMMIT;

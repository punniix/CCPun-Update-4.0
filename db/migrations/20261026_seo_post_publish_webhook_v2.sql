-- Files only: owner reviews/applies in isolated lanes; this task never runs SQL.
BEGIN;
SELECT 1 / (CASE WHEN current_database()='neondb' AND EXISTS (
 SELECT 1 FROM ccpun_admin.system_identity WHERE singleton=true AND
 (project_id,branch_id) IN (('young-term-47483330','br-crimson-mouse-az7ajkv8'),('lively-bar-43618798','br-long-resonance-b3ys5xrv'))
) THEN 1 ELSE 0 END) AS source_identity_accepted;

ALTER TABLE ccpun_admin.seo_post_publish_job DROP CONSTRAINT IF EXISTS seo_post_publish_job_source_check;
ALTER TABLE ccpun_admin.seo_post_publish_job ADD CONSTRAINT seo_post_publish_job_source_check CHECK(source IN ('owner','reconciler','webhook'));
ALTER TABLE ccpun_admin.seo_post_publish_job DROP CONSTRAINT IF EXISTS seo_post_publish_job_attempts_check;
ALTER TABLE ccpun_admin.seo_post_publish_job ADD CONSTRAINT seo_post_publish_job_attempts_check CHECK(attempts BETWEEN 0 AND 8);
ALTER TABLE ccpun_admin.seo_post_publish_job
 ADD COLUMN IF NOT EXISTS sanity_rev text,
 ADD COLUMN IF NOT EXISTS delivery_id text,
 ADD COLUMN IF NOT EXISTS notify_state text NOT NULL DEFAULT 'pending' CHECK(notify_state IN ('pending','gsc-submitted','indexnow-sent','skipped','failed','completed')),
 ADD COLUMN IF NOT EXISTS gsc_submit_at timestamptz,
 ADD COLUMN IF NOT EXISTS indexnow_at timestamptz,
 ADD COLUMN IF NOT EXISTS inspect_due_1h timestamptz,
 ADD COLUMN IF NOT EXISTS inspect_due_24h timestamptz,
 ADD COLUMN IF NOT EXISTS inspect_1h_json jsonb,
 ADD COLUMN IF NOT EXISTS inspect_24h_json jsonb,
 ADD COLUMN IF NOT EXISTS final_index_state text;

-- Append-only authority survives a reconciler winning the article/version race.
CREATE TABLE IF NOT EXISTS ccpun_admin.seo_post_publish_intent(
 delivery_id text PRIMARY KEY CHECK(length(delivery_id) BETWEEN 1 AND 200),
 job_id uuid NOT NULL REFERENCES ccpun_admin.seo_post_publish_job(job_id) DEFERRABLE INITIALLY DEFERRED,
 article_id text NOT NULL, content_version timestamptz NOT NULL, sanity_rev text NOT NULL,
 origin text NOT NULL CHECK(origin IN ('webhook','owner')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ccpun_admin.seo_post_publish_step(
 job_id uuid NOT NULL REFERENCES ccpun_admin.seo_post_publish_job(job_id),
 step text NOT NULL CHECK(step IN ('gsc-sitemap-submit','indexnow','inspect-1h','inspect-24h')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','succeeded','failed','uncertain','blocked','coalesced')),
 attempts int NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 next_attempt_at timestamptz NOT NULL DEFAULT now(), lease_id uuid, lease_until timestamptz,
 error_code text, result_json jsonb CHECK(octet_length(coalesce(result_json::text,''))<=16000),
 started_at timestamptz, finished_at timestamptz, PRIMARY KEY(job_id,step)
);
CREATE TABLE IF NOT EXISTS ccpun_admin.seo_sitemap_submit_ledger(
 provider text NOT NULL CHECK(provider IN ('gsc','indexnow','inspection')), day date NOT NULL,
 submits int NOT NULL DEFAULT 0 CHECK(submits>=0), last_attempt_at timestamptz,
 minute_start timestamptz, minute_count int NOT NULL DEFAULT 0 CHECK(minute_count>=0),
 PRIMARY KEY(provider,day)
);
CREATE TABLE IF NOT EXISTS ccpun_admin.seo_post_publish_worker_pass(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), checked_at timestamptz NOT NULL
);
REVOKE ALL ON ccpun_admin.seo_post_publish_intent,ccpun_admin.seo_post_publish_step,
 ccpun_admin.seo_sitemap_submit_ledger,ccpun_admin.seo_post_publish_worker_pass FROM PUBLIC;
GRANT SELECT,INSERT ON ccpun_admin.seo_post_publish_intent TO ccpun_admin_runtime;
GRANT SELECT ON ccpun_admin.seo_post_publish_step,ccpun_admin.seo_sitemap_submit_ledger,
 ccpun_admin.seo_post_publish_worker_pass TO ccpun_admin_runtime;
GRANT SELECT ON ccpun_admin.seo_post_publish_intent TO ccpun_seo_post_publish_worker;
GRANT SELECT,INSERT,UPDATE ON ccpun_admin.seo_post_publish_step,ccpun_admin.seo_sitemap_submit_ledger,
 ccpun_admin.seo_post_publish_worker_pass TO ccpun_seo_post_publish_worker;
REVOKE DELETE ON ccpun_admin.seo_post_publish_job,ccpun_admin.seo_post_publish_intent,
 ccpun_admin.seo_post_publish_step,ccpun_admin.seo_sitemap_submit_ledger,
 ccpun_admin.seo_post_publish_worker_pass FROM ccpun_admin_runtime,ccpun_seo_post_publish_worker;

-- One property; provider advisory locks serialize its small daily ledger.
CREATE OR REPLACE FUNCTION ccpun_admin.seo_reserve_notification(
 p_job uuid,p_lease uuid,p_step text,p_limit int
) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,ccpun_admin AS $$
DECLARE v_provider text; v_now timestamptz:=clock_timestamp(); v_day date; v_row record; v_last timestamptz; v_minute_start timestamptz; v_minute_count int;
BEGIN
 IF p_step NOT IN ('gsc-sitemap-submit','indexnow','inspect-1h','inspect-24h') THEN RETURN 'denied'; END IF;
 v_provider:=CASE p_step WHEN 'gsc-sitemap-submit' THEN 'gsc' WHEN 'indexnow' THEN 'indexnow' ELSE 'inspection' END;
 v_day:=(v_now AT TIME ZONE 'UTC')::date;
 PERFORM pg_advisory_xact_lock(hashtext('seo-notify-'||v_provider));
 IF p_step LIKE 'inspect-%' THEN
   IF NOT EXISTS(SELECT 1 FROM seo_post_publish_step WHERE job_id=p_job AND step=p_step AND state='processing'
     AND lease_id=p_lease AND lease_until>v_now) THEN RETURN 'denied'; END IF;
 ELSE
   IF NOT EXISTS(SELECT 1 FROM seo_post_publish_job j WHERE j.job_id=p_job AND j.state='processing'
     AND j.lease_id=p_lease AND j.lease_until>v_now AND
     (j.source='owner' AND j.owner_approved OR EXISTS(SELECT 1 FROM seo_post_publish_intent i WHERE i.job_id=j.job_id))) THEN RETURN 'denied'; END IF;
 END IF;
 SELECT * INTO v_row FROM seo_post_publish_step WHERE job_id=p_job AND step=p_step;
 IF FOUND AND v_row.state IN ('succeeded','coalesced') THEN RETURN 'done'; END IF;
 IF FOUND AND (v_row.state IN ('uncertain','blocked') OR (v_row.attempts>=3 AND p_step NOT LIKE 'inspect-%')) THEN RETURN 'reconciliation-required'; END IF;
 IF FOUND AND v_row.next_attempt_at>v_now THEN RETURN 'retry-later'; END IF;
 IF FOUND AND v_row.state='processing' AND p_step NOT LIKE 'inspect-%' THEN RETURN 'reconciliation-required'; END IF;
 IF v_provider='gsc' AND EXISTS(SELECT 1 FROM seo_post_publish_step WHERE step=p_step AND
   (state='uncertain' OR state='processing' AND lease_until<=v_now)) THEN RETURN 'reconciliation-required'; END IF;
 IF v_provider='gsc' AND EXISTS(SELECT 1 FROM seo_post_publish_step WHERE step=p_step AND state='processing' AND lease_until>v_now) THEN RETURN 'retry-later'; END IF;
 IF v_provider='gsc' THEN
   SELECT max(last_attempt_at) INTO v_last FROM seo_sitemap_submit_ledger WHERE provider='gsc';
   IF v_last>v_now-interval '30 minutes' THEN
     IF EXISTS(SELECT 1 FROM seo_post_publish_step WHERE step=p_step AND state='succeeded' AND finished_at>=v_last) THEN
       INSERT INTO seo_post_publish_step(job_id,step,state,finished_at) VALUES(p_job,p_step,'coalesced',v_now)
       ON CONFLICT(job_id,step) DO UPDATE SET state='coalesced',finished_at=v_now;
       RETURN 'coalesced';
     END IF;
     RETURN 'retry-later';
   END IF;
 END IF;
 IF p_limit IS NULL OR p_limit<=0 OR (v_provider='gsc' AND p_limit>20) OR (v_provider='inspection' AND p_limit>1600) THEN RETURN 'budget-unavailable'; END IF;
 INSERT INTO seo_sitemap_submit_ledger(provider,day) VALUES(v_provider,v_day) ON CONFLICT DO NOTHING;
 SELECT * INTO v_row FROM seo_sitemap_submit_ledger WHERE provider=v_provider AND day=v_day FOR UPDATE;
 IF v_row.submits>=p_limit THEN RETURN 'budget-exhausted'; END IF;
 -- Carry the active minute window across the daily row rollover.
 SELECT minute_start,minute_count INTO v_minute_start,v_minute_count FROM seo_sitemap_submit_ledger
   WHERE provider=v_provider ORDER BY minute_start DESC NULLS LAST, day DESC LIMIT 1;
 IF v_provider='inspection' AND v_minute_start>v_now-interval '1 minute' AND v_minute_count>=480 THEN RETURN 'retry-later'; END IF;
 UPDATE seo_sitemap_submit_ledger SET submits=submits+1,last_attempt_at=v_now,
   minute_count=CASE WHEN v_minute_start>v_now-interval '1 minute' THEN v_minute_count+1 ELSE 1 END,
   minute_start=CASE WHEN v_minute_start>v_now-interval '1 minute' THEN v_minute_start ELSE v_now END
   WHERE provider=v_provider AND day=v_day;
 IF p_step NOT LIKE 'inspect-%' THEN
   INSERT INTO seo_post_publish_step(job_id,step,state,attempts,lease_id,lease_until,started_at)
     VALUES(p_job,p_step,'processing',1,p_lease,v_now+interval '4 minutes',v_now)
   ON CONFLICT(job_id,step) DO UPDATE SET state='processing',attempts=seo_post_publish_step.attempts+1,
     lease_id=p_lease,lease_until=v_now+interval '4 minutes',started_at=v_now;
   IF p_step='gsc-sitemap-submit' THEN UPDATE seo_post_publish_job SET sitemap_attempted=true WHERE job_id=p_job; END IF;
 END IF;
 RETURN 'reserved';
END $$;
REVOKE ALL ON FUNCTION ccpun_admin.seo_reserve_notification(uuid,uuid,text,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ccpun_admin.seo_reserve_notification(uuid,uuid,text,int) TO ccpun_seo_post_publish_worker;
-- Initial observation shares the published 2,000/day and 600/min property budget,
-- stopped at 80%; it never acquires notification authority.
CREATE OR REPLACE FUNCTION ccpun_admin.seo_reserve_initial_inspection(p_job uuid,p_lease uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,ccpun_admin AS $$
DECLARE v_now timestamptz:=clock_timestamp(); v_day date; v_row record; v_minute_start timestamptz; v_minute_count int;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM seo_post_publish_job WHERE job_id=p_job AND state='processing' AND lease_id=p_lease AND lease_until>v_now) THEN RETURN false; END IF;
 v_day:=(v_now AT TIME ZONE 'UTC')::date;
 PERFORM pg_advisory_xact_lock(hashtext('seo-notify-inspection'));
 INSERT INTO seo_sitemap_submit_ledger(provider,day) VALUES('inspection',v_day) ON CONFLICT DO NOTHING;
 SELECT * INTO v_row FROM seo_sitemap_submit_ledger WHERE provider='inspection' AND day=v_day FOR UPDATE;
 SELECT minute_start,minute_count INTO v_minute_start,v_minute_count FROM seo_sitemap_submit_ledger
   WHERE provider='inspection' ORDER BY minute_start DESC NULLS LAST, day DESC LIMIT 1;
 IF v_row.submits>=1600 OR (v_minute_start>v_now-interval '1 minute' AND v_minute_count>=480) THEN RETURN false; END IF;
 UPDATE seo_sitemap_submit_ledger SET submits=submits+1,last_attempt_at=v_now,
 minute_count=CASE WHEN v_minute_start>v_now-interval '1 minute' THEN v_minute_count+1 ELSE 1 END,
 minute_start=CASE WHEN v_minute_start>v_now-interval '1 minute' THEN v_minute_start ELSE v_now END
 WHERE provider='inspection' AND day=v_day;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION ccpun_admin.seo_reserve_initial_inspection(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ccpun_admin.seo_reserve_initial_inspection(uuid,uuid) TO ccpun_seo_post_publish_worker;
COMMIT;

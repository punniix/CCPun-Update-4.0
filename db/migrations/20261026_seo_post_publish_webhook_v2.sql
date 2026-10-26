-- Deployment file only. Tests may apply to their own disposable local PostgreSQL cluster; never an environment database.
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

-- Feature-specific, single-property aggregate windows. No provider credential is stored.
CREATE TABLE IF NOT EXISTS ccpun_admin.seo_gsc_window(
 window_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','validating','processing','succeeded','skipped','failed','uncertain','reconciling','blocked')),
 opened_at timestamptz NOT NULL DEFAULT now(),closes_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes',
 next_attempt_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes',coverage_cutoff timestamptz,
 attempts int NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),validation_attempts int NOT NULL DEFAULT 0,
 started_at timestamptz,finished_at timestamptz,lease_id uuid,lease_until timestamptz,
 reconcile_attempts int NOT NULL DEFAULT 0 CHECK(reconcile_attempts BETWEEN 0 AND 3),
 next_reconcile_at timestamptz,retry_released boolean NOT NULL DEFAULT false,last_error_code text,last_observation jsonb
 CHECK(octet_length(coalesce(last_observation::text,''))<=16000)
);
ALTER TABLE ccpun_admin.seo_post_publish_step ADD COLUMN IF NOT EXISTS gsc_window_id uuid REFERENCES ccpun_admin.seo_gsc_window(window_id),
 ADD COLUMN IF NOT EXISTS gsc_ready_at timestamptz;
ALTER TABLE ccpun_admin.seo_sitemap_submit_ledger DROP CONSTRAINT IF EXISTS seo_sitemap_submit_ledger_provider_check;
ALTER TABLE ccpun_admin.seo_sitemap_submit_ledger ADD CONSTRAINT seo_sitemap_submit_ledger_provider_check CHECK(provider IN ('gsc','indexnow','inspection','gsc-reconcile'));
REVOKE ALL ON ccpun_admin.seo_gsc_window FROM PUBLIC;
GRANT SELECT ON ccpun_admin.seo_gsc_window TO ccpun_admin_runtime;
GRANT SELECT,INSERT,UPDATE ON ccpun_admin.seo_gsc_window TO ccpun_seo_post_publish_worker;
REVOKE DELETE ON ccpun_admin.seo_gsc_window FROM ccpun_admin_runtime,ccpun_seo_post_publish_worker;
-- Historical coalesced rows prove no submission after their arrival. Re-enroll through current live/approval gates.
UPDATE ccpun_admin.seo_post_publish_step SET state='pending',next_attempt_at=now(),error_code='gsc-legacy-uncovered'
 WHERE step='gsc-sitemap-submit' AND state='coalesced' AND gsc_window_id IS NULL;

-- Upgrade old unresolved writes into the same reconciliation fence, never fresh pending authority.
DO $$ DECLARE old record; wid uuid; stamp timestamptz; BEGIN
 FOR old IN SELECT * FROM ccpun_admin.seo_post_publish_step WHERE step='gsc-sitemap-submit' AND gsc_window_id IS NULL AND state IN ('uncertain','processing') LOOP
  stamp:=clock_timestamp();wid:=gen_random_uuid();
  INSERT INTO ccpun_admin.seo_gsc_window(window_id,state,opened_at,closes_at,next_attempt_at,started_at,attempts,next_reconcile_at,last_error_code)
  VALUES(wid,'uncertain',stamp,stamp,stamp,coalesce(old.started_at,stamp),greatest(1,least(3,old.attempts)),stamp+interval '30 minutes','gsc-legacy-uncertain');
  UPDATE ccpun_admin.seo_post_publish_step SET state='uncertain',gsc_window_id=wid,gsc_ready_at=stamp,lease_id=NULL,lease_until=NULL WHERE job_id=old.job_id AND step=old.step;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION ccpun_admin.seo_enroll_gsc_window(p_job uuid,p_lease uuid)
RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,ccpun_admin AS $$
DECLARE w record; s record; v_now timestamptz:=clock_timestamp();
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('seo-notify-gsc'));
 IF NOT EXISTS(SELECT 1 FROM seo_post_publish_job j WHERE j.job_id=p_job AND j.state='processing' AND j.lease_id=p_lease AND j.lease_until>v_now
 AND (j.source='owner' AND j.owner_approved OR EXISTS(SELECT 1 FROM seo_post_publish_intent i WHERE i.job_id=j.job_id))) THEN RETURN 'denied'; END IF;
 SELECT * INTO s FROM seo_post_publish_step WHERE job_id=p_job AND step='gsc-sitemap-submit';
 IF FOUND AND s.state='succeeded' THEN RETURN 'done'; END IF;
 IF FOUND AND s.gsc_window_id IS NOT NULL THEN
   SELECT * INTO w FROM seo_gsc_window WHERE window_id=s.gsc_window_id;
   RETURN CASE WHEN w.state IN ('uncertain','reconciling') OR w.last_error_code='gsc-uncertain-exhausted' THEN 'gsc-reconciling'
     WHEN w.state='blocked' THEN 'gsc-blocked' ELSE 'deferred' END;
 END IF;
 SELECT * INTO w FROM seo_gsc_window WHERE state='pending' AND closes_at>v_now ORDER BY opened_at LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN INSERT INTO seo_gsc_window(opened_at,closes_at,next_attempt_at) VALUES(v_now,v_now+interval '30 minutes',v_now+interval '30 minutes') RETURNING * INTO w; END IF;
 INSERT INTO seo_post_publish_step(job_id,step,state,gsc_window_id,gsc_ready_at,next_attempt_at)
 VALUES(p_job,'gsc-sitemap-submit','pending',w.window_id,v_now,w.closes_at)
 ON CONFLICT(job_id,step) DO UPDATE SET state='pending',gsc_window_id=w.window_id,gsc_ready_at=v_now,next_attempt_at=w.closes_at,error_code=NULL;
 RETURN 'deferred';
END $$;

CREATE OR REPLACE FUNCTION ccpun_admin.seo_claim_gsc_window(p_lease uuid)
RETURNS SETOF ccpun_admin.seo_gsc_window LANGUAGE plpgsql SET search_path=pg_catalog,ccpun_admin AS $$
DECLARE v_now timestamptz:=clock_timestamp();
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('seo-notify-gsc'));
 UPDATE seo_gsc_window SET state='uncertain',lease_id=NULL,lease_until=NULL,next_reconcile_at=greatest(v_now,started_at+interval '30 minutes'),last_error_code='gsc-write-lease-expired'
 WHERE state='processing' AND lease_until<=v_now;
 UPDATE seo_gsc_window SET state='uncertain',lease_id=NULL,lease_until=NULL WHERE state='reconciling' AND lease_until<=v_now;
 UPDATE seo_gsc_window SET state=CASE WHEN retry_released OR attempts>=3 THEN 'blocked' ELSE 'pending' END,
   retry_released=retry_released OR attempts<3,next_attempt_at=v_now,
   last_error_code=CASE WHEN retry_released OR attempts>=3 THEN 'gsc-uncertain-exhausted' ELSE 'gsc-retry-released' END,
   last_observation=coalesce(last_observation,'{"kind":"transport-error","error":"reconciliation-lease-expired"}'::jsonb)
 WHERE state='uncertain' AND reconcile_attempts>=3 AND v_now>=started_at+interval '90 minutes';
 UPDATE seo_post_publish_step s SET state=CASE WHEN w.state='pending' THEN 'pending' ELSE 'blocked' END,error_code=w.last_error_code,lease_id=NULL,lease_until=NULL
 FROM seo_gsc_window w WHERE s.gsc_window_id=w.window_id AND s.state IN ('uncertain','processing') AND w.last_error_code IN ('gsc-retry-released','gsc-uncertain-exhausted');

 UPDATE seo_gsc_window SET state='pending',lease_id=NULL,lease_until=NULL WHERE state='validating' AND lease_until<=v_now;
 IF EXISTS(SELECT 1 FROM seo_gsc_window WHERE state IN ('processing','validating','uncertain','reconciling') OR last_error_code='gsc-uncertain-exhausted') THEN RETURN; END IF;
 RETURN QUERY WITH candidate AS(SELECT window_id FROM seo_gsc_window WHERE state IN ('pending','failed') AND closes_at<=v_now AND next_attempt_at<=v_now
   AND attempts<3 ORDER BY opened_at LIMIT 1 FOR UPDATE SKIP LOCKED)
 UPDATE seo_gsc_window w SET state='validating',lease_id=p_lease,lease_until=v_now+interval '4 minutes'
 FROM candidate c WHERE w.window_id=c.window_id RETURNING w.*;
END $$;

CREATE OR REPLACE FUNCTION ccpun_admin.seo_begin_gsc_window(p_window uuid,p_lease uuid,p_eligible uuid[],p_retry uuid[],p_limit int)
RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,ccpun_admin AS $$
DECLARE w record; v_now timestamptz:=clock_timestamp(); v_day date; v_last timestamptz; v_count int;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('seo-notify-gsc'));
 SELECT * INTO w FROM seo_gsc_window WHERE window_id=p_window AND state='validating' AND lease_id=p_lease AND lease_until>v_now FOR UPDATE;
 IF NOT FOUND THEN RETURN 'denied'; END IF;
 IF EXISTS(SELECT 1 FROM seo_gsc_window WHERE window_id<>p_window AND (state IN ('processing','validating','uncertain','reconciling') OR last_error_code='gsc-uncertain-exhausted')) THEN
  UPDATE seo_gsc_window SET state='pending',next_attempt_at=v_now+interval '30 minutes',lease_id=NULL,lease_until=NULL WHERE window_id=p_window;
  RETURN 'gsc-reconciling';
 END IF;
 -- Membership and authority are checked again in SQL; JS just revalidated current CMS/live state.
 IF EXISTS(SELECT 1 FROM unnest(coalesce(p_eligible,'{}'::uuid[])||coalesce(p_retry,'{}'::uuid[])) AS member(id) WHERE NOT EXISTS(
   SELECT 1 FROM seo_post_publish_step s JOIN seo_post_publish_job j USING(job_id) WHERE s.job_id=member.id AND s.gsc_window_id=p_window AND s.gsc_ready_at<=w.closes_at
   AND (j.source='owner' AND j.owner_approved OR EXISTS(SELECT 1 FROM seo_post_publish_intent i WHERE i.job_id=j.job_id)))) THEN RETURN 'denied'; END IF;
 UPDATE seo_post_publish_step SET state='blocked',error_code='gsc-member-ineligible' WHERE gsc_window_id=p_window
   AND NOT(job_id=ANY(coalesce(p_eligible,'{}'::uuid[])||coalesce(p_retry,'{}'::uuid[])));
 IF cardinality(p_retry)>0 THEN
   UPDATE seo_gsc_window SET state=CASE WHEN validation_attempts>=7 THEN 'blocked' ELSE 'pending' END,validation_attempts=validation_attempts+1,
    next_attempt_at=v_now+interval '2 minutes',lease_id=NULL,lease_until=NULL,last_error_code='gsc-not-live' WHERE window_id=p_window;
   RETURN 'retry-later';
 END IF;
 IF coalesce(cardinality(p_eligible),0)=0 THEN UPDATE seo_gsc_window SET state='skipped',lease_id=NULL,lease_until=NULL,finished_at=v_now WHERE window_id=p_window; RETURN 'skipped'; END IF;
 SELECT max(last_attempt_at) INTO v_last FROM seo_sitemap_submit_ledger WHERE provider='gsc';
 IF v_last>v_now-interval '30 minutes' THEN
   UPDATE seo_gsc_window SET state='pending',next_attempt_at=v_last+interval '30 minutes',lease_id=NULL,lease_until=NULL WHERE window_id=p_window; RETURN 'retry-later'; END IF;
 IF p_limit IS NULL OR p_limit<=0 OR p_limit>20 THEN UPDATE seo_gsc_window SET state='pending',next_attempt_at=v_now+interval '1 hour',lease_id=NULL,lease_until=NULL,last_error_code='gsc-budget-unavailable' WHERE window_id=p_window; RETURN 'budget-unavailable'; END IF;
 v_day:=(v_now AT TIME ZONE 'UTC')::date;
 INSERT INTO seo_sitemap_submit_ledger(provider,day) VALUES('gsc',v_day) ON CONFLICT DO NOTHING;
 SELECT submits INTO v_count FROM seo_sitemap_submit_ledger WHERE provider='gsc' AND day=v_day FOR UPDATE;
 IF v_count>=p_limit THEN UPDATE seo_gsc_window SET state='pending',next_attempt_at=(date_trunc('day',v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')+interval '1 day',lease_id=NULL,lease_until=NULL,last_error_code='gsc-budget-exhausted' WHERE window_id=p_window; RETURN 'budget-exhausted'; END IF;
 UPDATE seo_sitemap_submit_ledger SET submits=submits+1,last_attempt_at=v_now WHERE provider='gsc' AND day=v_day;
 UPDATE seo_gsc_window SET state='processing',attempts=attempts+1,started_at=v_now,coverage_cutoff=closes_at,
   reconcile_attempts=0,next_reconcile_at=NULL,last_error_code=NULL WHERE window_id=p_window;
 UPDATE seo_post_publish_step SET state='processing',attempts=least(3,attempts+1),lease_id=p_lease,lease_until=w.lease_until,started_at=v_now
   WHERE gsc_window_id=p_window AND job_id=ANY(p_eligible);
 UPDATE seo_post_publish_job SET sitemap_attempted=true WHERE job_id=ANY(p_eligible);
 RETURN 'reserved';
END $$;

CREATE OR REPLACE FUNCTION ccpun_admin.seo_finish_gsc_window(p_window uuid,p_lease uuid,p_state text,p_error text,p_result jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,ccpun_admin AS $$
DECLARE w record; v_now timestamptz:=clock_timestamp(); v_state text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('seo-notify-gsc'));
 IF p_state NOT IN ('succeeded','failed','uncertain','blocked') THEN RETURN false; END IF;
 SELECT * INTO w FROM seo_gsc_window WHERE window_id=p_window AND state='processing' AND lease_id=p_lease AND lease_until>v_now FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 v_state:=CASE WHEN p_state='failed' AND w.attempts>=3 THEN 'blocked' ELSE p_state END;
 UPDATE seo_gsc_window SET state=v_state,finished_at=v_now,last_error_code=p_error,last_observation=p_result,lease_id=NULL,lease_until=NULL,
  next_attempt_at=v_now+interval '30 minutes',next_reconcile_at=CASE WHEN v_state='uncertain' THEN v_now+interval '30 minutes' END WHERE window_id=p_window;
 UPDATE seo_post_publish_step SET state=v_state,error_code=p_error,result_json=p_result,finished_at=v_now,lease_id=NULL,lease_until=NULL
  WHERE gsc_window_id=p_window AND state='processing' AND lease_id=p_lease;
 UPDATE seo_post_publish_job j SET gsc_submit_at=v_now,notify_state='gsc-submitted' WHERE p_state='succeeded' AND EXISTS(
  SELECT 1 FROM seo_post_publish_step s WHERE s.job_id=j.job_id AND s.gsc_window_id=p_window AND s.state='succeeded');
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION ccpun_admin.seo_claim_gsc_reconciliation(p_lease uuid,p_limit int)
RETURNS SETOF ccpun_admin.seo_gsc_window LANGUAGE plpgsql SET search_path=pg_catalog,ccpun_admin AS $$
DECLARE v_now timestamptz:=clock_timestamp(); v_day date; v_count int;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('seo-notify-gsc'));
 UPDATE seo_gsc_window SET state='uncertain',lease_id=NULL,lease_until=NULL,next_reconcile_at=greatest(v_now,started_at+interval '30 minutes'),last_error_code='gsc-write-lease-expired'
 WHERE state='processing' AND lease_until<=v_now;

 UPDATE seo_gsc_window SET state='uncertain',lease_id=NULL,lease_until=NULL WHERE state='reconciling' AND lease_until<=v_now;
 UPDATE seo_gsc_window SET state=CASE WHEN retry_released OR attempts>=3 THEN 'blocked' ELSE 'pending' END,
   retry_released=retry_released OR attempts<3,next_attempt_at=v_now,
   last_error_code=CASE WHEN retry_released OR attempts>=3 THEN 'gsc-uncertain-exhausted' ELSE 'gsc-retry-released' END,
   last_observation=coalesce(last_observation,'{"kind":"transport-error","error":"reconciliation-lease-expired"}'::jsonb)
 WHERE state='uncertain' AND reconcile_attempts>=3 AND v_now>=started_at+interval '90 minutes';
 UPDATE seo_post_publish_step s SET state=CASE WHEN w.state='pending' THEN 'pending' ELSE 'blocked' END,error_code=w.last_error_code,lease_id=NULL,lease_until=NULL
 FROM seo_gsc_window w WHERE s.gsc_window_id=w.window_id AND s.state IN ('uncertain','processing') AND w.last_error_code IN ('gsc-retry-released','gsc-uncertain-exhausted');

 IF p_limit IS NULL OR p_limit<=0 OR p_limit>20 OR NOT EXISTS(SELECT 1 FROM seo_gsc_window WHERE state='uncertain' AND next_reconcile_at<=v_now AND reconcile_attempts<3) THEN RETURN; END IF;
 v_day:=(v_now AT TIME ZONE 'UTC')::date;
 INSERT INTO seo_sitemap_submit_ledger(provider,day) VALUES('gsc-reconcile',v_day) ON CONFLICT DO NOTHING;
 SELECT submits INTO v_count FROM seo_sitemap_submit_ledger WHERE provider='gsc-reconcile' AND day=v_day FOR UPDATE;
 IF v_count>=p_limit THEN RETURN; END IF;
 UPDATE seo_sitemap_submit_ledger SET submits=submits+1,last_attempt_at=v_now WHERE provider='gsc-reconcile' AND day=v_day;
 RETURN QUERY WITH candidate AS(SELECT window_id FROM seo_gsc_window WHERE state='uncertain' AND next_reconcile_at<=v_now AND reconcile_attempts<3 ORDER BY opened_at LIMIT 1 FOR UPDATE SKIP LOCKED)
 UPDATE seo_gsc_window w SET state='reconciling',reconcile_attempts=reconcile_attempts+1,lease_id=p_lease,lease_until=v_now+interval '4 minutes',next_reconcile_at=v_now+interval '30 minutes'
 FROM candidate c WHERE w.window_id=c.window_id RETURNING w.*;
END $$;

CREATE OR REPLACE FUNCTION ccpun_admin.seo_finish_gsc_reconciliation(p_window uuid,p_lease uuid,p_confirmed boolean,p_observation jsonb)
RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,ccpun_admin AS $$
DECLARE w record; v_now timestamptz:=clock_timestamp(); v_state text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('seo-notify-gsc'));
 SELECT * INTO w FROM seo_gsc_window WHERE window_id=p_window AND state='reconciling' AND lease_id=p_lease AND lease_until>v_now FOR UPDATE;
 IF NOT FOUND THEN RETURN 'denied'; END IF;
 v_state:=CASE WHEN p_confirmed THEN 'succeeded' WHEN w.reconcile_attempts>=3 AND v_now>=w.started_at+interval '90 minutes'
   THEN CASE WHEN w.retry_released OR w.attempts>=3 THEN 'blocked' ELSE 'pending' END ELSE 'uncertain' END;
 UPDATE seo_gsc_window SET state=v_state,lease_id=NULL,lease_until=NULL,last_observation=p_observation,
   retry_released=retry_released OR v_state='pending',next_attempt_at=CASE WHEN v_state='pending' THEN v_now ELSE next_attempt_at END,
   last_error_code=CASE WHEN v_state='blocked' THEN 'gsc-uncertain-exhausted' WHEN v_state='pending' THEN 'gsc-retry-released' WHEN v_state='succeeded' THEN NULL ELSE 'gsc-reconciling' END WHERE window_id=p_window;
 UPDATE seo_post_publish_step SET state=CASE v_state WHEN 'pending' THEN 'pending' WHEN 'succeeded' THEN 'succeeded' WHEN 'blocked' THEN 'blocked' ELSE 'uncertain' END,
   error_code=CASE WHEN v_state='blocked' THEN 'gsc-uncertain-exhausted' WHEN v_state='pending' THEN 'gsc-retry-released' WHEN v_state='succeeded' THEN NULL ELSE 'gsc-reconciling' END,
   result_json=p_observation,lease_id=NULL,lease_until=NULL WHERE gsc_window_id=p_window AND state IN ('processing','uncertain');
 UPDATE seo_post_publish_job j SET gsc_submit_at=v_now,notify_state='gsc-submitted' WHERE p_confirmed AND EXISTS(
   SELECT 1 FROM seo_post_publish_step s WHERE s.job_id=j.job_id AND s.gsc_window_id=p_window AND s.state='succeeded');
 RETURN v_state;
END $$;
REVOKE ALL ON FUNCTION ccpun_admin.seo_enroll_gsc_window(uuid,uuid),ccpun_admin.seo_claim_gsc_window(uuid),ccpun_admin.seo_begin_gsc_window(uuid,uuid,uuid[],uuid[],int),
 ccpun_admin.seo_finish_gsc_window(uuid,uuid,text,text,jsonb),ccpun_admin.seo_claim_gsc_reconciliation(uuid,int),ccpun_admin.seo_finish_gsc_reconciliation(uuid,uuid,boolean,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ccpun_admin.seo_enroll_gsc_window(uuid,uuid),ccpun_admin.seo_claim_gsc_window(uuid),ccpun_admin.seo_begin_gsc_window(uuid,uuid,uuid[],uuid[],int),
 ccpun_admin.seo_finish_gsc_window(uuid,uuid,text,text,jsonb),ccpun_admin.seo_claim_gsc_reconciliation(uuid,int),ccpun_admin.seo_finish_gsc_reconciliation(uuid,uuid,boolean,jsonb) TO ccpun_seo_post_publish_worker;

-- One property; provider advisory locks serialize its small daily ledger.
CREATE OR REPLACE FUNCTION ccpun_admin.seo_reserve_notification(
 p_job uuid,p_lease uuid,p_step text,p_limit int
) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,ccpun_admin AS $$
DECLARE v_provider text; v_now timestamptz:=clock_timestamp(); v_day date; v_row record; v_last timestamptz; v_minute_start timestamptz; v_minute_count int;
BEGIN
 IF p_step NOT IN ('gsc-sitemap-submit','indexnow','inspect-1h','inspect-24h') THEN RETURN 'denied'; END IF;
 IF p_step='gsc-sitemap-submit' THEN RETURN seo_enroll_gsc_window(p_job,p_lease); END IF;
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

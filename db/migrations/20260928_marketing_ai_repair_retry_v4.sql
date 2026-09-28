BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN 1 ELSE 0 END AS role_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND database_name='neondb' AND migration_version='20260919_local_ai_control_plane_v1' AND migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6' AND ((lane='uat' AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394') OR (lane='production' AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w'))) THEN 1 ELSE 0 END AS identity_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260927_marketing_retry_v3' AND checksum='sha256:e150ce6f3fecd22ff312fe5265340eb882b53044c1e6b319f5b6b6aa833a480e') THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260928_marketing_ai_repair_retry_v4'));
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_ai_repair_retry_v4' AND checksum<>'sha256:27d012741dd64bbb1d5378ecb4bcd165a9e379b8046342d13019d2dec67290db') THEN 1 ELSE 0 END AS checksum_guard;
-- The v3 checksum above pins the exact source of these four existing constraints.
SELECT 1 / CASE WHEN (SELECT count(*) FROM pg_constraint WHERE conrelid='ccpun_admin.marketing_analysis_attempt'::regclass AND contype='c' AND conname IN('marketing_analysis_attempt_generation_check','marketing_analysis_attempt_provenance_check','marketing_analysis_attempt_check','marketing_analysis_attempt_check1'))=4 THEN 1 ELSE 0 END AS attempt_constraint_guard;
-- checksum-source-begin
ALTER TABLE ccpun_admin.marketing_analysis_attempt
 DROP CONSTRAINT marketing_analysis_attempt_generation_check,
 DROP CONSTRAINT marketing_analysis_attempt_provenance_check,
 DROP CONSTRAINT marketing_analysis_attempt_check,
 DROP CONSTRAINT marketing_analysis_attempt_check1;
ALTER TABLE ccpun_admin.marketing_analysis_attempt
 ADD CONSTRAINT marketing_analysis_attempt_generation_v4_check CHECK(generation BETWEEN 1 AND 3),
 ADD CONSTRAINT marketing_analysis_attempt_provenance_v4_check CHECK(provenance IN('audited-legacy-384','worker-heartbeat-768','worker-heartbeat-768-repair')),
 ADD CONSTRAINT marketing_analysis_attempt_lineage_v4_check CHECK((generation=1 AND parent_failed_job_id IS NULL) OR(generation IN(2,3) AND parent_failed_job_id IS NOT NULL)),
 ADD CONSTRAINT marketing_analysis_attempt_profile_v4_check CHECK(
  (provenance='audited-legacy-384' AND generation=1 AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-384-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',384,'temperature',0,'think',false)) OR
  (provenance='worker-heartbeat-768' AND generation IN(1,2) AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-768-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false)) OR
  (provenance='worker-heartbeat-768-repair' AND generation IN(1,2,3) AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-768-repair-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false))
 );
CREATE OR REPLACE FUNCTION ccpun_admin.admin_enqueue_marketing_analysis(p_id uuid,p_job uuid,p_cipher text,p_nonce text,p_tag text,p_key smallint,p_hash text,p_actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $enqueue$
DECLARE a ccpun_admin.marketing_analysis;j ccpun_admin.local_ai_job;prior ccpun_admin.marketing_analysis_attempt;parent ccpun_admin.marketing_analysis_attempt;r record;
 base_profile jsonb:=jsonb_build_object('version','marketing-qwen17-4096-768-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false);
 repair_profile jsonb:=jsonb_build_object('version','marketing-qwen17-4096-768-repair-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false);
 profile jsonb;expected_failed_job uuid;used integer;remaining smallint:=3;generation smallint:=1;retrying boolean:=false;key_text text;reason_code text;provenance_text text:='worker-heartbeat-768-repair';
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR a.prompt_version<>'marketing-performance-v1' THEN RAISE EXCEPTION 'MARKETING_ANALYSIS_IDENTITY_INVALID';END IF;
 profile:=repair_profile;
 IF a.job_id IS NOT NULL THEN
  SELECT * INTO j FROM ccpun_admin.local_ai_job WHERE job_id=a.job_id FOR UPDATE;
  IF NOT FOUND OR j.task_type<>'marketing-analysis' OR j.data_class<>'public-safe' OR j.request_fingerprint IS DISTINCT FROM a.input_hash THEN RAISE EXCEPTION 'MARKETING_JOB_IDENTITY_INVALID';END IF;
  SELECT * INTO prior FROM ccpun_admin.marketing_analysis_attempt WHERE analysis_id=a.analysis_id AND job_id=j.job_id;
  IF a.validation_status<>'pending' OR j.status<>'failed' OR j.error_category<>'model-output-invalid' OR j.completed_at IS NULL OR j.attempt_count<1 THEN
   RETURN ccpun_admin.admin_marketing_analysis_status(p_id)||jsonb_build_object('reused',true,'retryEligible',false,'inferenceProfile',prior.inference_profile);
  END IF;
  IF prior.generation=1 AND prior.provenance='audited-legacy-384' AND prior.profile_version='marketing-qwen17-4096-384-v1' THEN
   generation:=2;remaining:=3;profile:=repair_profile;provenance_text:='worker-heartbeat-768-repair';reason_code:='marketing-profile-transition-384-repair';
  ELSIF prior.generation=1 AND prior.provenance='worker-heartbeat-768' AND prior.profile_version='marketing-qwen17-4096-768-v1' AND prior.inference_profile=base_profile THEN
   generation:=2;remaining:=3;profile:=repair_profile;provenance_text:='worker-heartbeat-768-repair';reason_code:='marketing-profile-transition-768-repair';
  ELSIF prior.generation=2 AND prior.provenance='worker-heartbeat-768' AND prior.profile_version='marketing-qwen17-4096-768-v1' AND prior.inference_profile=base_profile AND prior.parent_failed_job_id IS NOT NULL THEN
   SELECT * INTO parent FROM ccpun_admin.marketing_analysis_attempt AS t WHERE t.analysis_id=a.analysis_id AND t.job_id=prior.parent_failed_job_id AND t.generation=1;
   IF NOT FOUND OR parent.provenance<>'audited-legacy-384' OR parent.profile_version<>'marketing-qwen17-4096-384-v1' THEN RAISE EXCEPTION 'MARKETING_REPAIR_LINEAGE_INVALID';END IF;
   generation:=3;remaining:=4;profile:=repair_profile;provenance_text:='worker-heartbeat-768-repair';reason_code:='marketing-profile-transition-768-repair';
  ELSE
   RETURN ccpun_admin.admin_marketing_analysis_status(p_id)||jsonb_build_object('reused',true,'retryEligible',false,'inferenceProfile',prior.inference_profile);
  END IF;
  expected_failed_job:=j.job_id;retrying:=true;
  SELECT coalesce(sum(q.attempt_count),0) INTO used FROM ccpun_admin.marketing_analysis_attempt t JOIN ccpun_admin.local_ai_job q USING(job_id) WHERE t.analysis_id=a.analysis_id;
  remaining:=(remaining-used)::smallint;
  IF remaining<1 THEN RETURN ccpun_admin.admin_marketing_analysis_status(p_id)||jsonb_build_object('reused',true,'retryEligible',false,'retryOutcome','attempt-budget-exhausted');END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at>now()-interval '90 seconds' AND h.ollama_ready AND NOT h.accepting_private_jobs AND h.model_name='qwen3:1.7b' AND h.details_json->>'marketingAnalysisVersion'='marketing-performance-v1' AND h.details_json->'marketingInferenceProfile'=profile)
 OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at>now()-interval '90 seconds' AND (h.accepting_private_jobs OR h.model_name<>'qwen3:1.7b' OR h.details_json->'marketingInferenceProfile' IS DISTINCT FROM profile OR h.details_json->>'marketingAnalysisVersion' IS DISTINCT FROM 'marketing-performance-v1')) THEN RAISE EXCEPTION 'MARKETING_WORKER_PROFILE_NOT_READY';END IF;
 key_text:='marketing-analysis:'||p_hash||':'||(profile->>'version');
 IF retrying THEN key_text:=key_text||':retry-of:'||expected_failed_job::text;END IF;
 SELECT * INTO r FROM ccpun_admin.admin_enqueue_local_ai_job_v2(p_job,'marketing-analysis','public-safe',p_cipher,p_nonce,p_tag,p_key,encode(sha256(convert_to(key_text,'UTF8')),'hex'),p_hash,p_actor,'batch');
 IF r.outcome NOT IN('inserted','reused') THEN RETURN jsonb_build_object('analysisId',p_id,'status','prepared','outcome',r.outcome,'reused',false);END IF;
 IF r.reused THEN RAISE EXCEPTION 'MARKETING_RETRY_ORPHAN_JOB';END IF;
 UPDATE ccpun_admin.local_ai_job SET max_attempts=remaining WHERE job_id=r.job_id AND status='queued' AND attempt_count=0;
 IF NOT FOUND THEN RAISE EXCEPTION 'MARKETING_RETRY_CONCURRENT_CLAIM';END IF;
 INSERT INTO ccpun_admin.marketing_analysis_attempt(analysis_id,generation,job_id,parent_failed_job_id,inference_profile,provenance) VALUES(a.analysis_id,generation,r.job_id,expected_failed_job,profile,provenance_text);
 IF retrying THEN INSERT INTO ccpun_admin.local_ai_job_event(event_id,job_id,from_status,to_status,actor_type,reason_code) VALUES(gen_random_uuid(),r.job_id,NULL,'queued','system',reason_code);END IF;
 UPDATE ccpun_admin.marketing_analysis SET job_id=r.job_id WHERE analysis_id=p_id AND job_id IS NOT DISTINCT FROM expected_failed_job AND input_hash=p_hash AND validation_status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'MARKETING_RETRY_LINK_CONFLICT';END IF;
 RETURN jsonb_build_object('analysisId',p_id,'jobId',r.job_id,'status','queued','reused',false,'retried',retrying,'previousFailedJobId',expected_failed_job,'inferenceProfile',profile,'attemptBudgetRemaining',remaining);
END $enqueue$;
REVOKE ALL ON ccpun_admin.marketing_analysis_attempt FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;
-- No new table or function grants. Existing owner-only API path and lineage remain authoritative.
-- checksum-source-end
INSERT INTO ccpun_admin.schema_migration(version,checksum) VALUES('20260928_marketing_ai_repair_retry_v4','sha256:27d012741dd64bbb1d5378ecb4bcd165a9e379b8046342d13019d2dec67290db') ON CONFLICT(version) DO NOTHING;
COMMIT;

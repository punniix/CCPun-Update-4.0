BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN 1 ELSE 0 END AS role_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND database_name='neondb' AND migration_version='20260919_local_ai_control_plane_v1' AND migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6' AND ((lane='uat' AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394') OR (lane='production' AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w'))) THEN 1 ELSE 0 END AS identity_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260927_marketing_local_analysis_v2' AND checksum='sha256:eb0d7a8a1637ccde4bc17d5bc60952da831aec8736123eb42970c467e5306f30') AND EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260920_local_ai_production_operations_v2' AND checksum='sha256:deb9f6761364a61bae275d5226f341ca021087da4116bc3f4703bd8b8c46fb1f') THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260927_marketing_retry_v3'));
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260927_marketing_retry_v3' AND checksum<>'sha256:e150ce6f3fecd22ff312fe5265340eb882b53044c1e6b319f5b6b6aa833a480e') THEN 1 ELSE 0 END AS checksum_guard;
-- checksum-source-begin
CREATE TABLE ccpun_admin.marketing_analysis_attempt (
 analysis_id uuid NOT NULL REFERENCES ccpun_admin.marketing_analysis(analysis_id),
 generation smallint NOT NULL CHECK(generation BETWEEN 1 AND 2),
 job_id uuid NOT NULL UNIQUE REFERENCES ccpun_admin.local_ai_job(job_id),
 parent_failed_job_id uuid,
 inference_profile jsonb NOT NULL,
 profile_version text GENERATED ALWAYS AS(inference_profile->>'version') STORED,
 provenance text NOT NULL CHECK(provenance IN('audited-legacy-384','worker-heartbeat-768')),
 captured_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(analysis_id,generation), UNIQUE(analysis_id,job_id), UNIQUE(analysis_id,profile_version),
 FOREIGN KEY(analysis_id,parent_failed_job_id) REFERENCES ccpun_admin.marketing_analysis_attempt(analysis_id,job_id),
 CHECK((generation=1 AND parent_failed_job_id IS NULL) OR(generation=2 AND parent_failed_job_id IS NOT NULL)),
 CHECK((provenance='audited-legacy-384' AND generation=1 AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-384-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',384,'temperature',0,'think',false)) OR(provenance='worker-heartbeat-768' AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-768-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false)))
);
-- Only these two terminal jobs have deployment + inference metadata proving the old
-- 384-token profile. Absence of a profile is never treated as proof of 384.
INSERT INTO ccpun_admin.marketing_analysis_attempt(analysis_id,generation,job_id,inference_profile,provenance)
SELECT a.analysis_id,1,j.job_id,jsonb_build_object('version','marketing-qwen17-4096-384-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',384,'temperature',0,'think',false),'audited-legacy-384'
FROM ccpun_admin.marketing_analysis a JOIN ccpun_admin.local_ai_job j USING(job_id)
WHERE (a.analysis_id,j.job_id) IN(( '66216fd9-ab31-4b57-8b8b-72e69b0545f3'::uuid,'58b10f57-4a0a-4a7b-86e5-eca29bfedbb1'::uuid),('1c300e00-ca9c-4e62-bfb0-80afdb8e2400'::uuid,'7da8ba96-c12c-4d16-a983-ecf08609e28c'::uuid))
AND a.validation_status='pending' AND a.prompt_version='marketing-performance-v1' AND j.task_type='marketing-analysis' AND j.data_class='public-safe' AND j.status='failed' AND j.error_category='model-output-invalid' AND j.request_fingerprint=a.input_hash AND j.completed_at<'2026-09-27T16:29:00Z'::timestamptz;
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND lane='production') OR(SELECT count(*) FROM ccpun_admin.marketing_analysis_attempt WHERE provenance='audited-legacy-384')=2 THEN 1 ELSE 0 END AS legacy_profile_proof_guard;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_enqueue_marketing_analysis(p_id uuid,p_job uuid,p_cipher text,p_nonce text,p_tag text,p_key smallint,p_hash text,p_actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $enqueue$
DECLARE a ccpun_admin.marketing_analysis;j ccpun_admin.local_ai_job;prior ccpun_admin.marketing_analysis_attempt;r record;
 profile jsonb:=jsonb_build_object('version','marketing-qwen17-4096-768-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false);
 expected_failed_job uuid;used integer;remaining smallint:=3;generation smallint:=1;retrying boolean:=false;key_text text;
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR a.prompt_version<>'marketing-performance-v1' THEN RAISE EXCEPTION 'MARKETING_ANALYSIS_IDENTITY_INVALID';END IF;
 IF a.job_id IS NOT NULL THEN
  SELECT * INTO j FROM ccpun_admin.local_ai_job WHERE job_id=a.job_id FOR UPDATE;
  IF NOT FOUND OR j.task_type<>'marketing-analysis' OR j.data_class<>'public-safe' OR j.request_fingerprint<>a.input_hash THEN RAISE EXCEPTION 'MARKETING_JOB_IDENTITY_INVALID';END IF;
  SELECT * INTO prior FROM ccpun_admin.marketing_analysis_attempt WHERE analysis_id=a.analysis_id AND job_id=j.job_id;
  IF a.validation_status<>'pending' OR j.status<>'failed' OR j.error_category<>'model-output-invalid' OR prior.provenance IS DISTINCT FROM 'audited-legacy-384' OR prior.profile_version IS DISTINCT FROM 'marketing-qwen17-4096-384-v1' THEN
   RETURN ccpun_admin.admin_marketing_analysis_status(p_id)||jsonb_build_object('reused',true,'retryEligible',false,'inferenceProfile',prior.inference_profile);
  END IF;
  -- Expected parent is read/locked server-side, not supplied by a caller wishing
  -- to bypass idempotency. All changes below remain in this same transaction.
  expected_failed_job:=j.job_id;retrying:=true;generation:=2;
  SELECT coalesce(sum(q.attempt_count),0) INTO used FROM ccpun_admin.marketing_analysis_attempt t JOIN ccpun_admin.local_ai_job q USING(job_id) WHERE t.analysis_id=a.analysis_id;
  remaining:=(3-used)::smallint;
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
 INSERT INTO ccpun_admin.marketing_analysis_attempt(analysis_id,generation,job_id,parent_failed_job_id,inference_profile,provenance) VALUES(a.analysis_id,generation,r.job_id,expected_failed_job,profile,'worker-heartbeat-768');
 IF retrying THEN INSERT INTO ccpun_admin.local_ai_job_event(event_id,job_id,from_status,to_status,actor_type,reason_code) VALUES(gen_random_uuid(),r.job_id,NULL,'queued','system','marketing-profile-transition-384-768');END IF;
 UPDATE ccpun_admin.marketing_analysis SET job_id=r.job_id WHERE analysis_id=p_id AND job_id IS NOT DISTINCT FROM expected_failed_job AND input_hash=p_hash AND validation_status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'MARKETING_RETRY_LINK_CONFLICT';END IF;
 RETURN jsonb_build_object('analysisId',p_id,'jobId',r.job_id,'status','queued','reused',false,'retried',retrying,'previousFailedJobId',expected_failed_job,'inferenceProfile',profile,'attemptBudgetRemaining',remaining);
END $enqueue$;
CREATE OR REPLACE FUNCTION ccpun_admin.marketing_analysis_json(a ccpun_admin.marketing_analysis) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,ccpun_admin AS $shape$
SELECT jsonb_build_object('analysisId',a.analysis_id,'jobId',a.job_id,'status',CASE WHEN a.validation_status='validated' AND a.period_end<(ccpun_admin.marketing_window(a.window_key,least((now() AT TIME ZONE 'America/Los_Angeles')::date-3,(now() AT TIME ZONE 'Asia/Bangkok')::date-1))->>'currentEnd')::date THEN 'stale' WHEN a.validation_status='validated' THEN 'ready' WHEN j.status='leased' THEN 'running' WHEN a.validation_status='rejected' OR j.status IN('failed','cancelled','expired','reconciliation-required') THEN 'failed' WHEN a.job_id IS NULL THEN 'prepared' ELSE 'queued' END,'promptVersion',a.prompt_version,'analysisType',a.analysis_type,'period',a.input_json->'period','createdAt',a.created_at,'completedAt',a.validated_at,'modelName',j.model_name,'inputHash',a.input_hash,'sourceManifest',a.source_manifest,'inferenceProfile',(SELECT t.inference_profile FROM ccpun_admin.marketing_analysis_attempt t WHERE t.job_id=a.job_id),'attempts',(SELECT coalesce(jsonb_agg(jsonb_build_object('generation',t.generation,'jobId',t.job_id,'parentFailedJobId',t.parent_failed_job_id,'inferenceProfile',t.inference_profile,'provenance',t.provenance,'attemptCount',q.attempt_count,'maxAttempts',q.max_attempts,'status',q.status,'errorCategory',q.error_category,'capturedAt',t.captured_at) ORDER BY t.generation),'[]') FROM ccpun_admin.marketing_analysis_attempt t JOIN ccpun_admin.local_ai_job q USING(job_id) WHERE t.analysis_id=a.analysis_id),'output',CASE WHEN a.validation_status='validated' AND j.review_status IN('pending','approved') THEN a.output_json END) FROM(SELECT 1) x LEFT JOIN ccpun_admin.local_ai_job j ON j.job_id=a.job_id $shape$;
REVOKE ALL ON ccpun_admin.marketing_analysis_attempt FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;
-- Existing API/function grants remain unchanged; no generic retry or private permission.
-- checksum-source-end
INSERT INTO ccpun_admin.schema_migration(version,checksum) VALUES('20260927_marketing_retry_v3','sha256:e150ce6f3fecd22ff312fe5265340eb882b53044c1e6b319f5b6b6aa833a480e') ON CONFLICT(version) DO NOTHING;
COMMIT;

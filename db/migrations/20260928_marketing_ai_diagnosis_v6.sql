BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN 1 ELSE 0 END AS role_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND database_name='neondb' AND migration_version='20260919_local_ai_control_plane_v1' AND migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6' AND ((lane='uat' AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394') OR (lane='production' AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w'))) THEN 1 ELSE 0 END AS identity_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_ai_candidates_v5' AND checksum='sha256:44eb2289295711409d4b28b97de58112c36b4d63b070cf6ada147c040a747f8b') THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260928_marketing_ai_diagnosis_v6'));
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_ai_diagnosis_v6' AND checksum<>'sha256:899f1b9ca8cda959ecbf5c76bf7905d0084075f0b7bac6dba323a61a82f81ddf') THEN 1 ELSE 0 END AS checksum_guard;
-- checksum-source-begin
ALTER TABLE ccpun_admin.marketing_analysis DROP CONSTRAINT marketing_analysis_prompt_version_v5_check;
ALTER TABLE ccpun_admin.marketing_analysis ADD CONSTRAINT marketing_analysis_prompt_version_v6_check CHECK(prompt_version IN('marketing-performance-v1','marketing-performance-v2','marketing-performance-v3'));
ALTER TABLE ccpun_admin.marketing_cloud_attempt DROP CONSTRAINT marketing_cloud_attempt_prompt_version_v5_check, DROP CONSTRAINT marketing_cloud_attempt_cloud_prompt_version_v5_check;
ALTER TABLE ccpun_admin.marketing_cloud_attempt ADD CONSTRAINT marketing_cloud_attempt_prompt_version_v6_check CHECK(prompt_version IN('marketing-performance-v1','marketing-performance-v2','marketing-performance-v3')),
 ADD CONSTRAINT marketing_cloud_attempt_cloud_prompt_version_v6_check CHECK(cloud_prompt_version IN('marketing-performance-cloud-v1','marketing-performance-cloud-v2','marketing-performance-cloud-v3','marketing-performance-review-v1'));
ALTER TABLE ccpun_admin.marketing_cloud_attempt ADD COLUMN mode text NOT NULL DEFAULT 'fallback' CHECK(mode IN('fallback','review')),
 ADD COLUMN local_output_digest text CHECK(local_output_digest IS NULL OR local_output_digest~'^[a-f0-9]{64}$'),
 ADD CONSTRAINT marketing_cloud_review_binding_v6_check CHECK((mode='fallback' AND local_output_digest IS NULL) OR (mode='review' AND local_output_digest IS NOT NULL AND prompt_version='marketing-performance-v3' AND cloud_prompt_version='marketing-performance-review-v1'));
ALTER TABLE ccpun_admin.marketing_analysis_attempt DROP CONSTRAINT marketing_analysis_attempt_provenance_v5_check, DROP CONSTRAINT marketing_analysis_attempt_profile_v5_check;
ALTER TABLE ccpun_admin.marketing_analysis_attempt ADD CONSTRAINT marketing_analysis_attempt_provenance_v6_check CHECK(provenance IN('audited-legacy-384','worker-heartbeat-768','worker-heartbeat-768-repair','worker-heartbeat-ids-v2','worker-heartbeat-diagnosis-v3')),
 ADD CONSTRAINT marketing_analysis_attempt_profile_v6_check CHECK(
 (provenance='audited-legacy-384' AND generation=1 AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-384-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',384,'temperature',0,'think',false)) OR
 (provenance='worker-heartbeat-768' AND generation IN(1,2) AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-768-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false)) OR
 (provenance='worker-heartbeat-768-repair' AND generation IN(1,2,3) AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-768-repair-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false)) OR
 (provenance='worker-heartbeat-ids-v2' AND generation=1 AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-768-ids-v2','model','qwen3:1.7b','promptVersion','marketing-performance-v2','numCtx',4096,'numPredict',768,'temperature',0,'think',false)) OR
 (provenance='worker-heartbeat-diagnosis-v3' AND generation=1 AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-768-diagnosis-v3','model','qwen3:1.7b','promptVersion','marketing-performance-v3','numCtx',4096,'numPredict',768,'temperature',0,'think',false)));
CREATE OR REPLACE FUNCTION ccpun_admin.admin_prepare_marketing_analysis(p_id uuid,p_input jsonb,p_hash text,p_manifest jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $prepare$
DECLARE a ccpun_admin.marketing_analysis; BEGIN
 IF p_hash!~'^[a-f0-9]{64}$' OR p_input->>'promptVersion' NOT IN('marketing-performance-v1','marketing-performance-v2','marketing-performance-v3') OR jsonb_typeof(p_input->'evidence')<>'array' OR jsonb_array_length(p_input->'evidence') NOT BETWEEN 1 AND 16 OR (p_input->>'promptVersion' IN('marketing-performance-v2','marketing-performance-v3') AND (jsonb_typeof(p_input->'candidates')<>'array' OR jsonb_array_length(p_input->'candidates')>8)) OR octet_length(p_input::text)>24000 OR jsonb_typeof(p_manifest)<>'array' OR octet_length(p_manifest::text)>4000000 THEN RAISE EXCEPTION 'MARKETING_INPUT_INVALID'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('marketing-prepare:'||p_hash));SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE input_hash=p_hash;
 IF FOUND THEN RETURN jsonb_build_object('analysisId',a.analysis_id,'inputHash',a.input_hash,'status','prepared','reused',true,'coverage',a.input_json->'coverage'); END IF;
 INSERT INTO ccpun_admin.marketing_analysis(analysis_id,input_hash,input_json,source_manifest,prompt_version,window_key,analysis_type,period_start,period_end) VALUES(p_id,p_hash,p_input,p_manifest,p_input->>'promptVersion',p_input#>>'{period,key}',p_input->>'analysisType',(p_input#>>'{period,currentStart}')::date,(p_input#>>'{period,currentEnd}')::date);
 RETURN jsonb_build_object('analysisId',p_id,'inputHash',p_hash,'status','prepared','reused',false,'coverage',p_input->'coverage');END $prepare$;
CREATE FUNCTION ccpun_admin.admin_enqueue_marketing_analysis_v3(p_id uuid,p_job uuid,p_cipher text,p_nonce text,p_tag text,p_key smallint,p_hash text,p_actor text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $enqueue_v2$
DECLARE a ccpun_admin.marketing_analysis;r record;profile jsonb:=jsonb_build_object('version','marketing-qwen17-4096-768-diagnosis-v3','model','qwen3:1.7b','promptVersion','marketing-performance-v3','numCtx',4096,'numPredict',768,'temperature',0,'think',false);
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR a.prompt_version<>'marketing-performance-v3' OR a.validation_status<>'pending' THEN RAISE EXCEPTION 'MARKETING_ANALYSIS_IDENTITY_INVALID';END IF;
 IF a.job_id IS NOT NULL THEN RETURN ccpun_admin.admin_marketing_analysis_status(p_id)||jsonb_build_object('reused',true,'retryEligible',false);END IF;
 IF NOT EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at>now()-interval '90 seconds' AND h.ollama_ready AND NOT h.accepting_private_jobs AND h.model_name='qwen3:1.7b' AND h.details_json->>'marketingAnalysisVersion'='marketing-performance-v3' AND h.details_json->'marketingInferenceProfile'=profile)
 OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at>now()-interval '90 seconds' AND (h.accepting_private_jobs OR h.model_name<>'qwen3:1.7b' OR h.details_json->'marketingInferenceProfile' IS DISTINCT FROM profile OR h.details_json->>'marketingAnalysisVersion' IS DISTINCT FROM 'marketing-performance-v3')) THEN RAISE EXCEPTION 'MARKETING_WORKER_PROFILE_NOT_READY';END IF;
 SELECT * INTO r FROM ccpun_admin.admin_enqueue_local_ai_job_v2(p_job,'marketing-analysis','public-safe',p_cipher,p_nonce,p_tag,p_key,encode(sha256(convert_to('marketing-analysis:'||p_hash||':diagnosis-v3','UTF8')),'hex'),p_hash,p_actor,'batch');
 IF r.outcome NOT IN('inserted','reused') THEN RETURN jsonb_build_object('analysisId',p_id,'status','prepared','outcome',r.outcome,'reused',false);END IF;
 IF r.reused THEN RAISE EXCEPTION 'MARKETING_V3_ORPHAN_JOB';END IF;
 UPDATE ccpun_admin.local_ai_job SET max_attempts=1 WHERE job_id=r.job_id AND status='queued' AND attempt_count=0;
 IF NOT FOUND THEN RAISE EXCEPTION 'MARKETING_V3_CONCURRENT_CLAIM';END IF;
 INSERT INTO ccpun_admin.marketing_analysis_attempt(analysis_id,generation,job_id,inference_profile,provenance) VALUES(a.analysis_id,1,r.job_id,profile,'worker-heartbeat-diagnosis-v3');
 UPDATE ccpun_admin.marketing_analysis SET job_id=r.job_id WHERE analysis_id=p_id AND job_id IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'MARKETING_V3_LINK_CONFLICT';END IF;
 RETURN jsonb_build_object('analysisId',p_id,'jobId',r.job_id,'status','queued','reused',false,'inferenceProfile',profile,'attemptBudgetRemaining',1);
END $enqueue_v2$;
CREATE FUNCTION ccpun_admin.admin_reserve_marketing_cloud_v4(p_id uuid,p_hash text,p_reservation uuid,p_prompt_version text,p_prompt_digest text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $reserve_v3$
DECLARE a ccpun_admin.marketing_analysis;j ccpun_admin.local_ai_job;c ccpun_admin.marketing_cloud_attempt;t ccpun_admin.marketing_analysis_attempt;
BEGIN
 IF p_prompt_version<>'marketing-performance-cloud-v3' OR p_prompt_digest IS NULL OR p_prompt_digest!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'MARKETING_CLOUD_PROMPT_INVALID';END IF;
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR a.prompt_version<>'marketing-performance-v3' OR a.validation_status='validated' THEN RAISE EXCEPTION 'MARKETING_CLOUD_IDENTITY_INVALID';END IF;
 -- Cloud is reserved only for a supplied high-priority candidate with complete, adequate, current evidence.
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.input_json->'candidates') candidate WHERE candidate->>'priority'='high' AND jsonb_array_length(candidate->'evidenceIds')>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(candidate->'evidenceIds') ref WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.input_json->'evidence') fact WHERE fact->>'id'=ref.value AND fact->>'sampleStatus'='sufficient' AND fact->>'coverageStatus'='complete' AND fact->>'freshnessStatus' IN('fresh','expected_lag')))) THEN RAISE EXCEPTION 'MARKETING_CLOUD_NOT_NEEDED';END IF;
 SELECT * INTO c FROM ccpun_admin.marketing_cloud_attempt WHERE analysis_id=p_id;
 IF FOUND THEN RETURN jsonb_build_object('analysisId',p_id,'status',c.status,'reused',true);END IF;
 IF a.job_id IS NULL THEN
  IF a.created_at>now()-interval '10 minutes' OR NOT EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at<now()-interval '10 minutes') OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at>now()-interval '90 seconds' AND h.ollama_ready AND h.details_json->>'marketingAnalysisVersion'='marketing-performance-v3') THEN RAISE EXCEPTION 'MARKETING_LOCAL_NOT_TERMINAL';END IF;
 ELSE
  SELECT * INTO j FROM ccpun_admin.local_ai_job WHERE job_id=a.job_id FOR UPDATE;
  SELECT * INTO t FROM ccpun_admin.marketing_analysis_attempt WHERE analysis_id=p_id AND job_id=a.job_id;
  IF j.job_id IS NULL OR j.task_type<>'marketing-analysis' OR j.data_class<>'public-safe' OR j.request_fingerprint IS DISTINCT FROM a.input_hash OR t.profile_version IS DISTINCT FROM 'marketing-qwen17-4096-768-diagnosis-v3' OR j.status NOT IN('failed','cancelled','expired','reconciliation-required') OR j.completed_at IS NULL THEN RAISE EXCEPTION 'MARKETING_LOCAL_NOT_TERMINAL';END IF;
 END IF;
 INSERT INTO ccpun_admin.marketing_cloud_attempt(analysis_id,input_hash,reservation_id,prompt_version,cloud_prompt_version,cloud_prompt_digest) VALUES(p_id,p_hash,p_reservation,'marketing-performance-v3',p_prompt_version,p_prompt_digest);
 RETURN jsonb_build_object('analysisId',p_id,'reservationId',p_reservation,'status','reserved','reused',false,'cloudPromptVersion',p_prompt_version,'cloudPromptDigest',p_prompt_digest);
END $reserve_v3$;
CREATE FUNCTION ccpun_admin.marketing_v3_review_eligible(a ccpun_admin.marketing_analysis) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,ccpun_admin AS $eligible$
 SELECT a.prompt_version='marketing-performance-v3' AND a.validation_status='validated' AND EXISTS(
  SELECT 1 FROM jsonb_array_elements(coalesce(a.output_json->'opportunities','[]'::jsonb)||coalesce(a.output_json->'watchItems','[]'::jsonb)) finding
  WHERE jsonb_array_length(finding->'evidence')>0 AND NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(finding->'evidence') fact
   WHERE fact->>'sampleStatus'<>'sufficient' OR fact->>'coverageStatus'<>'complete' OR fact->>'freshnessStatus' NOT IN('fresh','expected_lag')
  )
 );
$eligible$;
CREATE FUNCTION ccpun_admin.admin_reserve_marketing_cloud_review_v1(p_id uuid,p_hash text,p_reservation uuid,p_prompt_version text,p_prompt_digest text,p_local_digest text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $reserve_review$
DECLARE a ccpun_admin.marketing_analysis;j ccpun_admin.local_ai_job;c ccpun_admin.marketing_cloud_attempt;
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 SELECT * INTO j FROM ccpun_admin.local_ai_job WHERE job_id=a.job_id;
 IF a.analysis_id IS NULL OR j.job_id IS NULL OR a.prompt_version<>'marketing-performance-v3' OR a.validation_status<>'validated' OR j.status<>'succeeded' OR j.output_digest IS DISTINCT FROM a.output_digest OR p_local_digest IS DISTINCT FROM a.output_digest OR p_local_digest IS NULL OR p_local_digest!~'^[a-f0-9]{64}$' OR p_prompt_version<>'marketing-performance-review-v1' OR p_prompt_digest IS NULL OR p_prompt_digest!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'MARKETING_REVIEW_IDENTITY_INVALID';END IF;
 IF NOT ccpun_admin.marketing_v3_review_eligible(a) THEN RETURN jsonb_build_object('analysisId',p_id,'status','not-needed','mode','review','reused',false);END IF;
 SELECT * INTO c FROM ccpun_admin.marketing_cloud_attempt WHERE analysis_id=p_id;
 IF FOUND THEN RETURN jsonb_build_object('analysisId',p_id,'status',c.status,'mode',c.mode,'reused',true);END IF;
 INSERT INTO ccpun_admin.marketing_cloud_attempt(analysis_id,input_hash,reservation_id,prompt_version,cloud_prompt_version,cloud_prompt_digest,mode,local_output_digest)
 VALUES(p_id,p_hash,p_reservation,'marketing-performance-v3',p_prompt_version,p_prompt_digest,'review',p_local_digest);
 RETURN jsonb_build_object('analysisId',p_id,'inputHash',p_hash,'reservationId',p_reservation,'localOutputDigest',p_local_digest,'status','reserved','mode','review','reused',false);
END $reserve_review$;
CREATE FUNCTION ccpun_admin.admin_complete_marketing_cloud_review_v1(p_id uuid,p_hash text,p_reservation uuid,p_local_digest text,p_verdict jsonb,p_digest text,p_input_tokens integer,p_output_tokens integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $complete_review$
DECLARE a ccpun_admin.marketing_analysis;c ccpun_admin.marketing_cloud_attempt;approved boolean;
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 SELECT * INTO c FROM ccpun_admin.marketing_cloud_attempt WHERE analysis_id=p_id AND input_hash=p_hash AND reservation_id=p_reservation FOR UPDATE;
 IF c.status='ready' AND c.mode='review' AND c.local_output_digest=p_local_digest AND c.output_digest=p_digest THEN RETURN jsonb_build_object('analysisId',p_id,'status',CASE WHEN c.output_json->>'approved'='true' THEN 'ready' ELSE 'failed' END,'reused',true);END IF;
 IF a.analysis_id IS NULL OR c.analysis_id IS NULL OR c.mode<>'review' OR c.status<>'reserved' OR a.validation_status<>'validated' OR c.local_output_digest IS DISTINCT FROM a.output_digest OR p_local_digest IS DISTINCT FROM a.output_digest OR p_digest!~'^[a-f0-9]{64}$' OR p_input_tokens NOT BETWEEN 0 AND 100000 OR p_output_tokens NOT BETWEEN 0 AND 100000 OR jsonb_typeof(p_verdict)<>'object' OR jsonb_typeof(p_verdict->'approved')<>'boolean' OR p_verdict->>'reasonCode' NOT IN('supported','unsupported_evidence','overclaim','insufficient_context') OR p_verdict - 'approved' - 'reasonCode'<>'{}'::jsonb THEN RAISE EXCEPTION 'MARKETING_REVIEW_CONCURRENT_CHANGE';END IF;
 approved:=(p_verdict->>'approved')::boolean;
 IF approved IS DISTINCT FROM (p_verdict->>'reasonCode'='supported') THEN RAISE EXCEPTION 'MARKETING_REVIEW_VERDICT_INVALID';END IF;
 UPDATE ccpun_admin.marketing_cloud_attempt SET status='ready',completed_at=now(),output_json=p_verdict,output_digest=p_digest,input_tokens=p_input_tokens,output_tokens=p_output_tokens WHERE analysis_id=p_id;
 RETURN jsonb_build_object('analysisId',p_id,'status',CASE WHEN approved THEN 'ready' ELSE 'failed' END,'reviewApproved',approved,'reused',false);
END $complete_review$;
CREATE FUNCTION ccpun_admin.admin_fail_marketing_cloud_review_v1(p_id uuid,p_hash text,p_reservation uuid,p_local_digest text,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $fail_review$
DECLARE a ccpun_admin.marketing_analysis;c ccpun_admin.marketing_cloud_attempt;
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 SELECT * INTO c FROM ccpun_admin.marketing_cloud_attempt WHERE analysis_id=p_id AND input_hash=p_hash AND reservation_id=p_reservation FOR UPDATE;
 IF a.analysis_id IS NULL OR c.analysis_id IS NULL OR c.mode<>'review' OR c.local_output_digest IS DISTINCT FROM p_local_digest OR a.output_digest IS DISTINCT FROM p_local_digest OR c.status='ready' OR p_reason NOT IN('api-error','model-output-invalid','timeout','workflow-error') THEN RAISE EXCEPTION 'MARKETING_REVIEW_CONCURRENT_CHANGE';END IF;
 IF c.status='reserved' THEN UPDATE ccpun_admin.marketing_cloud_attempt SET status='failed',completed_at=now(),failure_code=p_reason WHERE analysis_id=p_id;END IF;
 RETURN jsonb_build_object('analysisId',p_id,'status','failed','reason',p_reason);
END $fail_review$;
-- The existing fallback completion endpoint must never be able to complete a review reservation.
CREATE OR REPLACE FUNCTION ccpun_admin.admin_complete_marketing_cloud(p_id uuid,p_hash text,p_reservation uuid,p_output jsonb,p_digest text,p_input_tokens integer,p_output_tokens integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $complete$
DECLARE a ccpun_admin.marketing_analysis;c ccpun_admin.marketing_cloud_attempt;
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 SELECT * INTO c FROM ccpun_admin.marketing_cloud_attempt WHERE analysis_id=p_id AND input_hash=p_hash AND reservation_id=p_reservation FOR UPDATE;
 IF c.mode IS DISTINCT FROM 'fallback' THEN RAISE EXCEPTION 'MARKETING_CLOUD_MODE_INVALID';END IF;
 IF c.status='ready' AND c.output_digest=p_digest AND a.validation_status='validated' THEN RETURN jsonb_build_object('analysisId',p_id,'status','ready','provider','openai','model','gpt-6-luna','validated',true,'reused',true);END IF;
 IF c.analysis_id IS NULL OR a.analysis_id IS NULL OR c.status<>'reserved' OR a.validation_status='validated' OR p_digest IS NULL OR p_digest!~'^[a-f0-9]{64}$' OR p_input_tokens NOT BETWEEN 0 AND 100000 OR p_output_tokens NOT BETWEEN 0 AND 100000 OR p_output->>'promptVersion' IS DISTINCT FROM a.prompt_version OR p_output->>'snapshotHash' IS DISTINCT FROM a.input_json->>'snapshotHash' OR p_output->>'sourceManifestHash' IS DISTINCT FROM a.input_json->>'sourceManifestHash' THEN RAISE EXCEPTION 'MARKETING_CLOUD_CONCURRENT_CHANGE';END IF;
 UPDATE ccpun_admin.marketing_cloud_attempt SET status='ready',completed_at=now(),output_json=p_output,output_digest=p_digest,input_tokens=p_input_tokens,output_tokens=p_output_tokens WHERE analysis_id=p_id;
 UPDATE ccpun_admin.marketing_analysis SET validation_status='validated',output_json=p_output,output_digest=p_digest,validated_at=now() WHERE analysis_id=p_id;
 RETURN jsonb_build_object('analysisId',p_id,'status','ready','provider','openai','model','gpt-6-luna','validated',true);
END $complete$;
CREATE OR REPLACE FUNCTION ccpun_admin.admin_fail_marketing_cloud(p_id uuid,p_hash text,p_reservation uuid,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $fail$
DECLARE a ccpun_admin.marketing_analysis;c ccpun_admin.marketing_cloud_attempt;
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 SELECT * INTO c FROM ccpun_admin.marketing_cloud_attempt WHERE analysis_id=p_id AND input_hash=p_hash AND reservation_id=p_reservation FOR UPDATE;
 IF a.analysis_id IS NULL OR c.analysis_id IS NULL OR c.mode IS DISTINCT FROM 'fallback' OR c.status='ready' OR p_reason NOT IN('api-error','model-output-invalid','timeout','workflow-error') THEN RAISE EXCEPTION 'MARKETING_CLOUD_CONCURRENT_CHANGE';END IF;
 IF c.status='reserved' THEN UPDATE ccpun_admin.marketing_cloud_attempt SET status='failed',completed_at=now(),failure_code=p_reason WHERE analysis_id=p_id;END IF;
 RETURN jsonb_build_object('analysisId',p_id,'status','failed','reason',p_reason);
END $fail$;
CREATE FUNCTION ccpun_admin.marketing_analysis_json_with_review(a ccpun_admin.marketing_analysis) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,ccpun_admin AS $shape_review$
 SELECT CASE WHEN a.prompt_version<>'marketing-performance-v3' THEN ccpun_admin.marketing_analysis_json(a) ELSE
 ccpun_admin.marketing_analysis_json(a)||jsonb_build_object(
  'status',CASE
   WHEN c.mode='review' AND c.status='ready' AND c.output_json->>'approved'='true' THEN CASE WHEN a.period_end<(ccpun_admin.marketing_window(a.window_key,least((now() AT TIME ZONE 'America/Los_Angeles')::date-3,(now() AT TIME ZONE 'Asia/Bangkok')::date-1))->>'currentEnd')::date THEN 'stale' ELSE 'ready' END
   WHEN c.mode='fallback' AND c.status='ready' THEN CASE WHEN a.period_end<(ccpun_admin.marketing_window(a.window_key,least((now() AT TIME ZONE 'America/Los_Angeles')::date-3,(now() AT TIME ZONE 'Asia/Bangkok')::date-1))->>'currentEnd')::date THEN 'stale' ELSE 'ready' END
   WHEN c.status='reserved' THEN 'running'
   WHEN c.status='failed' OR (c.mode='review' AND c.status='ready') THEN 'failed'
   WHEN a.validation_status='validated' AND NOT ccpun_admin.marketing_v3_review_eligible(a) THEN 'review_not_needed'
   WHEN a.validation_status='validated' THEN 'review_required'
   ELSE ccpun_admin.marketing_analysis_json(a)->>'status' END,
  'output',CASE WHEN c.status='ready' AND (c.mode='fallback' OR (c.mode='review' AND c.output_json->>'approved'='true')) THEN a.output_json ELSE NULL END,
  'modelName',CASE WHEN c.mode='fallback' AND c.status='ready' THEN c.model ELSE j.model_name END,
  'inferenceProvider',CASE WHEN c.mode='fallback' AND c.status='ready' THEN 'openai' WHEN j.job_id IS NOT NULL THEN 'local' ELSE NULL END,
  'cloudUsage',CASE WHEN c.status='ready' THEN jsonb_build_object('inputTokens',c.input_tokens,'outputTokens',c.output_tokens) ELSE NULL END,
  'reviewStatus',CASE WHEN c.mode='review' THEN c.status ELSE NULL END
 ) END
 FROM (SELECT 1) x LEFT JOIN ccpun_admin.local_ai_job j ON j.job_id=a.job_id LEFT JOIN ccpun_admin.marketing_cloud_attempt c ON c.analysis_id=a.analysis_id;
$shape_review$;
CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_marketing_analysis(p_window text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $read_review$
 SELECT jsonb_build_object(
  'latest',(SELECT ccpun_admin.marketing_analysis_json_with_review(a) FROM ccpun_admin.marketing_analysis a WHERE a.window_key=p_window ORDER BY a.created_at DESC LIMIT 1),
  'lastGood',(SELECT ccpun_admin.marketing_analysis_json_with_review(a) FROM ccpun_admin.marketing_analysis a LEFT JOIN ccpun_admin.local_ai_job j USING(job_id) LEFT JOIN ccpun_admin.marketing_cloud_attempt c ON c.analysis_id=a.analysis_id
   WHERE a.window_key=p_window AND a.validation_status='validated' AND ((a.prompt_version<>'marketing-performance-v3' AND (c.status='ready' OR j.review_status IN('pending','approved'))) OR (a.prompt_version='marketing-performance-v3' AND c.status='ready' AND (c.mode='fallback' OR (c.mode='review' AND c.output_json->>'approved'='true')))) ORDER BY a.validated_at DESC LIMIT 1)
 );
$read_review$;
CREATE OR REPLACE FUNCTION ccpun_admin.admin_marketing_analysis_status(p_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $status_review$
 SELECT jsonb_build_object('analysisId',a.analysis_id,'jobId',a.job_id,'status',ccpun_admin.marketing_analysis_json_with_review(a)->>'status','workerSucceeded',coalesce(j.status='succeeded',false),'cloudStatus',c.status,'reviewRequired',a.prompt_version='marketing-performance-v3' AND ccpun_admin.marketing_v3_review_eligible(a) AND c.analysis_id IS NULL)
 FROM ccpun_admin.marketing_analysis a LEFT JOIN ccpun_admin.local_ai_job j USING(job_id) LEFT JOIN ccpun_admin.marketing_cloud_attempt c ON c.analysis_id=a.analysis_id WHERE a.analysis_id=p_id;
$status_review$;
REVOKE ALL ON FUNCTION ccpun_admin.marketing_v3_review_eligible(ccpun_admin.marketing_analysis),ccpun_admin.marketing_analysis_json_with_review(ccpun_admin.marketing_analysis),ccpun_admin.admin_enqueue_marketing_analysis_v3(uuid,uuid,text,text,text,smallint,text,text),ccpun_admin.admin_reserve_marketing_cloud_v4(uuid,text,uuid,text,text),ccpun_admin.admin_reserve_marketing_cloud_review_v1(uuid,text,uuid,text,text,text),ccpun_admin.admin_complete_marketing_cloud_review_v1(uuid,text,uuid,text,jsonb,text,integer,integer),ccpun_admin.admin_fail_marketing_cloud_review_v1(uuid,text,uuid,text,text) FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_enqueue_marketing_analysis_v3(uuid,uuid,text,text,text,smallint,text,text),ccpun_admin.admin_reserve_marketing_cloud_v4(uuid,text,uuid,text,text),ccpun_admin.admin_reserve_marketing_cloud_review_v1(uuid,text,uuid,text,text,text),ccpun_admin.admin_complete_marketing_cloud_review_v1(uuid,text,uuid,text,jsonb,text,integer,integer),ccpun_admin.admin_fail_marketing_cloud_review_v1(uuid,text,uuid,text,text) TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO ccpun_admin.schema_migration(version,checksum) VALUES('20260928_marketing_ai_diagnosis_v6','sha256:899f1b9ca8cda959ecbf5c76bf7905d0084075f0b7bac6dba323a61a82f81ddf') ON CONFLICT(version) DO NOTHING;
COMMIT;

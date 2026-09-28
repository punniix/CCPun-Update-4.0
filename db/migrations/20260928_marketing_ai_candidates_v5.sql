BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN 1 ELSE 0 END AS role_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND database_name='neondb' AND migration_version='20260919_local_ai_control_plane_v1' AND migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6' AND ((lane='uat' AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394') OR (lane='production' AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w'))) THEN 1 ELSE 0 END AS identity_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_cloud_timeout_v3' AND checksum='sha256:d37f6baf16ef77b21c05a664d77dd6cd7427b74de60d1cf7557ee581da6ff5f0') AND EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_ai_repair_retry_v4' AND checksum='sha256:27d012741dd64bbb1d5378ecb4bcd165a9e379b8046342d13019d2dec67290db') THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260928_marketing_ai_candidates_v5'));
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_ai_candidates_v5' AND checksum<>'sha256:44eb2289295711409d4b28b97de58112c36b4d63b070cf6ada147c040a747f8b') THEN 1 ELSE 0 END AS checksum_guard;
-- checksum-source-begin
ALTER TABLE ccpun_admin.marketing_analysis DROP CONSTRAINT marketing_analysis_prompt_version_check;
ALTER TABLE ccpun_admin.marketing_analysis ADD CONSTRAINT marketing_analysis_prompt_version_v5_check CHECK(prompt_version IN('marketing-performance-v1','marketing-performance-v2'));
ALTER TABLE ccpun_admin.marketing_cloud_attempt DROP CONSTRAINT marketing_cloud_attempt_prompt_version_check, DROP CONSTRAINT marketing_cloud_attempt_cloud_prompt_version_check;
ALTER TABLE ccpun_admin.marketing_cloud_attempt ADD CONSTRAINT marketing_cloud_attempt_prompt_version_v5_check CHECK(prompt_version IN('marketing-performance-v1','marketing-performance-v2')), ADD CONSTRAINT marketing_cloud_attempt_cloud_prompt_version_v5_check CHECK(cloud_prompt_version IN('marketing-performance-cloud-v1','marketing-performance-cloud-v2'));
ALTER TABLE ccpun_admin.marketing_analysis_attempt DROP CONSTRAINT marketing_analysis_attempt_provenance_v4_check, DROP CONSTRAINT marketing_analysis_attempt_profile_v4_check;
ALTER TABLE ccpun_admin.marketing_analysis_attempt ADD CONSTRAINT marketing_analysis_attempt_provenance_v5_check CHECK(provenance IN('audited-legacy-384','worker-heartbeat-768','worker-heartbeat-768-repair','worker-heartbeat-ids-v2')),
 ADD CONSTRAINT marketing_analysis_attempt_profile_v5_check CHECK(
 (provenance='audited-legacy-384' AND generation=1 AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-384-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',384,'temperature',0,'think',false)) OR
 (provenance='worker-heartbeat-768' AND generation IN(1,2) AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-768-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false)) OR
 (provenance='worker-heartbeat-768-repair' AND generation IN(1,2,3) AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-768-repair-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false)) OR
 (provenance='worker-heartbeat-ids-v2' AND generation=1 AND inference_profile=jsonb_build_object('version','marketing-qwen17-4096-768-ids-v2','model','qwen3:1.7b','promptVersion','marketing-performance-v2','numCtx',4096,'numPredict',768,'temperature',0,'think',false)));
CREATE OR REPLACE FUNCTION ccpun_admin.admin_prepare_marketing_analysis(p_id uuid,p_input jsonb,p_hash text,p_manifest jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $prepare$
DECLARE a ccpun_admin.marketing_analysis; BEGIN
 IF p_hash!~'^[a-f0-9]{64}$' OR p_input->>'promptVersion' NOT IN('marketing-performance-v1','marketing-performance-v2') OR jsonb_typeof(p_input->'evidence')<>'array' OR jsonb_array_length(p_input->'evidence') NOT BETWEEN 1 AND 16 OR (p_input->>'promptVersion'='marketing-performance-v2' AND (jsonb_typeof(p_input->'candidates')<>'array' OR jsonb_array_length(p_input->'candidates')>8)) OR octet_length(p_input::text)>24000 OR jsonb_typeof(p_manifest)<>'array' OR octet_length(p_manifest::text)>4000000 THEN RAISE EXCEPTION 'MARKETING_INPUT_INVALID'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('marketing-prepare:'||p_hash));SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE input_hash=p_hash;
 IF FOUND THEN RETURN jsonb_build_object('analysisId',a.analysis_id,'inputHash',a.input_hash,'status','prepared','reused',true,'coverage',a.input_json->'coverage'); END IF;
 INSERT INTO ccpun_admin.marketing_analysis(analysis_id,input_hash,input_json,source_manifest,prompt_version,window_key,analysis_type,period_start,period_end) VALUES(p_id,p_hash,p_input,p_manifest,p_input->>'promptVersion',p_input#>>'{period,key}',p_input->>'analysisType',(p_input#>>'{period,currentStart}')::date,(p_input#>>'{period,currentEnd}')::date);
 RETURN jsonb_build_object('analysisId',p_id,'inputHash',p_hash,'status','prepared','reused',false,'coverage',p_input->'coverage');END $prepare$;
CREATE FUNCTION ccpun_admin.admin_enqueue_marketing_analysis_v2(p_id uuid,p_job uuid,p_cipher text,p_nonce text,p_tag text,p_key smallint,p_hash text,p_actor text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $enqueue_v2$
DECLARE a ccpun_admin.marketing_analysis;r record;profile jsonb:=jsonb_build_object('version','marketing-qwen17-4096-768-ids-v2','model','qwen3:1.7b','promptVersion','marketing-performance-v2','numCtx',4096,'numPredict',768,'temperature',0,'think',false);
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR a.prompt_version<>'marketing-performance-v2' OR a.validation_status<>'pending' THEN RAISE EXCEPTION 'MARKETING_ANALYSIS_IDENTITY_INVALID';END IF;
 IF a.job_id IS NOT NULL THEN RETURN ccpun_admin.admin_marketing_analysis_status(p_id)||jsonb_build_object('reused',true,'retryEligible',false);END IF;
 IF NOT EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at>now()-interval '90 seconds' AND h.ollama_ready AND NOT h.accepting_private_jobs AND h.model_name='qwen3:1.7b' AND h.details_json->>'marketingAnalysisVersion'='marketing-performance-v2' AND h.details_json->'marketingInferenceProfile'=profile)
 OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at>now()-interval '90 seconds' AND (h.accepting_private_jobs OR h.model_name<>'qwen3:1.7b' OR h.details_json->'marketingInferenceProfile' IS DISTINCT FROM profile OR h.details_json->>'marketingAnalysisVersion' IS DISTINCT FROM 'marketing-performance-v2')) THEN RAISE EXCEPTION 'MARKETING_WORKER_PROFILE_NOT_READY';END IF;
 SELECT * INTO r FROM ccpun_admin.admin_enqueue_local_ai_job_v2(p_job,'marketing-analysis','public-safe',p_cipher,p_nonce,p_tag,p_key,encode(sha256(convert_to('marketing-analysis:'||p_hash||':ids-v2','UTF8')),'hex'),p_hash,p_actor,'batch');
 IF r.outcome NOT IN('inserted','reused') THEN RETURN jsonb_build_object('analysisId',p_id,'status','prepared','outcome',r.outcome,'reused',false);END IF;
 IF r.reused THEN RAISE EXCEPTION 'MARKETING_V2_ORPHAN_JOB';END IF;
 UPDATE ccpun_admin.local_ai_job SET max_attempts=1 WHERE job_id=r.job_id AND status='queued' AND attempt_count=0;
 IF NOT FOUND THEN RAISE EXCEPTION 'MARKETING_V2_CONCURRENT_CLAIM';END IF;
 INSERT INTO ccpun_admin.marketing_analysis_attempt(analysis_id,generation,job_id,inference_profile,provenance) VALUES(a.analysis_id,1,r.job_id,profile,'worker-heartbeat-ids-v2');
 UPDATE ccpun_admin.marketing_analysis SET job_id=r.job_id WHERE analysis_id=p_id AND job_id IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'MARKETING_V2_LINK_CONFLICT';END IF;
 RETURN jsonb_build_object('analysisId',p_id,'jobId',r.job_id,'status','queued','reused',false,'inferenceProfile',profile,'attemptBudgetRemaining',1);
END $enqueue_v2$;
CREATE FUNCTION ccpun_admin.admin_reserve_marketing_cloud_v3(p_id uuid,p_hash text,p_reservation uuid,p_prompt_version text,p_prompt_digest text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $reserve_v3$
DECLARE a ccpun_admin.marketing_analysis;j ccpun_admin.local_ai_job;c ccpun_admin.marketing_cloud_attempt;t ccpun_admin.marketing_analysis_attempt;
BEGIN
 IF p_prompt_version<>'marketing-performance-cloud-v2' OR p_prompt_digest IS NULL OR p_prompt_digest!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'MARKETING_CLOUD_PROMPT_INVALID';END IF;
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR a.prompt_version<>'marketing-performance-v2' OR a.validation_status='validated' THEN RAISE EXCEPTION 'MARKETING_CLOUD_IDENTITY_INVALID';END IF;
 -- Cloud is reserved only for a supplied high-priority candidate with complete, adequate, current evidence.
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.input_json->'candidates') candidate WHERE candidate->>'priority'='high' AND jsonb_array_length(candidate->'evidenceIds')>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(candidate->'evidenceIds') ref WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.input_json->'evidence') fact WHERE fact->>'id'=ref.value AND fact->>'sampleStatus'='sufficient' AND fact->>'coverageStatus'='complete' AND fact->>'freshnessStatus' IN('fresh','expected_lag')))) THEN RAISE EXCEPTION 'MARKETING_CLOUD_NOT_NEEDED';END IF;
 SELECT * INTO c FROM ccpun_admin.marketing_cloud_attempt WHERE analysis_id=p_id;
 IF FOUND THEN RETURN jsonb_build_object('analysisId',p_id,'status',c.status,'reused',true);END IF;
 IF a.job_id IS NULL THEN
  IF a.created_at>now()-interval '10 minutes' OR NOT EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at<now()-interval '10 minutes') OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at>now()-interval '90 seconds' AND h.ollama_ready AND h.details_json->>'marketingAnalysisVersion'='marketing-performance-v2') THEN RAISE EXCEPTION 'MARKETING_LOCAL_NOT_TERMINAL';END IF;
 ELSE
  SELECT * INTO j FROM ccpun_admin.local_ai_job WHERE job_id=a.job_id FOR UPDATE;
  SELECT * INTO t FROM ccpun_admin.marketing_analysis_attempt WHERE analysis_id=p_id AND job_id=a.job_id;
  IF j.job_id IS NULL OR j.task_type<>'marketing-analysis' OR j.data_class<>'public-safe' OR j.request_fingerprint IS DISTINCT FROM a.input_hash OR t.profile_version IS DISTINCT FROM 'marketing-qwen17-4096-768-ids-v2' OR j.status NOT IN('failed','cancelled','expired','reconciliation-required') OR j.completed_at IS NULL THEN RAISE EXCEPTION 'MARKETING_LOCAL_NOT_TERMINAL';END IF;
 END IF;
 INSERT INTO ccpun_admin.marketing_cloud_attempt(analysis_id,input_hash,reservation_id,prompt_version,cloud_prompt_version,cloud_prompt_digest) VALUES(p_id,p_hash,p_reservation,'marketing-performance-v2',p_prompt_version,p_prompt_digest);
 RETURN jsonb_build_object('analysisId',p_id,'reservationId',p_reservation,'status','reserved','reused',false,'cloudPromptVersion',p_prompt_version,'cloudPromptDigest',p_prompt_digest);
END $reserve_v3$;
REVOKE ALL ON FUNCTION ccpun_admin.admin_enqueue_marketing_analysis_v2(uuid,uuid,text,text,text,smallint,text,text),ccpun_admin.admin_reserve_marketing_cloud_v3(uuid,text,uuid,text,text) FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_enqueue_marketing_analysis_v2(uuid,uuid,text,text,text,smallint,text,text),ccpun_admin.admin_reserve_marketing_cloud_v3(uuid,text,uuid,text,text) TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO ccpun_admin.schema_migration(version,checksum) VALUES('20260928_marketing_ai_candidates_v5','sha256:44eb2289295711409d4b28b97de58112c36b4d63b070cf6ada147c040a747f8b') ON CONFLICT(version) DO NOTHING;
COMMIT;

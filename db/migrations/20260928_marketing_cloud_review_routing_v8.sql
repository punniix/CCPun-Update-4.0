BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN 1 ELSE 0 END AS role_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND database_name='neondb' AND migration_version='20260919_local_ai_control_plane_v1' AND migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6' AND ((lane='uat' AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394') OR (lane='production' AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w'))) THEN 1 ELSE 0 END AS identity_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_cloud_review_retry_v7' AND checksum='sha256:d9499a69612d230e87ce606f4121fc0ff94b26748b8e935e051c561404078dcc') THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260928_marketing_cloud_review_routing_v8'));
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_cloud_review_routing_v8') THEN 1 ELSE 0 END AS not_already_applied_guard;
-- checksum-source-begin
CREATE OR REPLACE FUNCTION ccpun_admin.admin_marketing_analysis_status(p_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $status_review$
 SELECT jsonb_build_object('analysisId',a.analysis_id,'jobId',a.job_id,'status',ccpun_admin.marketing_analysis_json_with_review(a)->>'status','workerSucceeded',coalesce(j.status='succeeded',false),'cloudStatus',c.status,'cloudMode',c.mode,'reviewRequired',a.prompt_version='marketing-performance-v3' AND ccpun_admin.marketing_v3_review_eligible(a) AND c.analysis_id IS NULL)
 FROM ccpun_admin.marketing_analysis a LEFT JOIN ccpun_admin.local_ai_job j USING(job_id) LEFT JOIN ccpun_admin.marketing_cloud_attempt c ON c.analysis_id=a.analysis_id WHERE a.analysis_id=p_id;
$status_review$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_enqueue_marketing_analysis_v3(p_id uuid,p_job uuid,p_cipher text,p_nonce text,p_tag text,p_key smallint,p_hash text,p_actor text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $enqueue_v3$
DECLARE a ccpun_admin.marketing_analysis;r record;profile jsonb:=jsonb_build_object('version','marketing-qwen17-4096-768-diagnosis-v3','model','qwen3:1.7b','promptVersion','marketing-performance-v3','numCtx',4096,'numPredict',768,'temperature',0,'think',false);
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR a.prompt_version<>'marketing-performance-v3' THEN RAISE EXCEPTION 'MARKETING_ANALYSIS_IDENTITY_INVALID';END IF;
 IF a.validation_status IN('validated','rejected') THEN
  IF a.job_id IS NULL THEN RAISE EXCEPTION 'MARKETING_ANALYSIS_IDENTITY_INVALID';END IF;
  RETURN ccpun_admin.admin_marketing_analysis_status(p_id)||jsonb_build_object('reused',true,'retryEligible',false);
 END IF;
 IF a.validation_status<>'pending' THEN RAISE EXCEPTION 'MARKETING_ANALYSIS_IDENTITY_INVALID';END IF;
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
END $enqueue_v3$;
REVOKE ALL ON FUNCTION ccpun_admin.admin_enqueue_marketing_analysis_v3(uuid,uuid,text,text,text,smallint,text,text) FROM PUBLIC,ccpun_local_ai_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_enqueue_marketing_analysis_v3(uuid,uuid,text,text,text,smallint,text,text) TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO ccpun_admin.schema_migration(version,checksum) VALUES('20260928_marketing_cloud_review_routing_v8','sha256:3ce7dceaa7dd2af7a37dc3aceeef5aacff2f30a7173e41614b897c254171d6a5');
COMMIT;

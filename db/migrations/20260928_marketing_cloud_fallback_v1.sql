BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN 1 ELSE 0 END AS role_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND database_name='neondb' AND migration_version='20260919_local_ai_control_plane_v1' AND migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6' AND ((lane='uat' AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394') OR (lane='production' AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w'))) THEN 1 ELSE 0 END AS identity_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_ai_repair_retry_v4' AND checksum='sha256:27d012741dd64bbb1d5378ecb4bcd165a9e379b8046342d13019d2dec67290db') THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260928_marketing_cloud_fallback_v1'));
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_cloud_fallback_v1' AND checksum<>'sha256:c582ea59bffd69322fe3fe07922c2681b12b019cff7921a9735bbf5a03ae0ad3') THEN 1 ELSE 0 END AS checksum_guard;
-- checksum-source-begin
CREATE TABLE ccpun_admin.marketing_cloud_attempt (
 analysis_id uuid PRIMARY KEY REFERENCES ccpun_admin.marketing_analysis(analysis_id),
 input_hash text NOT NULL CHECK(input_hash~'^[a-f0-9]{64}$'),
 reservation_id uuid NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN('reserved','ready','failed')),
 provider text NOT NULL DEFAULT 'openai' CHECK(provider='openai'),
 model text NOT NULL DEFAULT 'gpt-6-luna' CHECK(model='gpt-6-luna'),
 prompt_version text NOT NULL DEFAULT 'marketing-performance-v1' CHECK(prompt_version='marketing-performance-v1'),
 reserved_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 output_json jsonb,
 output_digest text CHECK(output_digest IS NULL OR output_digest~'^[a-f0-9]{64}$'),
 input_tokens integer CHECK(input_tokens BETWEEN 0 AND 100000),
 output_tokens integer CHECK(output_tokens BETWEEN 0 AND 100000),
 failure_code text CHECK(failure_code IN('api-error','model-output-invalid','timeout','workflow-error')),
 CHECK((status='reserved' AND completed_at IS NULL AND output_json IS NULL AND failure_code IS NULL)
    OR (status='ready' AND completed_at IS NOT NULL AND output_json IS NOT NULL AND output_digest IS NOT NULL AND input_tokens IS NOT NULL AND output_tokens IS NOT NULL AND failure_code IS NULL)
    OR (status='failed' AND completed_at IS NOT NULL AND output_json IS NULL AND failure_code IS NOT NULL))
);
REVOKE ALL ON ccpun_admin.marketing_cloud_attempt FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;
CREATE FUNCTION ccpun_admin.marketing_cloud_block_local_enqueue() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ccpun_admin AS $guard$
BEGIN
 IF NEW.job_id IS DISTINCT FROM OLD.job_id AND EXISTS(SELECT 1 FROM ccpun_admin.marketing_cloud_attempt c WHERE c.analysis_id=NEW.analysis_id) THEN RAISE EXCEPTION 'MARKETING_CLOUD_RESERVED';END IF;
 RETURN NEW;
END $guard$;
CREATE TRIGGER marketing_cloud_block_local_enqueue BEFORE UPDATE OF job_id ON ccpun_admin.marketing_analysis FOR EACH ROW EXECUTE FUNCTION ccpun_admin.marketing_cloud_block_local_enqueue();
CREATE FUNCTION ccpun_admin.admin_reserve_marketing_cloud(p_id uuid,p_hash text,p_reservation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $reserve$
DECLARE a ccpun_admin.marketing_analysis;j ccpun_admin.local_ai_job;c ccpun_admin.marketing_cloud_attempt;profile text;
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR a.prompt_version<>'marketing-performance-v1' OR a.validation_status='validated' THEN RAISE EXCEPTION 'MARKETING_CLOUD_IDENTITY_INVALID';END IF;
 SELECT * INTO c FROM ccpun_admin.marketing_cloud_attempt WHERE analysis_id=p_id;
 IF FOUND THEN RETURN jsonb_build_object('analysisId',p_id,'status',c.status,'reused',true);END IF;
 IF a.job_id IS NULL THEN
  -- A missing heartbeat alone is not proof of worker failure: require an old heartbeat and a time gate.
  IF a.created_at>now()-interval '10 minutes' OR NOT EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at<now()-interval '10 minutes') OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at>now()-interval '90 seconds' AND h.ollama_ready AND NOT h.accepting_private_jobs AND h.model_name='qwen3:1.7b') THEN RAISE EXCEPTION 'MARKETING_LOCAL_NOT_TERMINAL';END IF;
 ELSE
  SELECT * INTO j FROM ccpun_admin.local_ai_job WHERE job_id=a.job_id FOR UPDATE;
  IF NOT FOUND OR j.task_type<>'marketing-analysis' OR j.data_class<>'public-safe' OR j.request_fingerprint IS DISTINCT FROM a.input_hash THEN RAISE EXCEPTION 'MARKETING_LOCAL_LINEAGE_INVALID';END IF;
  IF a.validation_status<>'rejected' THEN
   IF j.status NOT IN('failed','cancelled','expired','reconciliation-required') OR j.completed_at IS NULL THEN RAISE EXCEPTION 'MARKETING_LOCAL_NOT_TERMINAL';END IF;
   IF j.error_category='model-output-invalid' THEN
    SELECT t.profile_version INTO profile FROM ccpun_admin.marketing_analysis_attempt t WHERE t.analysis_id=p_id AND t.job_id=j.job_id;
    IF profile IS DISTINCT FROM 'marketing-qwen17-4096-768-repair-v1' THEN RAISE EXCEPTION 'MARKETING_LOCAL_REPAIR_AVAILABLE';END IF;
   END IF;
  END IF;
 END IF;
 INSERT INTO ccpun_admin.marketing_cloud_attempt(analysis_id,input_hash,reservation_id) VALUES(p_id,p_hash,p_reservation);
 RETURN jsonb_build_object('analysisId',p_id,'reservationId',p_reservation,'status','reserved','reused',false);
END $reserve$;
CREATE FUNCTION ccpun_admin.admin_complete_marketing_cloud(p_id uuid,p_hash text,p_reservation uuid,p_output jsonb,p_digest text,p_input_tokens integer,p_output_tokens integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $complete$
DECLARE a ccpun_admin.marketing_analysis;c ccpun_admin.marketing_cloud_attempt;
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 SELECT * INTO c FROM ccpun_admin.marketing_cloud_attempt WHERE analysis_id=p_id AND input_hash=p_hash AND reservation_id=p_reservation FOR UPDATE;
 IF c.status='ready' AND c.output_digest=p_digest AND a.validation_status='validated' THEN RETURN jsonb_build_object('analysisId',p_id,'status','ready','provider','openai','model','gpt-6-luna','validated',true,'reused',true);END IF;
 IF NOT FOUND OR a.analysis_id IS NULL OR c.status<>'reserved' OR a.validation_status='validated' OR p_digest!~'^[a-f0-9]{64}$' OR p_input_tokens NOT BETWEEN 0 AND 100000 OR p_output_tokens NOT BETWEEN 0 AND 100000 OR p_output->>'promptVersion' IS DISTINCT FROM a.prompt_version OR p_output->>'snapshotHash' IS DISTINCT FROM a.input_json->>'snapshotHash' OR p_output->>'sourceManifestHash' IS DISTINCT FROM a.input_json->>'sourceManifestHash' THEN RAISE EXCEPTION 'MARKETING_CLOUD_CONCURRENT_CHANGE';END IF;
 UPDATE ccpun_admin.marketing_cloud_attempt SET status='ready',completed_at=now(),output_json=p_output,output_digest=p_digest,input_tokens=p_input_tokens,output_tokens=p_output_tokens WHERE analysis_id=p_id;
 UPDATE ccpun_admin.marketing_analysis SET validation_status='validated',output_json=p_output,output_digest=p_digest,validated_at=now() WHERE analysis_id=p_id;
 RETURN jsonb_build_object('analysisId',p_id,'status','ready','provider','openai','model','gpt-6-luna','validated',true);
END $complete$;
CREATE FUNCTION ccpun_admin.admin_fail_marketing_cloud(p_id uuid,p_hash text,p_reservation uuid,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $fail$
DECLARE a ccpun_admin.marketing_analysis;c ccpun_admin.marketing_cloud_attempt;
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 SELECT * INTO c FROM ccpun_admin.marketing_cloud_attempt WHERE analysis_id=p_id AND input_hash=p_hash AND reservation_id=p_reservation FOR UPDATE;
 IF NOT FOUND OR a.analysis_id IS NULL OR c.status='ready' OR p_reason NOT IN('api-error','model-output-invalid','timeout','workflow-error') THEN RAISE EXCEPTION 'MARKETING_CLOUD_CONCURRENT_CHANGE';END IF;
 IF c.status='reserved' THEN UPDATE ccpun_admin.marketing_cloud_attempt SET status='failed',completed_at=now(),failure_code=p_reason WHERE analysis_id=p_id;END IF;
 RETURN jsonb_build_object('analysisId',p_id,'status','failed','reason',p_reason);
END $fail$;
CREATE OR REPLACE FUNCTION ccpun_admin.marketing_analysis_json(a ccpun_admin.marketing_analysis) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,ccpun_admin AS $shape$
SELECT jsonb_build_object('analysisId',a.analysis_id,'jobId',a.job_id,'status',CASE WHEN a.validation_status='validated' AND a.period_end<(ccpun_admin.marketing_window(a.window_key,least((now() AT TIME ZONE 'America/Los_Angeles')::date-3,(now() AT TIME ZONE 'Asia/Bangkok')::date-1))->>'currentEnd')::date THEN 'stale' WHEN a.validation_status='validated' THEN 'ready' WHEN c.status='reserved' THEN 'running' WHEN c.status='failed' THEN 'failed' WHEN j.status='leased' THEN 'running' WHEN a.validation_status='rejected' OR j.status IN('failed','cancelled','expired','reconciliation-required') THEN 'failed' WHEN a.job_id IS NULL THEN 'prepared' ELSE 'queued' END,'promptVersion',a.prompt_version,'analysisType',a.analysis_type,'period',a.input_json->'period','createdAt',a.created_at,'completedAt',a.validated_at,'modelName',CASE WHEN c.status='ready' THEN c.model ELSE j.model_name END,'inferenceProvider',CASE WHEN c.status='ready' THEN c.provider WHEN j.job_id IS NOT NULL THEN 'local' ELSE NULL END,'cloudUsage',CASE WHEN c.status='ready' THEN jsonb_build_object('inputTokens',c.input_tokens,'outputTokens',c.output_tokens) ELSE NULL END,'inputHash',a.input_hash,'sourceManifest',a.source_manifest,'inferenceProfile',(SELECT t.inference_profile FROM ccpun_admin.marketing_analysis_attempt t WHERE t.job_id=a.job_id),'attempts',(SELECT coalesce(jsonb_agg(jsonb_build_object('generation',t.generation,'jobId',t.job_id,'parentFailedJobId',t.parent_failed_job_id,'inferenceProfile',t.inference_profile,'provenance',t.provenance,'attemptCount',q.attempt_count,'maxAttempts',q.max_attempts,'status',q.status,'errorCategory',q.error_category,'capturedAt',t.captured_at) ORDER BY t.generation),'[]') FROM ccpun_admin.marketing_analysis_attempt t JOIN ccpun_admin.local_ai_job q USING(job_id) WHERE t.analysis_id=a.analysis_id),'output',CASE WHEN a.validation_status='validated' AND (c.status='ready' OR j.review_status IN('pending','approved')) THEN a.output_json END) FROM(SELECT 1) x LEFT JOIN ccpun_admin.local_ai_job j ON j.job_id=a.job_id LEFT JOIN ccpun_admin.marketing_cloud_attempt c ON c.analysis_id=a.analysis_id $shape$;
CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_marketing_analysis(p_window text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $read$ SELECT jsonb_build_object('latest',(SELECT ccpun_admin.marketing_analysis_json(a) FROM ccpun_admin.marketing_analysis a WHERE a.window_key=p_window ORDER BY a.created_at DESC LIMIT 1),'lastGood',(SELECT ccpun_admin.marketing_analysis_json(a) FROM ccpun_admin.marketing_analysis a LEFT JOIN ccpun_admin.local_ai_job j USING(job_id) LEFT JOIN ccpun_admin.marketing_cloud_attempt c ON c.analysis_id=a.analysis_id WHERE a.window_key=p_window AND a.validation_status='validated' AND (c.status='ready' OR j.review_status IN('pending','approved')) ORDER BY a.validated_at DESC LIMIT 1)) $read$;
CREATE OR REPLACE FUNCTION ccpun_admin.admin_marketing_analysis_status(p_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $status$
SELECT jsonb_build_object('analysisId',a.analysis_id,'jobId',a.job_id,'status',CASE WHEN a.validation_status='validated' AND a.period_end<(ccpun_admin.marketing_window(a.window_key,least((now() AT TIME ZONE 'America/Los_Angeles')::date-3,(now() AT TIME ZONE 'Asia/Bangkok')::date-1))->>'currentEnd')::date THEN 'stale' WHEN a.validation_status='validated' THEN 'ready' WHEN c.status='reserved' THEN 'running' WHEN c.status='failed' THEN 'failed' WHEN j.status='leased' THEN 'running' WHEN a.validation_status='rejected' OR j.status IN('failed','cancelled','expired','reconciliation-required') THEN 'failed' WHEN a.job_id IS NULL THEN 'prepared' ELSE 'queued' END,'workerSucceeded',coalesce(j.status='succeeded',false),'cloudStatus',c.status) FROM ccpun_admin.marketing_analysis a LEFT JOIN ccpun_admin.local_ai_job j USING(job_id) LEFT JOIN ccpun_admin.marketing_cloud_attempt c ON c.analysis_id=a.analysis_id WHERE a.analysis_id=p_id $status$;
REVOKE ALL ON FUNCTION ccpun_admin.marketing_cloud_block_local_enqueue(),ccpun_admin.admin_reserve_marketing_cloud(uuid,text,uuid),ccpun_admin.admin_complete_marketing_cloud(uuid,text,uuid,jsonb,text,integer,integer),ccpun_admin.admin_fail_marketing_cloud(uuid,text,uuid,text) FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_reserve_marketing_cloud(uuid,text,uuid),ccpun_admin.admin_complete_marketing_cloud(uuid,text,uuid,jsonb,text,integer,integer),ccpun_admin.admin_fail_marketing_cloud(uuid,text,uuid,text) TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO ccpun_admin.schema_migration(version,checksum) VALUES('20260928_marketing_cloud_fallback_v1','sha256:c582ea59bffd69322fe3fe07922c2681b12b019cff7921a9735bbf5a03ae0ad3') ON CONFLICT(version) DO NOTHING;
COMMIT;

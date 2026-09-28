-- UAT-only rollback fixture. Run after v4 migration on the UAT branch; never on Production.
BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND lane='uat' AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8') THEN 1 ELSE 0 END AS uat_only_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_ai_repair_retry_v4' AND checksum='sha256:27d012741dd64bbb1d5378ecb4bcd165a9e379b8046342d13019d2dec67290db') THEN 1 ELSE 0 END AS migration_guard;
DO $repair_fixture$
DECLARE a_id uuid;legacy_id uuid;base_id uuid;new_id uuid;replay_id uuid;case_no integer;used_expected integer;r jsonb;p jsonb;case_payload jsonb;
 legacy_profile jsonb:=jsonb_build_object('version','marketing-qwen17-4096-384-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',384,'temperature',0,'think',false);
 base_profile jsonb:=jsonb_build_object('version','marketing-qwen17-4096-768-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false);
 repair_profile jsonb:=jsonb_build_object('version','marketing-qwen17-4096-768-repair-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false);
BEGIN
 UPDATE ccpun_admin.local_ai_worker_heartbeat SET last_seen_at=now()-interval '10 minutes';
 INSERT INTO ccpun_admin.local_ai_worker_heartbeat(worker_digest,runtime_version,model_name,ollama_ready,accepting_private_jobs,active_job_count,last_seen_at,details_json)
 VALUES(repeat('e',64),'synthetic-repair-v4-uat','qwen3:1.7b',true,false,0,now(),jsonb_build_object('marketingAnalysisVersion','marketing-performance-v1','marketingInferenceProfile',repair_profile))
 ON CONFLICT(worker_digest) DO UPDATE SET model_name='qwen3:1.7b',ollama_ready=true,accepting_private_jobs=false,last_seen_at=now(),details_json=excluded.details_json;
 p:=jsonb_build_object('promptVersion','marketing-performance-v1','analysisType','weekly_performance','snapshotHash',repeat('1',64),'sourceManifestHash',repeat('2',64),'period',jsonb_build_object('key','this_week','currentStart','2026-09-21','currentEnd','2026-09-24'),'evidence',jsonb_build_array(jsonb_build_object('id','e1')),'coverage',jsonb_build_object('prepared',1,'sent',1,'dropped',0));
 FOR case_no IN 1..3 LOOP
  a_id:=gen_random_uuid();legacy_id:=gen_random_uuid();base_id:=gen_random_uuid();new_id:=gen_random_uuid();replay_id:=gen_random_uuid();
  case_payload:=CASE WHEN case_no=2 THEN jsonb_set(jsonb_set(p,'{analysisType}','"monthly_performance"'::jsonb),'{period}',jsonb_build_object('key','this_month','currentStart','2026-09-01','currentEnd','2026-09-24')) ELSE p END;
  PERFORM ccpun_admin.admin_prepare_marketing_analysis(a_id,case_payload,repeat(case_no::text,64),'[]');
  INSERT INTO ccpun_admin.local_ai_job(job_id,task_type,data_class,ciphertext_b64,nonce_b64,auth_tag_b64,key_version,idempotency_key,actor_digest,request_fingerprint,queue_class,priority,deadline_at,status,attempt_count,max_attempts,error_category,completed_at)
  VALUES(legacy_id,'marketing-analysis','public-safe','synthetic-legacy',repeat('x',24),repeat('x',24),1,encode(sha256(convert_to(legacy_id::text,'UTF8')),'hex'),repeat('c',64),repeat(case_no::text,64),'batch',20,now()+interval '6 hours','failed',CASE WHEN case_no=2 THEN 1 ELSE 2 END,3,'model-output-invalid',now()),
        (base_id,'marketing-analysis','public-safe','synthetic-base-768',repeat('y',24),repeat('y',24),1,encode(sha256(convert_to(base_id::text,'UTF8')),'hex'),repeat('c',64),repeat(case_no::text,64),'batch',20,now()+interval '6 hours','failed',CASE WHEN case_no=3 THEN 2 ELSE 1 END,2,'model-output-invalid',now());
  INSERT INTO ccpun_admin.marketing_analysis_attempt(analysis_id,generation,job_id,parent_failed_job_id,inference_profile,provenance)
  VALUES(a_id,1,legacy_id,NULL,legacy_profile,'audited-legacy-384'),(a_id,2,base_id,legacy_id,base_profile,'worker-heartbeat-768');
  UPDATE ccpun_admin.marketing_analysis SET job_id=base_id WHERE analysis_id=a_id;
  used_expected:=CASE WHEN case_no=2 THEN 2 WHEN case_no=3 THEN 4 ELSE 3 END;
  IF(SELECT sum(q.attempt_count) FROM ccpun_admin.marketing_analysis_attempt t JOIN ccpun_admin.local_ai_job q USING(job_id) WHERE t.analysis_id=a_id)<>used_expected THEN RAISE EXCEPTION 'FIXTURE_ATTEMPTS_INVALID';END IF;
  IF case_no=1 THEN
   UPDATE ccpun_admin.local_ai_worker_heartbeat SET details_json=jsonb_build_object('marketingAnalysisVersion','marketing-performance-v1','marketingInferenceProfile',base_profile) WHERE worker_digest=repeat('e',64);
   BEGIN PERFORM ccpun_admin.admin_enqueue_marketing_analysis(a_id,new_id,'synthetic-repair-payload',repeat('z',24),repeat('z',24),1::smallint,repeat(case_no::text,64),repeat('c',64));RAISE EXCEPTION 'WRONG_WORKER_PROFILE_ACCEPTED';
   EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'MARKETING_WORKER_PROFILE_NOT_READY' THEN RAISE;END IF;END;
   UPDATE ccpun_admin.local_ai_worker_heartbeat SET details_json=jsonb_build_object('marketingAnalysisVersion','marketing-performance-v1','marketingInferenceProfile',repair_profile) WHERE worker_digest=repeat('e',64);
   BEGIN PERFORM ccpun_admin.admin_enqueue_marketing_analysis(a_id,new_id,'synthetic-repair-payload',repeat('z',24),repeat('z',24),1::smallint,repeat('9',64),repeat('c',64));RAISE EXCEPTION 'WRONG_INPUT_HASH_ACCEPTED';
   EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'MARKETING_ANALYSIS_IDENTITY_INVALID' THEN RAISE;END IF;END;
  END IF;
  IF case_no=2 THEN
   UPDATE ccpun_admin.local_ai_job SET error_category='ollama-timeout' WHERE job_id=base_id;
   r:=ccpun_admin.admin_enqueue_marketing_analysis(a_id,new_id,'synthetic-repair-payload',repeat('z',24),repeat('z',24),1::smallint,repeat(case_no::text,64),repeat('c',64));
   IF r->>'retryEligible'<>'false' OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_job WHERE job_id=new_id) THEN RAISE EXCEPTION 'TRANSIENT_FAILURE_RETRIED';END IF;
   UPDATE ccpun_admin.local_ai_job SET error_category='model-output-invalid' WHERE job_id=base_id;
  END IF;
  r:=ccpun_admin.admin_enqueue_marketing_analysis(a_id,new_id,'synthetic-repair-payload',repeat('z',24),repeat('z',24),1::smallint,repeat(case_no::text,64),repeat('c',64));
  IF case_no=3 THEN
   IF r->>'retryOutcome'<>'attempt-budget-exhausted' OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_job WHERE job_id=new_id) OR(SELECT job_id FROM ccpun_admin.marketing_analysis WHERE analysis_id=a_id)<>base_id THEN RAISE EXCEPTION 'EXHAUSTED_BUDGET_ALLOWED';END IF;
  ELSE
   IF r->>'jobId'<>new_id::text OR r->>'previousFailedJobId'<>base_id::text OR r->>'status'<>'queued' OR NOT(r->>'retried')::boolean OR(r->>'attemptBudgetRemaining')::integer<>4-used_expected THEN RAISE EXCEPTION 'REPAIR_TRANSITION_INVALID';END IF;
   IF(SELECT generation FROM ccpun_admin.marketing_analysis_attempt WHERE job_id=new_id)<>3 OR(SELECT parent_failed_job_id FROM ccpun_admin.marketing_analysis_attempt WHERE job_id=new_id)<>base_id OR(SELECT inference_profile FROM ccpun_admin.marketing_analysis_attempt WHERE job_id=new_id)<>repair_profile THEN RAISE EXCEPTION 'REPAIR_LINEAGE_INVALID';END IF;
   IF NOT EXISTS(SELECT 1 FROM ccpun_admin.local_ai_job_event WHERE job_id=new_id AND reason_code='marketing-profile-transition-768-repair') OR(SELECT input_hash FROM ccpun_admin.marketing_analysis WHERE analysis_id=a_id)<>repeat(case_no::text,64) THEN RAISE EXCEPTION 'REPAIR_AUDIT_OR_HASH_INVALID';END IF;
   IF(SELECT max_attempts FROM ccpun_admin.local_ai_job WHERE job_id=new_id)<>4-used_expected OR(SELECT attempt_count FROM ccpun_admin.local_ai_job WHERE job_id=new_id)<>0 OR(SELECT ciphertext_b64 FROM ccpun_admin.local_ai_job WHERE job_id=new_id)<>'synthetic-repair-payload' THEN RAISE EXCEPTION 'REPAIR_PAYLOAD_OR_BUDGET_INVALID';END IF;
   IF(SELECT status FROM ccpun_admin.local_ai_job WHERE job_id=base_id)<>'failed' OR(SELECT attempt_count FROM ccpun_admin.local_ai_job WHERE job_id=base_id)<>(CASE WHEN case_no=3 THEN 2 ELSE 1 END) OR(SELECT ciphertext_b64 FROM ccpun_admin.local_ai_job WHERE job_id=base_id)<>'synthetic-base-768' THEN RAISE EXCEPTION 'PRIOR_JOB_MUTATED';END IF;
   r:=ccpun_admin.admin_enqueue_marketing_analysis(a_id,replay_id,'unused-replay',repeat('z',24),repeat('z',24),1::smallint,repeat(case_no::text,64),repeat('c',64));
   IF r->>'jobId'<>new_id::text OR NOT(r->>'reused')::boolean OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_job WHERE job_id=replay_id) THEN RAISE EXCEPTION 'REPLAY_CREATED_DUPLICATE';END IF;
  END IF;
 END LOOP;
 -- New Daily analyses use the worker's repair profile at generation 1.
 a_id:=gen_random_uuid();new_id:=gen_random_uuid();replay_id:=gen_random_uuid();
 PERFORM ccpun_admin.admin_prepare_marketing_analysis(a_id,p,repeat('4',64),'[]');
 r:=ccpun_admin.admin_enqueue_marketing_analysis(a_id,new_id,'synthetic-fresh-repair',repeat('z',24),repeat('z',24),1::smallint,repeat('4',64),repeat('c',64));
 IF r->>'status'<>'queued' OR(r->>'retried')::boolean OR(SELECT max_attempts FROM ccpun_admin.local_ai_job WHERE job_id=new_id)<>3 OR NOT EXISTS(SELECT 1 FROM ccpun_admin.marketing_analysis_attempt WHERE job_id=new_id AND generation=1 AND parent_failed_job_id IS NULL AND inference_profile=repair_profile AND provenance='worker-heartbeat-768-repair') THEN RAISE EXCEPTION 'FRESH_REPAIR_PROFILE_INVALID';END IF;
 UPDATE ccpun_admin.local_ai_job SET status='failed',attempt_count=1,error_category='model-output-invalid',completed_at=now() WHERE job_id=new_id;
 r:=ccpun_admin.admin_enqueue_marketing_analysis(a_id,replay_id,'unused-fresh-retry',repeat('z',24),repeat('z',24),1::smallint,repeat('4',64),repeat('c',64));
 IF r->>'status'<>'failed' OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_job WHERE job_id=replay_id) THEN RAISE EXCEPTION 'REPAIR_PROFILE_BLIND_RETRY';END IF;
 -- Audited 384 generation 1 may transition directly to repair generation 2; old job stays immutable.
 a_id:=gen_random_uuid();legacy_id:=gen_random_uuid();new_id:=gen_random_uuid();
 PERFORM ccpun_admin.admin_prepare_marketing_analysis(a_id,p,repeat('5',64),'[]');
 INSERT INTO ccpun_admin.local_ai_job(job_id,task_type,data_class,ciphertext_b64,nonce_b64,auth_tag_b64,key_version,idempotency_key,actor_digest,request_fingerprint,queue_class,priority,deadline_at,status,attempt_count,max_attempts,error_category,completed_at)
 VALUES(legacy_id,'marketing-analysis','public-safe','synthetic-legacy-direct',repeat('x',24),repeat('x',24),1,encode(sha256(convert_to(legacy_id::text,'UTF8')),'hex'),repeat('c',64),repeat('5',64),'batch',20,now()+interval '6 hours','failed',2,3,'model-output-invalid',now());
 INSERT INTO ccpun_admin.marketing_analysis_attempt(analysis_id,generation,job_id,inference_profile,provenance) VALUES(a_id,1,legacy_id,legacy_profile,'audited-legacy-384');
 UPDATE ccpun_admin.marketing_analysis SET job_id=legacy_id WHERE analysis_id=a_id;
 r:=ccpun_admin.admin_enqueue_marketing_analysis(a_id,new_id,'synthetic-direct-repair',repeat('z',24),repeat('z',24),1::smallint,repeat('5',64),repeat('c',64));
 IF r->>'jobId'<>new_id::text OR(SELECT generation FROM ccpun_admin.marketing_analysis_attempt WHERE job_id=new_id)<>2 OR(SELECT parent_failed_job_id FROM ccpun_admin.marketing_analysis_attempt WHERE job_id=new_id)<>legacy_id OR(SELECT inference_profile FROM ccpun_admin.marketing_analysis_attempt WHERE job_id=new_id)<>repair_profile OR(SELECT max_attempts FROM ccpun_admin.local_ai_job WHERE job_id=new_id)<>1 OR(SELECT status FROM ccpun_admin.local_ai_job WHERE job_id=legacy_id)<>'failed' OR NOT EXISTS(SELECT 1 FROM ccpun_admin.local_ai_job_event WHERE job_id=new_id AND reason_code='marketing-profile-transition-384-repair') THEN RAISE EXCEPTION 'LEGACY_TO_REPAIR_DIRECT_INVALID';END IF;
 -- Existing pre-repair 768 generation 1 may transition to repair generation 2, never generation 3.
 a_id:=gen_random_uuid();base_id:=gen_random_uuid();new_id:=gen_random_uuid();
 PERFORM ccpun_admin.admin_prepare_marketing_analysis(a_id,p,repeat('6',64),'[]');
 INSERT INTO ccpun_admin.local_ai_job(job_id,task_type,data_class,ciphertext_b64,nonce_b64,auth_tag_b64,key_version,idempotency_key,actor_digest,request_fingerprint,queue_class,priority,deadline_at,status,attempt_count,max_attempts,error_category,completed_at)
 VALUES(base_id,'marketing-analysis','public-safe','synthetic-base-direct',repeat('y',24),repeat('y',24),1,encode(sha256(convert_to(base_id::text,'UTF8')),'hex'),repeat('c',64),repeat('6',64),'batch',20,now()+interval '6 hours','failed',1,3,'model-output-invalid',now());
 INSERT INTO ccpun_admin.marketing_analysis_attempt(analysis_id,generation,job_id,inference_profile,provenance) VALUES(a_id,1,base_id,base_profile,'worker-heartbeat-768');
 UPDATE ccpun_admin.marketing_analysis SET job_id=base_id WHERE analysis_id=a_id;
 r:=ccpun_admin.admin_enqueue_marketing_analysis(a_id,new_id,'synthetic-base-to-repair',repeat('z',24),repeat('z',24),1::smallint,repeat('6',64),repeat('c',64));
 IF r->>'jobId'<>new_id::text OR(SELECT generation FROM ccpun_admin.marketing_analysis_attempt WHERE job_id=new_id)<>2 OR(SELECT parent_failed_job_id FROM ccpun_admin.marketing_analysis_attempt WHERE job_id=new_id)<>base_id OR(SELECT inference_profile FROM ccpun_admin.marketing_analysis_attempt WHERE job_id=new_id)<>repair_profile OR(SELECT max_attempts FROM ccpun_admin.local_ai_job WHERE job_id=new_id)<>2 OR NOT EXISTS(SELECT 1 FROM ccpun_admin.local_ai_job_event WHERE job_id=new_id AND reason_code='marketing-profile-transition-768-repair') THEN RAISE EXCEPTION 'BASE_TO_REPAIR_DIRECT_INVALID';END IF;
 IF has_table_privilege('ccpun_admin_runtime','ccpun_admin.marketing_analysis_attempt','SELECT') OR has_function_privilege('ccpun_local_ai_runtime','ccpun_admin.admin_enqueue_marketing_analysis(uuid,uuid,text,text,text,smallint,text,text)','EXECUTE') THEN RAISE EXCEPTION 'REPAIR_PRIVILEGE_EXPANDED';END IF;
 RAISE NOTICE 'MARKETING_AI_REPAIR_RETRY_V4_UAT_PASS';
END $repair_fixture$;
ROLLBACK;

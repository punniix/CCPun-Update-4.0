-- UAT ONLY: append to migration transaction and replace final COMMIT with ROLLBACK.
-- Synthetic rows/heartbeat isolation are never committed or run on Production.
DO $retry_fixture$
DECLARE aid uuid:='00000000-0000-4000-8000-00000000f131';old_id uuid:='00000000-0000-4000-8000-00000000f132';new_id uuid:='00000000-0000-4000-8000-00000000f133';other uuid:='00000000-0000-4000-8000-00000000f134';good_id uuid:='00000000-0000-4000-8000-00000000f135';good_job uuid:='00000000-0000-4000-8000-00000000f136';
p jsonb;r jsonb;profile jsonb:=jsonb_build_object('version','marketing-qwen17-4096-768-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false);legacy jsonb;before_events integer;
BEGIN
IF NOT EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND lane='uat') THEN RAISE EXCEPTION 'UAT_ONLY_FIXTURE';END IF;
legacy:=profile||jsonb_build_object('version','marketing-qwen17-4096-384-v1','numPredict',384);
UPDATE ccpun_admin.local_ai_worker_heartbeat SET last_seen_at=now()-interval '10 minutes';
INSERT INTO ccpun_admin.local_ai_worker_heartbeat(worker_digest,runtime_version,model_name,ollama_ready,accepting_private_jobs,active_job_count,last_seen_at,details_json)
VALUES(repeat('f',64),'synthetic-retry-uat','qwen3:1.7b',true,false,0,now(),jsonb_build_object('marketingAnalysisVersion','marketing-performance-v1','marketingInferenceProfile',profile))
ON CONFLICT(worker_digest) DO UPDATE SET model_name='qwen3:1.7b',ollama_ready=true,accepting_private_jobs=false,last_seen_at=now(),details_json=excluded.details_json;
p:=jsonb_build_object('promptVersion','marketing-performance-v1','analysisType','weekly_performance','snapshotHash',repeat('1',64),'sourceManifestHash',repeat('2',64),'period',jsonb_build_object('key','this_week','currentStart','2026-09-21','currentEnd','2026-09-24'),'evidence',jsonb_build_array(jsonb_build_object('id','e1')),'coverage',jsonb_build_object('prepared',1,'sent',1,'dropped',0));
PERFORM ccpun_admin.admin_prepare_marketing_analysis(good_id,p,repeat('3',64),'[]');
INSERT INTO ccpun_admin.local_ai_job(job_id,task_type,data_class,ciphertext_b64,nonce_b64,auth_tag_b64,key_version,idempotency_key,actor_digest,request_fingerprint,queue_class,priority,deadline_at,status,completed_at,review_status,output_json,output_digest,model_name)
VALUES(good_job,'marketing-analysis','public-safe','synthetic-placeholder',repeat('x',24),repeat('x',24),1,repeat('4',64),repeat('5',64),repeat('3',64),'batch',20,now()+interval '6 hours','succeeded',now(),'pending',p,repeat('6',64),'qwen3:1.7b');
UPDATE ccpun_admin.marketing_analysis SET job_id=good_job WHERE analysis_id=good_id;
PERFORM ccpun_admin.admin_validate_marketing_analysis(good_id,repeat('6',64));
PERFORM ccpun_admin.admin_prepare_marketing_analysis(aid,p,repeat('a',64),'[]');
INSERT INTO ccpun_admin.local_ai_job(job_id,task_type,data_class,ciphertext_b64,nonce_b64,auth_tag_b64,key_version,idempotency_key,actor_digest,request_fingerprint,queue_class,priority,deadline_at,status,attempt_count,max_attempts,error_category,completed_at)
VALUES(old_id,'marketing-analysis','public-safe','synthetic-legacy-placeholder',repeat('x',24),repeat('x',24),1,repeat('b',64),repeat('c',64),repeat('a',64),'batch',20,now()-interval '1 minute','failed',2,3,'model-output-invalid',now());
UPDATE ccpun_admin.marketing_analysis SET job_id=old_id WHERE analysis_id=aid;
INSERT INTO ccpun_admin.marketing_analysis_attempt(analysis_id,generation,job_id,inference_profile,provenance) VALUES(aid,1,old_id,legacy,'audited-legacy-384');
SELECT count(*) INTO before_events FROM ccpun_admin.local_ai_job_event WHERE job_id=old_id;
BEGIN PERFORM ccpun_admin.admin_enqueue_marketing_analysis(aid,new_id,'synthetic-reencrypted-new-job',repeat('y',24),repeat('y',24),1::smallint,repeat('d',64),repeat('c',64));RAISE EXCEPTION 'WRONG_HASH_ACCEPTED';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'MARKETING_ANALYSIS_IDENTITY_INVALID' THEN RAISE;END IF;END;
UPDATE ccpun_admin.local_ai_worker_heartbeat SET details_json=jsonb_build_object('marketingAnalysisVersion','marketing-performance-v1','marketingInferenceProfile',legacy) WHERE worker_digest=repeat('f',64);
BEGIN PERFORM ccpun_admin.admin_enqueue_marketing_analysis(aid,new_id,'synthetic-reencrypted-new-job',repeat('y',24),repeat('y',24),1::smallint,repeat('a',64),repeat('c',64));RAISE EXCEPTION 'WRONG_PROFILE_ACCEPTED';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'MARKETING_WORKER_PROFILE_NOT_READY' THEN RAISE;END IF;END;
UPDATE ccpun_admin.local_ai_worker_heartbeat SET details_json=jsonb_build_object('marketingAnalysisVersion','marketing-performance-v1','marketingInferenceProfile',profile) WHERE worker_digest=repeat('f',64);
r:=ccpun_admin.admin_enqueue_marketing_analysis(aid,new_id,'synthetic-reencrypted-new-job',repeat('y',24),repeat('y',24),1::smallint,repeat('a',64),repeat('c',64));
IF r->>'jobId'<>new_id::text OR r->>'previousFailedJobId'<>old_id::text OR r->>'status'<>'queued' OR NOT(r->>'retried')::boolean OR(r->>'attemptBudgetRemaining')::integer<>1 THEN RAISE EXCEPTION 'RETRY_TRANSITION_FAIL';END IF;
IF(SELECT max_attempts FROM ccpun_admin.local_ai_job WHERE job_id=new_id)<>1 OR(SELECT attempt_count FROM ccpun_admin.local_ai_job WHERE job_id=new_id)<>0 THEN RAISE EXCEPTION 'TOTAL_BUDGET_NOT_RESERVED';END IF;
IF(SELECT status FROM ccpun_admin.local_ai_job WHERE job_id=old_id)<>'failed' OR(SELECT ciphertext_b64 FROM ccpun_admin.local_ai_job WHERE job_id=old_id)<>'synthetic-legacy-placeholder' OR(SELECT attempt_count FROM ccpun_admin.local_ai_job WHERE job_id=old_id)<>2 OR(SELECT count(*) FROM ccpun_admin.local_ai_job_event WHERE job_id=old_id)<>before_events THEN RAISE EXCEPTION 'OLD_FAILURE_MUTATED';END IF;
IF(SELECT ciphertext_b64 FROM ccpun_admin.local_ai_job WHERE job_id=new_id)<>'synthetic-reencrypted-new-job' OR(SELECT parent_failed_job_id FROM ccpun_admin.marketing_analysis_attempt WHERE job_id=new_id)<>old_id THEN RAISE EXCEPTION 'NEW_PAYLOAD_LINEAGE_FAIL';END IF;
r:=ccpun_admin.admin_enqueue_marketing_analysis(aid,other,'unused-replay-payload',repeat('z',24),repeat('z',24),1::smallint,repeat('a',64),repeat('c',64));
IF r->>'jobId'<>new_id::text OR NOT(r->>'reused')::boolean OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_job WHERE job_id=other) THEN RAISE EXCEPTION 'REPLAY_DUPLICATED_JOB';END IF;
UPDATE ccpun_admin.local_ai_job SET status='leased',lease_token_digest=repeat('e',64),lease_expires_at=now()+interval '3 minutes',attempt_count=1 WHERE job_id=new_id;
IF ccpun_admin.worker_fail_local_ai_job(new_id,repeat('e',64),'ollama-timeout',true,false)<>'failed' THEN RAISE EXCEPTION 'AGGREGATE_AUTO_RETRY_BUDGET_FAIL';END IF;
r:=ccpun_admin.admin_enqueue_marketing_analysis(aid,other,'unused-replay-payload',repeat('z',24),repeat('z',24),1::smallint,repeat('a',64),repeat('c',64));
IF r->>'status'<>'failed' OR(r->>'retryEligible')::boolean OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_job WHERE job_id=other) OR(SELECT count(*) FROM ccpun_admin.marketing_analysis_attempt WHERE analysis_id=aid)<>2 THEN RAISE EXCEPTION 'UNCHANGED_PROFILE_BLIND_RETRY';END IF;
r:=ccpun_admin.admin_read_marketing_analysis('this_week');IF r#>>'{lastGood,analysisId}'<>good_id::text THEN RAISE EXCEPTION 'LAST_GOOD_LOST';END IF;
IF has_table_privilege('ccpun_admin_runtime','ccpun_admin.marketing_analysis_attempt','SELECT') OR has_function_privilege('ccpun_local_ai_runtime','ccpun_admin.admin_enqueue_marketing_analysis(uuid,uuid,text,text,text,smallint,text,text)','EXECUTE') THEN RAISE EXCEPTION 'RETRY_PRIVILEGE_EXPANDED';END IF;
RAISE NOTICE 'MARKETING_RETRY_V3_FIXTURE_PASS';END $retry_fixture$;

DO $retry_guards$ DECLARE p jsonb;r jsonb;aid uuid;jid uuid;next_id uuid;profile jsonb;legacy jsonb;case_no integer;BEGIN
p:=jsonb_build_object('promptVersion','marketing-performance-v1','analysisType','weekly_performance','snapshotHash',repeat('1',64),'sourceManifestHash',repeat('2',64),'period',jsonb_build_object('key','rolling_7','currentStart','2026-09-18','currentEnd','2026-09-24'),'evidence',jsonb_build_array(jsonb_build_object('id','e1')),'coverage',jsonb_build_object('prepared',1,'sent',1,'dropped',0));
profile:=jsonb_build_object('version','marketing-qwen17-4096-768-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false);
legacy:=profile||jsonb_build_object('version','marketing-qwen17-4096-384-v1','numPredict',384);
FOR case_no IN 7..9 LOOP
aid:=gen_random_uuid();jid:=gen_random_uuid();next_id:=gen_random_uuid();
PERFORM ccpun_admin.admin_prepare_marketing_analysis(aid,p,repeat(case_no::text,64),'[]');
INSERT INTO ccpun_admin.local_ai_job(job_id,task_type,data_class,ciphertext_b64,nonce_b64,auth_tag_b64,key_version,idempotency_key,actor_digest,request_fingerprint,queue_class,priority,deadline_at,status,attempt_count,max_attempts,error_category,completed_at)
VALUES(jid,'marketing-analysis','public-safe','synthetic-guard',repeat('x',24),repeat('x',24),1,encode(sha256(convert_to(jid::text,'UTF8')),'hex'),repeat('c',64),repeat(case_no::text,64),'batch',20,now()+interval '6 hours','failed',CASE WHEN case_no=8 THEN 3 ELSE 1 END,3,CASE WHEN case_no=9 THEN 'ollama-timeout' ELSE 'model-output-invalid' END,now());
UPDATE ccpun_admin.marketing_analysis SET job_id=jid WHERE analysis_id=aid;
IF case_no<>7 THEN INSERT INTO ccpun_admin.marketing_analysis_attempt(analysis_id,generation,job_id,inference_profile,provenance) VALUES(aid,1,jid,legacy,'audited-legacy-384');END IF;
r:=ccpun_admin.admin_enqueue_marketing_analysis(aid,next_id,'synthetic-guard-new',repeat('y',24),repeat('y',24),1::smallint,repeat(case_no::text,64),repeat('c',64));
IF r->>'status'<>'failed' OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_job WHERE job_id=next_id) OR(SELECT job_id FROM ccpun_admin.marketing_analysis WHERE analysis_id=aid)<>jid THEN RAISE EXCEPTION 'UNPROVEN_BUDGET_OR_TRANSIENT_RETRY_%',case_no;END IF;
IF case_no=8 AND r->>'retryOutcome'<>'attempt-budget-exhausted' THEN RAISE EXCEPTION 'FULL_BUDGET_GUARD_FAIL';END IF;
END LOOP;
aid:=gen_random_uuid();jid:=gen_random_uuid();PERFORM ccpun_admin.admin_prepare_marketing_analysis(aid,p,repeat('0',64),'[]');
r:=ccpun_admin.admin_enqueue_marketing_analysis(aid,jid,'synthetic-fresh-768',repeat('y',24),repeat('y',24),1::smallint,repeat('0',64),repeat('c',64));
IF r->>'status'<>'queued' OR(r->>'retried')::boolean OR NOT EXISTS(SELECT 1 FROM ccpun_admin.marketing_analysis_attempt WHERE job_id=jid AND generation=1 AND parent_failed_job_id IS NULL AND inference_profile=profile) THEN RAISE EXCEPTION 'FRESH_PROFILE_NOT_RECORDED';END IF;
IF(SELECT max_attempts FROM ccpun_admin.local_ai_job WHERE job_id=jid)<>3 THEN RAISE EXCEPTION 'FRESH_JOB_BUDGET_FAIL';END IF;
UPDATE ccpun_admin.local_ai_job SET status='failed',attempt_count=1,error_category='model-output-invalid',completed_at=now() WHERE job_id=jid;
r:=ccpun_admin.admin_enqueue_marketing_analysis(aid,gen_random_uuid(),'synthetic-no-repeat',repeat('y',24),repeat('y',24),1::smallint,repeat('0',64),repeat('c',64));
IF r->>'status'<>'failed' OR(SELECT count(*) FROM ccpun_admin.marketing_analysis_attempt WHERE analysis_id=aid)<>1 THEN RAISE EXCEPTION 'FRESH_SAME_PROFILE_RETRY_FAIL';END IF;
RAISE NOTICE 'MARKETING_RETRY_V3_GUARDS_PASS';END $retry_guards$;

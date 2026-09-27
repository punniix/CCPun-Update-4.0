BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN 1 ELSE 0 END AS role_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton=true AND database_name='neondb' AND migration_version='20260919_local_ai_control_plane_v1' AND migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6' AND ((lane='uat' AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394') OR (lane='production' AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w'))) THEN 1 ELSE 0 END AS identity_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260920_local_ai_production_operations_v2' AND checksum='sha256:deb9f6761364a61bae275d5226f341ca021087da4116bc3f4703bd8b8c46fb1f') THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260927_analytics_local_review_v3' AND checksum='sha256:df860b9218c535786bbdc3d6459e18cc76d76e6ea3b35c3d5e1ef64241b5d5ca') THEN 1 ELSE 0 END AS v3_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260927_analytics_local_review_v4'));
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260927_analytics_local_review_v4' AND checksum<>'sha256:307f9da387d20f4de7865636d2e446afd29a50abda6ed8b78f4a7fecae97d3ef') THEN 1 ELSE 0 END AS checksum_guard;
-- checksum-source-begin
CREATE OR REPLACE FUNCTION ccpun_admin.admin_enqueue_analytics_review_v4(
 p_date date,p_job_id uuid,p_ciphertext_b64 text,p_nonce_b64 text,p_auth_tag_b64 text,p_key_version smallint,p_request_fingerprint text,p_actor_digest text
) RETURNS TABLE(job_id uuid,status text,reused boolean,outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $enqueue$
DECLARE existing_job ccpun_admin.local_ai_job%ROWTYPE; day_key text;
BEGIN
 IF p_date IS NULL OR p_date<>(now() AT TIME ZONE 'Asia/Bangkok')::date THEN RAISE EXCEPTION 'ANALYTICS_REVIEW_DATE_INVALID'; END IF;
 day_key:=encode(sha256(convert_to('analytics-review:analytics-review:'||p_date::text||':v2','UTF8')),'hex');
 -- Same lock as v2: the lookup and delegated insert are one atomic queue operation.
 PERFORM pg_advisory_xact_lock(hashtext('ccpun-local-ai-enqueue-v2'));
 SELECT j.* INTO existing_job FROM ccpun_admin.local_ai_job j WHERE j.idempotency_key=day_key;
 IF FOUND THEN
   IF existing_job.task_type<>'analytics-review' OR existing_job.data_class<>'public-safe' THEN RAISE EXCEPTION 'ANALYTICS_REVIEW_IDENTITY_INVALID'; END IF;
   RETURN QUERY SELECT existing_job.job_id,existing_job.status,true,'reused'::text; RETURN;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at>now()-interval '90 seconds' AND h.ollama_ready AND NOT h.accepting_private_jobs AND h.model_name='qwen3:1.7b' AND h.details_json->>'analyticsReviewVersion'='analytics-review-v2')
 OR EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at>now()-interval '90 seconds' AND h.details_json->>'analyticsReviewVersion' IS DISTINCT FROM 'analytics-review-v2')
 THEN RAISE EXCEPTION 'ANALYTICS_REVIEW_WORKER_NOT_READY'; END IF;
 RETURN QUERY SELECT * FROM ccpun_admin.admin_enqueue_local_ai_job_v2(p_job_id,'analytics-review','public-safe',p_ciphertext_b64,p_nonce_b64,p_auth_tag_b64,p_key_version,day_key,p_request_fingerprint,p_actor_digest,'batch');
END $enqueue$;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_analytics_review_v4()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $read$
WITH scoped AS (
 SELECT j.job_id,j.status,j.review_status,j.model_name,j.created_at,j.completed_at,
 CASE WHEN j.status='succeeded' AND j.review_status IN ('pending','approved') THEN j.output_json ELSE NULL END AS output_json,
 j.idempotency_key
 FROM ccpun_admin.local_ai_job j WHERE j.task_type='analytics-review' AND j.data_class='public-safe'
), shaped AS (
 SELECT *, jsonb_build_object('jobId',job_id,'status',status,'reviewStatus',review_status,'modelName',model_name,'createdAt',created_at,'completedAt',completed_at,'output',output_json) AS value FROM scoped
)
SELECT jsonb_build_object(
 'latest',(SELECT value FROM shaped ORDER BY created_at DESC,job_id DESC LIMIT 1),
 'lastGood',(SELECT value FROM shaped WHERE status='succeeded' AND review_status IN ('pending','approved') ORDER BY completed_at DESC,job_id DESC LIMIT 1),
 'dayJob',(SELECT value FROM shaped WHERE idempotency_key=encode(sha256(convert_to('analytics-review:analytics-review:'||(now() AT TIME ZONE 'Asia/Bangkok')::date::text||':v2','UTF8')),'hex') LIMIT 1),
 'workerReady',EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at>now()-interval '90 seconds' AND h.ollama_ready AND NOT h.accepting_private_jobs AND h.model_name='qwen3:1.7b' AND h.details_json->>'analyticsReviewVersion'='analytics-review-v2')
   AND NOT EXISTS(SELECT 1 FROM ccpun_admin.local_ai_worker_heartbeat h WHERE h.last_seen_at>now()-interval '90 seconds' AND h.details_json->>'analyticsReviewVersion' IS DISTINCT FROM 'analytics-review-v2')
)
$read$;
REVOKE ALL ON FUNCTION ccpun_admin.admin_enqueue_analytics_review_v4(date,uuid,text,text,text,smallint,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_admin.admin_read_analytics_review_v4() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_enqueue_analytics_review_v4(date,uuid,text,text,text,smallint,text,text),ccpun_admin.admin_read_analytics_review_v4() TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO ccpun_admin.schema_migration(version,checksum) VALUES('20260927_analytics_local_review_v4','sha256:307f9da387d20f4de7865636d2e446afd29a50abda6ed8b78f4a7fecae97d3ef') ON CONFLICT(version) DO NOTHING;
COMMIT;

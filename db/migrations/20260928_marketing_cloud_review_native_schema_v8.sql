BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_cloud_review_retry_v7' AND checksum='sha256:d9499a69612d230e87ce606f4121fc0ff94b26748b8e935e051c561404078dcc') THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260928_marketing_cloud_review_native_schema_v8'));
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_cloud_review_native_schema_v8') THEN 1 ELSE 0 END AS not_already_applied_guard;
-- checksum-source-begin
CREATE TABLE ccpun_admin.marketing_cloud_native_schema_retry_audit (
  analysis_id uuid PRIMARY KEY REFERENCES ccpun_admin.marketing_analysis(analysis_id),
  previous_reservation_id uuid NOT NULL UNIQUE,
  previous_failure_code text NOT NULL CHECK(previous_failure_code='api-error'),
  previous_completed_at timestamptz NOT NULL,
  retry_reservation_id uuid NOT NULL UNIQUE,
  retry_transport_version text NOT NULL CHECK(retry_transport_version='n8n-native-openai-string-schema-v2'),
  retried_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ccpun_admin.marketing_cloud_native_schema_retry_audit FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_reserve_marketing_cloud_review_v1(p_id uuid,p_hash text,p_reservation uuid,p_prompt_version text,p_prompt_digest text,p_local_digest text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $reserve_review$
DECLARE a ccpun_admin.marketing_analysis;j ccpun_admin.local_ai_job;c ccpun_admin.marketing_cloud_attempt;r ccpun_admin.marketing_cloud_retry_audit;
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 SELECT * INTO j FROM ccpun_admin.local_ai_job WHERE job_id=a.job_id;
 IF a.analysis_id IS NULL OR j.job_id IS NULL OR a.prompt_version<>'marketing-performance-v3' OR a.validation_status<>'validated' OR j.status<>'succeeded' OR j.output_digest IS DISTINCT FROM a.output_digest OR p_local_digest IS DISTINCT FROM a.output_digest OR p_local_digest IS NULL OR p_local_digest!~'^[a-f0-9]{64}$' OR p_prompt_version<>'marketing-performance-review-v1' OR p_prompt_digest IS NULL OR p_prompt_digest!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'MARKETING_REVIEW_IDENTITY_INVALID';END IF;
 IF NOT ccpun_admin.marketing_v3_review_eligible(a) THEN RETURN jsonb_build_object('analysisId',p_id,'status','not-needed','mode','review','reused',false);END IF;
 SELECT * INTO c FROM ccpun_admin.marketing_cloud_attempt WHERE analysis_id=p_id FOR UPDATE;
 IF FOUND THEN
  SELECT * INTO r FROM ccpun_admin.marketing_cloud_retry_audit WHERE analysis_id=p_id;
  IF c.mode='review' AND c.status='failed' AND c.failure_code='api-error' AND c.cloud_prompt_version='marketing-performance-review-v1' AND c.cloud_prompt_digest=p_prompt_digest AND c.local_output_digest=p_local_digest AND r.analysis_id=p_id AND r.retry_reservation_id=c.reservation_id AND NOT EXISTS(SELECT 1 FROM ccpun_admin.marketing_cloud_native_schema_retry_audit x WHERE x.analysis_id=p_id) THEN
   INSERT INTO ccpun_admin.marketing_cloud_native_schema_retry_audit(analysis_id,previous_reservation_id,previous_failure_code,previous_completed_at,retry_reservation_id,retry_transport_version)
   VALUES(p_id,c.reservation_id,c.failure_code,c.completed_at,p_reservation,'n8n-native-openai-string-schema-v2');
   UPDATE ccpun_admin.marketing_cloud_attempt SET reservation_id=p_reservation,status='reserved',reserved_at=now(),completed_at=NULL,output_json=NULL,output_digest=NULL,input_tokens=NULL,output_tokens=NULL,failure_code=NULL WHERE analysis_id=p_id AND reservation_id=c.reservation_id AND status='failed';
   IF NOT FOUND THEN RAISE EXCEPTION 'MARKETING_REVIEW_SCHEMA_RETRY_CONCURRENT_CHANGE';END IF;
   RETURN jsonb_build_object('analysisId',p_id,'inputHash',p_hash,'reservationId',p_reservation,'localOutputDigest',p_local_digest,'status','reserved','mode','review','reused',false,'retry',true,'attemptCount',3);
  END IF;
  RETURN jsonb_build_object('analysisId',p_id,'status',c.status,'mode',c.mode,'reused',true,'retry',false);
 END IF;
 INSERT INTO ccpun_admin.marketing_cloud_attempt(analysis_id,input_hash,reservation_id,prompt_version,cloud_prompt_version,cloud_prompt_digest,mode,local_output_digest)
 VALUES(p_id,p_hash,p_reservation,'marketing-performance-v3',p_prompt_version,p_prompt_digest,'review',p_local_digest);
 RETURN jsonb_build_object('analysisId',p_id,'inputHash',p_hash,'reservationId',p_reservation,'localOutputDigest',p_local_digest,'status','reserved','mode','review','reused',false,'retry',false,'attemptCount',1);
END $reserve_review$;
REVOKE ALL ON FUNCTION ccpun_admin.admin_reserve_marketing_cloud_review_v1(uuid,text,uuid,text,text,text) FROM PUBLIC,ccpun_local_ai_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_reserve_marketing_cloud_review_v1(uuid,text,uuid,text,text,text) TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO ccpun_admin.schema_migration(version,checksum) VALUES('20260928_marketing_cloud_review_native_schema_v8','sha256:8834559ef68c28935289076312fc5dae931a95b99a6504fc05e83070b7cab4ac');
COMMIT;

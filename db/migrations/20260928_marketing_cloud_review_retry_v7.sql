BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN 1 ELSE 0 END AS role_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND database_name='neondb' AND migration_version='20260919_local_ai_control_plane_v1' AND migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6' AND ((lane='uat' AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394') OR (lane='production' AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w'))) THEN 1 ELSE 0 END AS identity_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_ai_diagnosis_v6' AND checksum='sha256:899f1b9ca8cda959ecbf5c76bf7905d0084075f0b7bac6dba323a61a82f81ddf') THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260928_marketing_cloud_review_retry_v7'));
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_cloud_review_retry_v7') THEN 1 ELSE 0 END AS not_already_applied_guard;
-- checksum-source-begin
CREATE TABLE ccpun_admin.marketing_cloud_retry_audit (
  analysis_id uuid PRIMARY KEY REFERENCES ccpun_admin.marketing_analysis(analysis_id),
  previous_reservation_id uuid NOT NULL UNIQUE,
  previous_provider text NOT NULL CHECK(previous_provider='openai'),
  previous_model text NOT NULL CHECK(previous_model='gpt-6-luna'),
  previous_status text NOT NULL CHECK(previous_status='failed'),
  previous_failure_code text NOT NULL CHECK(previous_failure_code='api-error'),
  previous_reserved_at timestamptz NOT NULL,
  previous_completed_at timestamptz NOT NULL,
  previous_cloud_prompt_version text NOT NULL CHECK(previous_cloud_prompt_version='marketing-performance-review-v1'),
  previous_cloud_prompt_digest text NOT NULL CHECK(previous_cloud_prompt_digest~'^[a-f0-9]{64}$'),
  previous_local_output_digest text NOT NULL CHECK(previous_local_output_digest~'^[a-f0-9]{64}$'),
  retry_reservation_id uuid NOT NULL UNIQUE,
  retry_transport_version text NOT NULL CHECK(retry_transport_version='n8n-native-openai-v1'),
  retried_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ccpun_admin.marketing_cloud_retry_audit FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;

CREATE OR REPLACE FUNCTION ccpun_admin.admin_reserve_marketing_cloud_review_v1(p_id uuid,p_hash text,p_reservation uuid,p_prompt_version text,p_prompt_digest text,p_local_digest text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $reserve_review$
DECLARE a ccpun_admin.marketing_analysis;j ccpun_admin.local_ai_job;c ccpun_admin.marketing_cloud_attempt;
BEGIN
 SELECT * INTO a FROM ccpun_admin.marketing_analysis WHERE analysis_id=p_id AND input_hash=p_hash FOR UPDATE;
 SELECT * INTO j FROM ccpun_admin.local_ai_job WHERE job_id=a.job_id;
 IF a.analysis_id IS NULL OR j.job_id IS NULL OR a.prompt_version<>'marketing-performance-v3' OR a.validation_status<>'validated' OR j.status<>'succeeded' OR j.output_digest IS DISTINCT FROM a.output_digest OR p_local_digest IS DISTINCT FROM a.output_digest OR p_local_digest IS NULL OR p_local_digest!~'^[a-f0-9]{64}$' OR p_prompt_version<>'marketing-performance-review-v1' OR p_prompt_digest IS NULL OR p_prompt_digest!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'MARKETING_REVIEW_IDENTITY_INVALID';END IF;
 IF NOT ccpun_admin.marketing_v3_review_eligible(a) THEN RETURN jsonb_build_object('analysisId',p_id,'status','not-needed','mode','review','reused',false);END IF;
 SELECT * INTO c FROM ccpun_admin.marketing_cloud_attempt WHERE analysis_id=p_id FOR UPDATE;
 IF FOUND THEN
  IF c.mode='review' AND c.status='failed' AND c.failure_code='api-error' AND c.cloud_prompt_version='marketing-performance-review-v1' AND c.cloud_prompt_digest=p_prompt_digest AND c.local_output_digest=p_local_digest AND NOT EXISTS(SELECT 1 FROM ccpun_admin.marketing_cloud_retry_audit r WHERE r.analysis_id=p_id) THEN
   INSERT INTO ccpun_admin.marketing_cloud_retry_audit(analysis_id,previous_reservation_id,previous_provider,previous_model,previous_status,previous_failure_code,previous_reserved_at,previous_completed_at,previous_cloud_prompt_version,previous_cloud_prompt_digest,previous_local_output_digest,retry_reservation_id,retry_transport_version)
   VALUES(c.analysis_id,c.reservation_id,c.provider,c.model,c.status,c.failure_code,c.reserved_at,c.completed_at,c.cloud_prompt_version,c.cloud_prompt_digest,c.local_output_digest,p_reservation,'n8n-native-openai-v1');
   UPDATE ccpun_admin.marketing_cloud_attempt
      SET reservation_id=p_reservation,status='reserved',reserved_at=now(),completed_at=NULL,output_json=NULL,output_digest=NULL,input_tokens=NULL,output_tokens=NULL,failure_code=NULL
    WHERE analysis_id=p_id AND reservation_id=c.reservation_id AND status='failed';
   IF NOT FOUND THEN RAISE EXCEPTION 'MARKETING_REVIEW_RETRY_CONCURRENT_CHANGE';END IF;
   RETURN jsonb_build_object('analysisId',p_id,'inputHash',p_hash,'reservationId',p_reservation,'localOutputDigest',p_local_digest,'status','reserved','mode','review','reused',false,'retry',true,'attemptCount',2);
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
INSERT INTO ccpun_admin.schema_migration(version,checksum) VALUES('20260928_marketing_cloud_review_retry_v7','sha256:d9499a69612d230e87ce606f4121fc0ff94b26748b8e935e051c561404078dcc');
COMMIT;

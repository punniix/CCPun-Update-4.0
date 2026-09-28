BEGIN;
SET LOCAL lock_timeout='5s';
SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN 1 ELSE 0 END AS role_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND database_name='neondb' AND migration_version='20260919_local_ai_control_plane_v1' AND migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6' AND ((lane='uat' AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394') OR (lane='production' AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w'))) THEN 1 ELSE 0 END AS identity_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_cloud_fallback_v1' AND checksum='sha256:c582ea59bffd69322fe3fe07922c2681b12b019cff7921a9735bbf5a03ae0ad3') THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260928_marketing_cloud_prompt_v2'));
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_cloud_prompt_v2' AND checksum<>'sha256:0fdd5ea1ac71e1de301536336eead7cc839973a0c3f8492dd10651226a79ee7c') THEN 1 ELSE 0 END AS checksum_guard;
-- checksum-source-begin
ALTER TABLE ccpun_admin.marketing_cloud_attempt
 ADD COLUMN cloud_prompt_version text NOT NULL DEFAULT 'marketing-performance-cloud-v1' CHECK(cloud_prompt_version='marketing-performance-cloud-v1'),
 ADD COLUMN cloud_prompt_digest text CHECK(cloud_prompt_digest IS NULL OR cloud_prompt_digest~'^[a-f0-9]{64}$'),
 ADD CONSTRAINT marketing_cloud_ready_prompt_check CHECK(status<>'ready' OR cloud_prompt_digest IS NOT NULL);
CREATE FUNCTION ccpun_admin.admin_reserve_marketing_cloud_v2(p_id uuid,p_hash text,p_reservation uuid,p_prompt_version text,p_prompt_digest text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ccpun_admin AS $reserve_v2$
DECLARE r jsonb;
BEGIN
 IF p_prompt_version IS DISTINCT FROM 'marketing-performance-cloud-v1' OR p_prompt_digest IS NULL OR p_prompt_digest!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'MARKETING_CLOUD_PROMPT_INVALID';END IF;
 r:=ccpun_admin.admin_reserve_marketing_cloud(p_id,p_hash,p_reservation);
 IF r->>'status'='reserved' AND r->>'reused'='false' THEN
  UPDATE ccpun_admin.marketing_cloud_attempt SET cloud_prompt_digest=p_prompt_digest WHERE analysis_id=p_id AND reservation_id=p_reservation AND status='reserved' AND cloud_prompt_version=p_prompt_version AND cloud_prompt_digest IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'MARKETING_CLOUD_PROMPT_BIND_FAILED';END IF;
  RETURN r||jsonb_build_object('cloudPromptVersion',p_prompt_version,'cloudPromptDigest',p_prompt_digest);
 END IF;
 RETURN r;
END $reserve_v2$;
REVOKE ALL ON FUNCTION ccpun_admin.admin_reserve_marketing_cloud(uuid,text,uuid) FROM ccpun_admin_runtime;
REVOKE ALL ON FUNCTION ccpun_admin.admin_reserve_marketing_cloud_v2(uuid,text,uuid,text,text) FROM PUBLIC,ccpun_admin_runtime,ccpun_local_ai_runtime;
GRANT EXECUTE ON FUNCTION ccpun_admin.admin_reserve_marketing_cloud_v2(uuid,text,uuid,text,text) TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO ccpun_admin.schema_migration(version,checksum) VALUES('20260928_marketing_cloud_prompt_v2','sha256:0fdd5ea1ac71e1de301536336eead7cc839973a0c3f8492dd10651226a79ee7c') ON CONFLICT(version) DO NOTHING;
COMMIT;

BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(hashtext('ccpun_admin:20260928_marketing_analysis_lineage_backfill_v5'));
SELECT 1 / CASE WHEN current_database()='neondb' AND EXISTS (
 SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_ai_repair_retry_v4'
 AND checksum='sha256:27d012741dd64bbb1d5378ecb4bcd165a9e379b8046342d13019d2dec67290db'
) AND NOT EXISTS (
 SELECT 1 FROM ccpun_admin.schema_migration WHERE version='20260928_marketing_analysis_lineage_backfill_v5'
) THEN 1 ELSE 0 END AS prerequisite_guard;
SELECT 1 / CASE WHEN EXISTS (
 SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND database_name='neondb'
 AND migration_version='20260919_local_ai_control_plane_v1'
 AND migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6'
 AND ((lane='uat' AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394')
 OR (lane='production' AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w'))
) THEN 1 ELSE 0 END AS identity_guard;
-- ponytail: one historical job missed v3 lineage during the 06:00 run; exact IDs and the old v2 key bound this repair.
-- Worker source 401344b4 (deployed before this job) used num_predict=768 for marketing-analysis.
-- checksum-source-begin
INSERT INTO ccpun_admin.marketing_analysis_attempt(analysis_id,generation,job_id,inference_profile,provenance)
SELECT a.analysis_id,1,j.job_id,
 jsonb_build_object('version','marketing-qwen17-4096-768-v1','model','qwen3:1.7b','promptVersion','marketing-performance-v1','numCtx',4096,'numPredict',768,'temperature',0,'think',false),
 'worker-heartbeat-768'
FROM ccpun_admin.marketing_analysis a JOIN ccpun_admin.local_ai_job j ON j.job_id=a.job_id
WHERE EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND lane='production')
 AND a.analysis_id='7ce3f4bb-11ac-4df3-a316-c866b07c6830'::uuid
 AND j.job_id='17599c44-154b-4c7d-84fd-a4341e68d0dd'::uuid
 AND a.input_hash='90240baf14e0dfbe3df4363e93dace5c6bf281e68e0442dd7731a709796a6176'
 AND a.analysis_type='monthly_performance' AND a.prompt_version='marketing-performance-v1'
 AND a.validation_status='pending' AND j.task_type='marketing-analysis' AND j.data_class='public-safe'
 AND j.status='failed' AND j.error_category='model-output-invalid' AND j.attempt_count=1
 AND j.request_fingerprint=a.input_hash
 AND j.idempotency_key=encode(sha256(convert_to('marketing-analysis:'||a.input_hash,'UTF8')),'hex')
 AND j.created_at BETWEEN '2026-09-27T23:00:00Z'::timestamptz AND '2026-09-27T23:01:00Z'::timestamptz
 AND j.completed_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM ccpun_admin.marketing_analysis_attempt t WHERE t.analysis_id=a.analysis_id);
SELECT 1 / CASE WHEN (
 SELECT lane='uat' FROM ccpun_admin.local_ai_identity WHERE singleton
) OR (
 SELECT count(*)=1 FROM ccpun_admin.marketing_analysis_attempt
 WHERE analysis_id='7ce3f4bb-11ac-4df3-a316-c866b07c6830'::uuid
 AND job_id='17599c44-154b-4c7d-84fd-a4341e68d0dd'::uuid
 AND generation=1 AND provenance='worker-heartbeat-768'
) THEN 1 ELSE 0 END AS exact_backfill_guard;
-- checksum-source-end
INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260928_marketing_analysis_lineage_backfill_v5','sha256:076074f91e2466c4f07aca46386b35271d96e2f3d714e570fc62c25f7ef197f3');
COMMIT;

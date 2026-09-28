SELECT 1 / CASE WHEN EXISTS (
 SELECT 1 FROM ccpun_admin.schema_migration
 WHERE version='20260928_marketing_analysis_lineage_backfill_v5'
 AND checksum='sha256:076074f91e2466c4f07aca46386b35271d96e2f3d714e570fc62c25f7ef197f3'
) AND (
 SELECT CASE WHEN lane='production' THEN EXISTS (
  SELECT 1 FROM ccpun_admin.marketing_analysis_attempt
  WHERE analysis_id='7ce3f4bb-11ac-4df3-a316-c866b07c6830'::uuid
  AND job_id='17599c44-154b-4c7d-84fd-a4341e68d0dd'::uuid
  AND generation=1 AND provenance='worker-heartbeat-768'
 ) ELSE NOT EXISTS (
  SELECT 1 FROM ccpun_admin.marketing_analysis_attempt
  WHERE analysis_id='7ce3f4bb-11ac-4df3-a316-c866b07c6830'::uuid
 ) END FROM ccpun_admin.local_ai_identity WHERE singleton
) THEN 1 ELSE 0 END AS lineage_backfill_verified;

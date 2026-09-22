SELECT
  i.lane,i.project_id,i.branch_id,i.endpoint_id,i.database_name,
  EXISTS(
    SELECT 1 FROM ccpun_admin.schema_migration
    WHERE version='20260922_local_ai_key_rotation_v2'
      AND checksum='sha256:0526d72b54fdd7127638d68cff85622545f3ebcddd1a07b7b4b5f317d1bfdaeb'
  ) AS key_rotation_ledger_current,
  EXISTS(
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='ccpun_admin.local_ai_job'::regclass
      AND c.conname='local_ai_job_key_version_v2_check'
      AND c.convalidated
      AND regexp_replace(lower(pg_get_constraintdef(c.oid,false)),'[[:space:]]','','g')=ANY(ARRAY[
        'check((key_version=any(array[1,2])))',
        'check((key_version=any(array[(1)::smallint,(2)::smallint])))',
        'check((key_version=any(array[''1''::smallint,''2''::smallint])))',
        'check((key_version=any(array[(1)::int2,(2)::int2])))',
        'check((key_version=any(array[''1''::int2,''2''::int2])))'
      ])
  ) AS key_version_constraint_exact,
  NOT EXISTS(
    SELECT 1 FROM ccpun_admin.local_ai_job WHERE key_version NOT IN (1,2)
  ) AS stored_key_versions_allowed
FROM ccpun_admin.local_ai_identity i
WHERE i.singleton=true
  AND i.lane IN ('uat','production')
  AND i.migration_version='20260919_local_ai_control_plane_v1'
  AND i.migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6';

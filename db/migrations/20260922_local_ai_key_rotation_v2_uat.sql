BEGIN;
SET LOCAL lock_timeout = '5s';

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ccpun_admin.local_ai_identity
    WHERE singleton=true
      AND lane IN ('uat','production')
      AND migration_version='20260919_local_ai_control_plane_v1'
      AND migration_checksum='sha256:b49fe8d024c279710eb4eb3b45b06e40ffc960a3ec57b21792c63c98514ceef6'
  ) OR NOT EXISTS (
    SELECT 1 FROM ccpun_admin.schema_migration
    WHERE version='20260920_local_ai_production_operations_v2'
      AND checksum='sha256:deb9f6761364a61bae275d5226f341ca021087da4116bc3f4703bd8b8c46fb1f'
  ) THEN
    RAISE EXCEPTION 'LOCAL_AI_KEY_ROTATION_BASELINE_MISMATCH';
  END IF;
  IF EXISTS (SELECT 1 FROM ccpun_admin.local_ai_job WHERE key_version NOT IN (1,2)) THEN
    RAISE EXCEPTION 'LOCAL_AI_KEY_VERSION_OUTSIDE_ALLOWLIST';
  END IF;
END
$guard$;

-- checksum-source-begin
DO $constraint$
DECLARE
  allowed_definitions CONSTANT text[] := ARRAY[
    'check((key_version=any(array[1,2])))',
    'check((key_version=any(array[(1)::smallint,(2)::smallint])))',
    'check((key_version=any(array[''1''::smallint,''2''::smallint])))',
    'check((key_version=any(array[(1)::int2,(2)::int2])))',
    'check((key_version=any(array[''1''::int2,''2''::int2])))'
  ];
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='ccpun_admin.local_ai_job'::regclass
      AND conname='local_ai_job_key_version_v2_check'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='ccpun_admin.local_ai_job'::regclass
        AND c.conname='local_ai_job_key_version_v2_check'
        AND c.convalidated
        AND regexp_replace(lower(pg_get_constraintdef(c.oid,false)),'[[:space:]]','','g')=ANY(allowed_definitions)
    ) THEN
      RAISE EXCEPTION 'LOCAL_AI_KEY_VERSION_CONSTRAINT_DRIFT';
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='ccpun_admin.local_ai_job'::regclass
      AND conname='local_ai_job_key_version_check'
  ) THEN
    ALTER TABLE ccpun_admin.local_ai_job
      DROP CONSTRAINT local_ai_job_key_version_check;
    ALTER TABLE ccpun_admin.local_ai_job
      ADD CONSTRAINT local_ai_job_key_version_v2_check
      CHECK (key_version IN (1,2)) NOT VALID;
    ALTER TABLE ccpun_admin.local_ai_job
      VALIDATE CONSTRAINT local_ai_job_key_version_v2_check;
  ELSE
    RAISE EXCEPTION 'LOCAL_AI_KEY_VERSION_CONSTRAINT_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='ccpun_admin.local_ai_job'::regclass
      AND c.conname='local_ai_job_key_version_v2_check'
      AND c.convalidated
      AND regexp_replace(lower(pg_get_constraintdef(c.oid,false)),'[[:space:]]','','g')=ANY(allowed_definitions)
  ) THEN
    RAISE EXCEPTION 'LOCAL_AI_KEY_VERSION_CONSTRAINT_DRIFT';
  END IF;
END
$constraint$;
-- checksum-source-end

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260922_local_ai_key_rotation_v2','sha256:0526d72b54fdd7127638d68cff85622545f3ebcddd1a07b7b4b5f317d1bfdaeb')
ON CONFLICT(version) DO NOTHING;

DO $ledger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ccpun_admin.schema_migration
    WHERE version='20260922_local_ai_key_rotation_v2'
      AND checksum='sha256:0526d72b54fdd7127638d68cff85622545f3ebcddd1a07b7b4b5f317d1bfdaeb'
  ) THEN
    RAISE EXCEPTION 'LOCAL_AI_KEY_ROTATION_LEDGER_MISMATCH';
  END IF;
END
$ledger$;

COMMIT;

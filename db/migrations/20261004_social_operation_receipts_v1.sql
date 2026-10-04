BEGIN;

DO $migration_guard$
DECLARE current_checksum text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ccpun_social:20261004_social_operation_receipts_v1'));
  IF current_database()<>'neondb' OR NOT EXISTS (
    SELECT 1 FROM ccpun_social.system_identity WHERE singleton AND database_name='neondb' AND
      (project_id,branch_id,endpoint_id) IN (
        ('young-term-47483330','br-crimson-mouse-az7ajkv8','ep-mute-frost-aztvz394'),
        ('lively-bar-43618798','br-long-resonance-b3ys5xrv','ep-broad-butterfly-b3ro7u8w'))
  ) THEN RAISE EXCEPTION 'SOCIAL_OPERATION_RECEIPT_TARGET_MISMATCH'; END IF;
  IF NOT EXISTS (SELECT 1 FROM ccpun_social.schema_migration
    WHERE version='20260901_website_42_social_publication_execution_v1'
      AND checksum='sha256:9c9a95c3f29d0c912b6b0c226fea873569809f49ebc8f1a66ab32699bde85bba')
  THEN RAISE EXCEPTION 'SOCIAL_OPERATION_RECEIPT_PREREQUISITE_MISSING'; END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid IN ('ccpun_social.social_publication'::regclass,
    'ccpun_social.social_publication_job'::regclass,'ccpun_social.social_execution_audit'::regclass)
    AND (relrowsecurity OR relforcerowsecurity)) OR EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
    AND (tgrelid IN ('ccpun_social.social_publication'::regclass,'ccpun_social.social_execution_audit'::regclass)
      OR (tgrelid='ccpun_social.social_publication_job'::regclass AND tgname<>'social_operation_receipts_guard')))
  THEN RAISE EXCEPTION 'SOCIAL_OPERATION_RECEIPT_UNSUPPORTED_POLICIES'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.contype='f' AND c.convalidated AND NOT c.condeferrable
    AND NOT c.condeferred AND c.conrelid='ccpun_social.social_publication_job'::regclass
    AND c.confrelid='ccpun_social.social_publication'::regclass
    AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='publication_id')]::smallint[]
    AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='id')]::smallint[])
    OR NOT has_table_privilege('ccpun_social_runtime','ccpun_social.social_execution_audit','INSERT')
    OR has_any_column_privilege('ccpun_social_runtime','ccpun_social.social_execution_audit','SELECT')
    OR has_any_column_privilege('ccpun_social_runtime','ccpun_social.social_execution_audit','UPDATE,REFERENCES')
    OR has_table_privilege('ccpun_social_runtime','ccpun_social.social_execution_audit','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  THEN RAISE EXCEPTION 'SOCIAL_OPERATION_RECEIPT_PRIVILEGE_OR_FK_MISMATCH'; END IF;
  SELECT checksum INTO current_checksum FROM ccpun_social.schema_migration
    WHERE version='20261004_social_operation_receipts_v1';
  IF current_checksum IS NOT NULL AND current_checksum<>'sha256:361b035bf36ee32a439cb30b0fa5924acecff0bedc4d81360ee506e6b6c10981'
  THEN RAISE EXCEPTION 'SOCIAL_OPERATION_RECEIPT_CHECKSUM_MISMATCH'; END IF;
  IF current_checksum IS NULL AND (EXISTS (SELECT 1 FROM pg_attribute
    WHERE attrelid='ccpun_social.social_publication_job'::regclass AND attname='mutation_receipts' AND NOT attisdropped)
    OR to_regprocedure('ccpun_social.guard_social_operation_receipts()') IS NOT NULL)
  THEN RAISE EXCEPTION 'SOCIAL_OPERATION_RECEIPT_UNTRACKED_SCHEMA'; END IF;
  IF current_checksum IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_proc
    WHERE oid=to_regprocedure('ccpun_social.guard_social_operation_receipts()')
      AND NOT prosecdef AND provolatile='v' AND proconfig=ARRAY['search_path=pg_catalog']::text[]
      AND md5(prosrc)='9bd649549b7c7f2c4aae49eb5d253e48')
  THEN RAISE EXCEPTION 'SOCIAL_OPERATION_RECEIPT_TRIGGER_DRIFT'; END IF;
  IF current_checksum IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid='ccpun_social.social_publication_job'::regclass AND tgname='social_operation_receipts_guard'
      AND tgfoid=to_regprocedure('ccpun_social.guard_social_operation_receipts()') AND tgtype=31
      AND tgenabled='O' AND NOT tgisinternal)
  THEN RAISE EXCEPTION 'SOCIAL_OPERATION_RECEIPT_TRIGGER_DRIFT'; END IF;
END
$migration_guard$;

-- checksum-source-begin
ALTER TABLE ccpun_social.social_publication_job
  ADD COLUMN IF NOT EXISTS mutation_receipts jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION ccpun_social.guard_social_operation_receipts()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $receipt_guard$
DECLARE
  old_entry record;
  appended record;
  count_old integer;
  count_new integer;
  latest_job text;
  publication_state record;
  receipt jsonb;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.mutation_receipts IS DISTINCT FROM '{}'::jsonb
    THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='SOCIAL_RECEIPT_INSERT_NOT_EMPTY'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN
    IF OLD.mutation_receipts IS DISTINCT FROM '{}'::jsonb
    THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='SOCIAL_RECEIPT_DELETE_DENIED'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.mutation_receipts IS NOT DISTINCT FROM OLD.mutation_receipts THEN RETURN NEW; END IF;
  IF current_setting('transaction_isolation')<>'read committed'
    OR NEW.mutation_receipts IS NULL OR jsonb_typeof(NEW.mutation_receipts)<>'object'
    OR octet_length(NEW.mutation_receipts::text)>65536
  THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='SOCIAL_RECEIPT_APPEND_DENIED'; END IF;
  FOR old_entry IN SELECT key,value FROM jsonb_each(OLD.mutation_receipts) LOOP
    IF (NEW.mutation_receipts->old_entry.key) IS DISTINCT FROM old_entry.value
    THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='SOCIAL_RECEIPT_IMMUTABLE'; END IF;
  END LOOP;
  SELECT count(*) INTO count_old FROM jsonb_object_keys(OLD.mutation_receipts);
  SELECT count(*) INTO count_new FROM jsonb_object_keys(NEW.mutation_receipts);
  IF count_new<>count_old+1 OR count_new>128
  THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='SOCIAL_RECEIPT_CAPACITY_OR_APPEND_DENIED'; END IF;
  SELECT key,value INTO appended FROM jsonb_each(NEW.mutation_receipts) WHERE NOT OLD.mutation_receipts ? key;
  receipt:=appended.value;
  IF jsonb_typeof(receipt) IS DISTINCT FROM 'object'
    OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(receipt) AS key)
      IS DISTINCT FROM ARRAY['action','actorRef','idempotencyKey','payload','payloadDigest','publicationId','result','schemaVersion']::text[]
    OR receipt->'schemaVersion' IS DISTINCT FROM '1'::jsonb
    OR (receipt->>'action' IN ('reschedule','cancel')) IS NOT TRUE
    OR (SELECT bool_and(jsonb_typeof(receipt->key)='string') FROM unnest(ARRAY['action','actorRef','idempotencyKey','payloadDigest','publicationId']) AS key) IS NOT TRUE
    OR (receipt->>'actorRef' ~ '^admin:[a-f0-9]{32}$') IS NOT TRUE
    OR (receipt->>'payloadDigest' ~ '^[a-f0-9]{64}$') IS NOT TRUE
    OR (receipt->>'idempotencyKey' ~ '^[A-Za-z0-9_.:-]{16,120}$') IS NOT TRUE
    OR receipt->>'publicationId' IS DISTINCT FROM NEW.publication_id
    OR appended.key IS DISTINCT FROM 'audit:'||(receipt->>'idempotencyKey')||':'||(receipt->>'action')
    OR jsonb_typeof(receipt->'payload') IS DISTINCT FROM 'object' OR jsonb_typeof(receipt->'result') IS DISTINCT FROM 'object'
  THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='SOCIAL_RECEIPT_INVALID'; END IF;
  IF (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(receipt->'payload') AS key)
      IS DISTINCT FROM CASE WHEN receipt->>'action'='reschedule'
        THEN ARRAY['expectedJobVersion','idempotencyKey','publicationId','scheduledAt']::text[]
        ELSE ARRAY['expectedJobVersion','idempotencyKey','publicationId']::text[] END
    OR receipt#>'{payload,publicationId}' IS DISTINCT FROM to_jsonb(NEW.publication_id)
    OR receipt#>'{payload,idempotencyKey}' IS DISTINCT FROM receipt->'idempotencyKey'
    OR jsonb_typeof(receipt#>'{payload,expectedJobVersion}') IS DISTINCT FROM 'number'
    OR (receipt#>>'{payload,expectedJobVersion}' ~ '^[1-9][0-9]{0,9}$') IS NOT TRUE
    OR (receipt#>>'{payload,expectedJobVersion}')::bigint<>OLD.version
    OR NEW.version<>OLD.version+1
    OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(receipt->'result') AS key)
      IS DISTINCT FROM CASE WHEN receipt->>'action'='reschedule'
        THEN ARRAY['jobId','jobVersion','publicationId','scheduledAt','state']::text[]
        ELSE ARRAY['jobId','jobVersion','publicationId','state']::text[] END
    OR receipt#>'{result,publicationId}' IS DISTINCT FROM to_jsonb(NEW.publication_id)
    OR receipt#>'{result,jobId}' IS DISTINCT FROM to_jsonb(NEW.id)
    OR receipt#>'{result,jobVersion}' IS DISTINCT FROM to_jsonb(NEW.version)
    OR receipt#>'{result,state}' IS DISTINCT FROM to_jsonb(CASE WHEN receipt->>'action'='reschedule' THEN 'rescheduled'::text ELSE 'cancelled'::text END)
    OR NEW.publication_id IS DISTINCT FROM OLD.publication_id OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.status IS DISTINCT FROM CASE WHEN receipt->>'action'='reschedule' THEN 'queued' ELSE 'cancelled' END
  THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='SOCIAL_RECEIPT_BINDING_INVALID'; END IF;

  -- VOLATILE + READ COMMITTED: acquire the publication fence, then take a
  -- fresh snapshot in a SEPARATE query. The outer CTE snapshot is not refreshed.
  SELECT id,status,scheduled_at INTO publication_state FROM ccpun_social.social_publication
    WHERE id=NEW.publication_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='SOCIAL_RECEIPT_PUBLICATION_MISSING'; END IF;
  SELECT id INTO latest_job FROM ccpun_social.social_publication_job
    WHERE publication_id=NEW.publication_id ORDER BY created_at DESC,id DESC LIMIT 1;
  IF latest_job IS DISTINCT FROM NEW.id
    OR publication_state.status IS DISTINCT FROM CASE WHEN receipt->>'action'='reschedule' THEN 'approved' ELSE 'cancelled' END
  THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='SOCIAL_RECEIPT_LATEST_JOB_CONFLICT'; END IF;
  IF receipt->>'action'='reschedule' AND (
    jsonb_typeof(receipt#>'{payload,scheduledAt}') IS DISTINCT FROM 'string'
    OR jsonb_typeof(receipt#>'{result,scheduledAt}') IS DISTINCT FROM 'string'
    OR (receipt#>>'{payload,scheduledAt}')::timestamptz IS DISTINCT FROM publication_state.scheduled_at
    OR receipt#>>'{result,scheduledAt}' IS DISTINCT FROM to_char(publication_state.scheduled_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='SOCIAL_RECEIPT_SCHEDULE_INVALID'; END IF;
  RETURN NEW;
END
$receipt_guard$;

DROP TRIGGER IF EXISTS social_operation_receipts_guard ON ccpun_social.social_publication_job;
CREATE TRIGGER social_operation_receipts_guard BEFORE INSERT OR UPDATE OR DELETE
ON ccpun_social.social_publication_job FOR EACH ROW EXECUTE FUNCTION ccpun_social.guard_social_operation_receipts();
REVOKE ALL ON FUNCTION ccpun_social.guard_social_operation_receipts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ccpun_social.guard_social_operation_receipts() TO ccpun_social_runtime;
GRANT UPDATE (mutation_receipts) ON ccpun_social.social_publication_job TO ccpun_social_runtime;
-- checksum-source-end

INSERT INTO ccpun_social.schema_migration(version,checksum)
VALUES('20261004_social_operation_receipts_v1','sha256:361b035bf36ee32a439cb30b0fa5924acecff0bedc4d81360ee506e6b6c10981') ON CONFLICT(version) DO NOTHING;
COMMIT;

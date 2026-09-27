BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database()<>'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM private_line.schema_migration
    WHERE version='20260918_line_conversation_archive_v1_uat'
      AND checksum='sha256:15d047b231bd18214f5e47ce4382033e5cd7786811006e3dfa217d0db32f8fef'
  ) THEN RAISE EXCEPTION 'conversation archive v1 missing'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM private_line.system_identity
    WHERE singleton=true
      AND project_id='young-term-47483330'
      AND branch_id='br-crimson-mouse-az7ajkv8'
      AND endpoint_id='ep-mute-frost-aztvz394'
      AND database_name='neondb'
      AND migration_version='20260917_private_line_runtime_v1_uat'
  ) THEN RAISE EXCEPTION 'base system identity changed'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260924_chat_ocr_import_v1'));
  SELECT checksum INTO existing_checksum
  FROM private_line.schema_migration
  WHERE version='20260924_chat_ocr_import_v1_uat';
  IF existing_checksum IS NOT NULL AND existing_checksum<>'sha256:e62e2ec9868ea5cb3f7350fb8ffa07f11ef4cf4cd9e101d6ddca57192509f9d7' THEN
    RAISE EXCEPTION 'chat ocr import checksum mismatch';
  END IF;
END
$guard$;
-- checksum-source-begin
DO $constraints$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid='private_line.line_conversation_archive'::regclass
      AND contype='c'
      AND (
        pg_get_constraintdef(oid) LIKE '%source_kind%line_webhook%line_oa_csv%'
        OR pg_get_constraintdef(oid) LIKE '%content_purpose%message-content%line-oa-import-content%'
        OR (pg_get_constraintdef(oid) LIKE '%source_kind%line_oa_csv%' AND pg_get_constraintdef(oid) LIKE '%imported_at%')
      )
  LOOP
    EXECUTE format('ALTER TABLE private_line.line_conversation_archive DROP CONSTRAINT %I',r.conname);
  END LOOP;
END
$constraints$;

ALTER TABLE private_line.line_conversation_archive
  ADD CONSTRAINT line_conversation_archive_source_kind_v2_check
    CHECK (source_kind IN ('line_webhook','line_oa_csv','manual_ocr')),
  ADD CONSTRAINT line_conversation_archive_content_purpose_v2_check
    CHECK (content_purpose IS NULL OR content_purpose IN ('message-content','line-oa-import-content','chat-ocr-import-content')),
  ADD CONSTRAINT line_conversation_archive_import_state_v2_check
    CHECK ((source_kind IN ('line_oa_csv','manual_ocr')) = (imported_at IS NOT NULL));

CREATE OR REPLACE FUNCTION private_line.admin_import_chat_ocr_archive_message(payload jsonb)
RETURNS TABLE(outcome text,archive_message_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $chat_ocr_import$
DECLARE
  v_lead uuid;
  v_conversation uuid;
  v_archive uuid;
  v_digest text;
  v_direction text;
BEGIN
  IF jsonb_typeof(payload)<>'object'
     OR NOT private_line.safe_json_keys_only(payload,ARRAY[
       'lead_id','source_digest','direction','occurred_at',
       'content_ciphertext_b64','content_nonce_b64','content_auth_tag_b64','content_key_version'
     ]::text[]) THEN
    RAISE EXCEPTION 'unsafe chat ocr import payload';
  END IF;

  v_lead := (payload->>'lead_id')::uuid;
  v_digest := payload->>'source_digest';
  v_direction := payload->>'direction';

  IF NOT private_line.safe_hex_digest(v_digest)
     OR v_direction NOT IN ('inbound','outbound')
     OR NULLIF(payload->>'occurred_at','') IS NULL
     OR COALESCE(length(payload->>'content_ciphertext_b64'),0)=0
     OR COALESCE(length(payload->>'content_nonce_b64'),0)=0
     OR COALESCE(length(payload->>'content_auth_tag_b64'),0)=0
     OR COALESCE((payload->>'content_key_version')::integer,0)<=0 THEN
    RAISE EXCEPTION 'chat ocr import validation failed';
  END IF;

  SELECT conversation_id INTO v_conversation
  FROM private_line.lead
  WHERE lead_id=v_lead;

  IF v_conversation IS NULL THEN
    RAISE EXCEPTION 'chat ocr import lead missing';
  END IF;

  INSERT INTO private_line.line_conversation_archive(
    conversation_id,source_kind,source_digest,direction,message_type,status,
    needs_human,occurred_at,content_ciphertext_b64,content_nonce_b64,
    content_auth_tag_b64,content_key_version,content_purpose,imported_at,updated_at
  ) VALUES (
    v_conversation,'manual_ocr',v_digest,v_direction,'text','imported',
    false,(payload->>'occurred_at')::timestamptz,
    payload->>'content_ciphertext_b64',payload->>'content_nonce_b64',
    payload->>'content_auth_tag_b64',(payload->>'content_key_version')::smallint,
    'chat-ocr-import-content',now(),now()
  )
  ON CONFLICT(source_digest) DO NOTHING
  RETURNING line_conversation_archive.archive_message_id INTO v_archive;

  IF v_archive IS NULL THEN
    SELECT a.archive_message_id INTO v_archive
    FROM private_line.line_conversation_archive a
    WHERE a.source_digest=v_digest;
    RETURN QUERY SELECT 'duplicate'::text,v_archive;
  END IF;

  RETURN QUERY SELECT 'imported'::text,v_archive;
END
$chat_ocr_import$;

REVOKE ALL ON FUNCTION private_line.admin_import_chat_ocr_archive_message(jsonb)
FROM PUBLIC,ccpun_line_ingress;

GRANT EXECUTE ON FUNCTION private_line.admin_import_chat_ocr_archive_message(jsonb)
TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum)
VALUES('20260924_chat_ocr_import_v1_uat','sha256:e62e2ec9868ea5cb3f7350fb8ffa07f11ef4cf4cd9e101d6ddca57192509f9d7')
ON CONFLICT(version) DO UPDATE SET checksum=EXCLUDED.checksum;
COMMIT;

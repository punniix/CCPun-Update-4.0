BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database()<>'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS(SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_privacy_retention_v2_production' AND checksum='sha256:ce3a55a27969b4effecb70af0bc8f5e4de4f9dc023fbd32fc91ded69a08005f8') THEN RAISE EXCEPTION 'privacy retention v2 missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM private_line.system_identity WHERE singleton=true AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w' AND database_name='neondb' AND migration_version='20260917_private_line_runtime_v1_production') THEN RAISE EXCEPTION 'base system identity changed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_conversation_archive_v1'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_conversation_archive_v1_production';
  IF existing_checksum IS NOT NULL AND existing_checksum<>'sha256:15d047b231bd18214f5e47ce4382033e5cd7786811006e3dfa217d0db32f8fef' THEN RAISE EXCEPTION 'conversation archive checksum mismatch'; END IF;
END
$guard$;
-- checksum-source-begin
CREATE TABLE IF NOT EXISTS private_line.line_conversation_archive (
  archive_message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES private_line.conversation(conversation_id),
  original_message_id uuid UNIQUE REFERENCES private_line.message(message_id),
  source_kind text NOT NULL CHECK (source_kind IN ('line_webhook','line_oa_csv')),
  source_digest text NOT NULL UNIQUE CHECK (private_line.safe_hex_digest(source_digest)),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  message_type text NOT NULL CHECK (message_type IN ('text','image','video','audio','file','location','sticker')),
  status text NOT NULL CHECK (status IN ('active','unsent','imported')),
  needs_human boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL,
  unsent_at timestamptz,
  content_ciphertext_b64 text,
  content_nonce_b64 text,
  content_auth_tag_b64 text,
  content_key_version smallint CHECK (content_key_version IS NULL OR content_key_version > 0),
  content_purpose text CHECK (content_purpose IS NULL OR content_purpose IN ('message-content','line-oa-import-content')),
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((content_ciphertext_b64 IS NULL) = (content_nonce_b64 IS NULL)),
  CHECK ((content_ciphertext_b64 IS NULL) = (content_auth_tag_b64 IS NULL)),
  CHECK ((content_ciphertext_b64 IS NULL) = (content_key_version IS NULL)),
  CHECK ((content_ciphertext_b64 IS NULL) = (content_purpose IS NULL)),
  CHECK ((source_kind='line_oa_csv') = (imported_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS line_conversation_archive_conversation_time_idx
  ON private_line.line_conversation_archive(conversation_id, occurred_at, archive_message_id);

CREATE TABLE IF NOT EXISTS private_line.line_profile_private (
  identity_id uuid PRIMARY KEY REFERENCES private_line.provider_identity(identity_id),
  display_name_ciphertext_b64 text NOT NULL,
  display_name_nonce_b64 text NOT NULL,
  display_name_auth_tag_b64 text NOT NULL,
  display_name_key_version smallint NOT NULL CHECK (display_name_key_version > 0),
  picture_url_ciphertext_b64 text,
  picture_url_nonce_b64 text,
  picture_url_auth_tag_b64 text,
  picture_url_key_version smallint CHECK (picture_url_key_version IS NULL OR picture_url_key_version > 0),
  fetched_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((picture_url_ciphertext_b64 IS NULL) = (picture_url_nonce_b64 IS NULL)),
  CHECK ((picture_url_ciphertext_b64 IS NULL) = (picture_url_auth_tag_b64 IS NULL)),
  CHECK ((picture_url_ciphertext_b64 IS NULL) = (picture_url_key_version IS NULL))
);

CREATE TABLE IF NOT EXISTS private_line.line_evidence_access_log (
  access_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES private_line.lead(lead_id),
  actor_digest text NOT NULL CHECK (private_line.safe_hex_digest(actor_digest)),
  action text NOT NULL CHECK (action IN ('view','print')),
  item_count integer NOT NULL CHECK (item_count >= 0 AND item_count <= 500),
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION private_line.sync_line_conversation_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $archive_sync$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO private_line.line_conversation_archive(
      conversation_id,original_message_id,source_kind,source_digest,direction,message_type,status,
      needs_human,occurred_at,unsent_at,content_ciphertext_b64,content_nonce_b64,
      content_auth_tag_b64,content_key_version,content_purpose,imported_at,updated_at
    ) VALUES (
      NEW.conversation_id,NEW.message_id,'line_webhook',NEW.provider_message_digest,NEW.direction,NEW.message_type,
      CASE WHEN NEW.status='unsent' THEN 'unsent' ELSE 'active' END,
      NEW.needs_human,NEW.received_at,NEW.unsent_at,NEW.content_ciphertext_b64,NEW.content_nonce_b64,
      NEW.content_auth_tag_b64,NEW.content_key_version,
      CASE WHEN NEW.content_ciphertext_b64 IS NULL THEN NULL ELSE 'message-content' END,
      NULL,now()
    )
    ON CONFLICT (original_message_id) DO NOTHING;
    RETURN NEW;
  END IF;

  IF TG_OP='UPDATE' AND NEW.status='unsent' THEN
    UPDATE private_line.line_conversation_archive
    SET status='unsent',
        unsent_at=COALESCE(NEW.unsent_at,OLD.unsent_at,now()),
        needs_human=false,
        updated_at=now()
    WHERE original_message_id=NEW.message_id;
  END IF;
  RETURN NEW;
END
$archive_sync$;

DROP TRIGGER IF EXISTS private_line_message_archive_sync ON private_line.message;
CREATE TRIGGER private_line_message_archive_sync
AFTER INSERT OR UPDATE OF status,unsent_at ON private_line.message
FOR EACH ROW EXECUTE FUNCTION private_line.sync_line_conversation_archive();

INSERT INTO private_line.line_conversation_archive(
  conversation_id,original_message_id,source_kind,source_digest,direction,message_type,status,
  needs_human,occurred_at,unsent_at,content_ciphertext_b64,content_nonce_b64,
  content_auth_tag_b64,content_key_version,content_purpose,imported_at
)
SELECT
  m.conversation_id,m.message_id,'line_webhook',m.provider_message_digest,m.direction,m.message_type,
  CASE WHEN m.status='unsent' THEN 'unsent' ELSE 'active' END,
  m.needs_human,m.received_at,m.unsent_at,m.content_ciphertext_b64,m.content_nonce_b64,
  m.content_auth_tag_b64,m.content_key_version,
  CASE WHEN m.content_ciphertext_b64 IS NULL THEN NULL ELSE 'message-content' END,
  NULL
FROM private_line.message m
ON CONFLICT (original_message_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private_line.admin_read_line_transcript(p_lead_id uuid, p_limit integer DEFAULT 100)
RETURNS TABLE(
  item_id uuid,
  source_kind text,
  direction text,
  message_type text,
  status text,
  needs_human boolean,
  occurred_at timestamptz,
  unsent_at timestamptz,
  content_ciphertext_b64 text,
  content_nonce_b64 text,
  content_auth_tag_b64 text,
  content_key_version smallint,
  content_purpose text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_line_transcript$
  SELECT
    a.archive_message_id,
    CASE WHEN a.direction='outbound' THEN 'outbound'::text ELSE 'message'::text END,
    a.direction,a.message_type,a.status,a.needs_human,a.occurred_at,a.unsent_at,
    a.content_ciphertext_b64,a.content_nonce_b64,a.content_auth_tag_b64,a.content_key_version,a.content_purpose
  FROM private_line.line_conversation_archive a
  JOIN private_line.lead l ON l.conversation_id=a.conversation_id
  WHERE l.lead_id=p_lead_id
  ORDER BY a.occurred_at ASC,a.archive_message_id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),500)
$admin_read_line_transcript$;

CREATE OR REPLACE FUNCTION private_line.admin_read_line_archive(p_lead_id uuid, p_limit integer DEFAULT 500)
RETURNS TABLE(
  archive_message_id uuid,
  source_kind text,
  direction text,
  message_type text,
  status text,
  occurred_at timestamptz,
  unsent_at timestamptz,
  content_ciphertext_b64 text,
  content_nonce_b64 text,
  content_auth_tag_b64 text,
  content_key_version smallint,
  content_purpose text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_line_archive$
  SELECT a.archive_message_id,a.source_kind,a.direction,a.message_type,a.status,a.occurred_at,a.unsent_at,
         a.content_ciphertext_b64,a.content_nonce_b64,a.content_auth_tag_b64,a.content_key_version,a.content_purpose
  FROM private_line.line_conversation_archive a
  JOIN private_line.lead l ON l.conversation_id=a.conversation_id
  WHERE l.lead_id=p_lead_id
  ORDER BY a.occurred_at ASC,a.archive_message_id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,500),1),500)
$admin_read_line_archive$;

CREATE OR REPLACE FUNCTION private_line.admin_read_line_profile_source(p_lead_id uuid)
RETURNS TABLE(
  identity_id uuid,
  external_ref_ciphertext_b64 text,
  external_ref_nonce_b64 text,
  external_ref_auth_tag_b64 text,
  external_ref_key_version smallint,
  display_name_ciphertext_b64 text,
  display_name_nonce_b64 text,
  display_name_auth_tag_b64 text,
  display_name_key_version smallint,
  picture_url_ciphertext_b64 text,
  picture_url_nonce_b64 text,
  picture_url_auth_tag_b64 text,
  picture_url_key_version smallint,
  profile_fetched_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_line_profile_source$
  SELECT pi.identity_id,pi.external_ref_ciphertext_b64,pi.external_ref_nonce_b64,pi.external_ref_auth_tag_b64,pi.key_version,
         lp.display_name_ciphertext_b64,lp.display_name_nonce_b64,lp.display_name_auth_tag_b64,lp.display_name_key_version,
         lp.picture_url_ciphertext_b64,lp.picture_url_nonce_b64,lp.picture_url_auth_tag_b64,lp.picture_url_key_version,
         lp.fetched_at
  FROM private_line.lead l
  JOIN private_line.conversation c ON c.conversation_id=l.conversation_id
  JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id
  LEFT JOIN private_line.line_profile_private lp ON lp.identity_id=pi.identity_id
  WHERE l.lead_id=p_lead_id
  LIMIT 1
$admin_read_line_profile_source$;

CREATE OR REPLACE FUNCTION private_line.admin_checkpoint_line_profile(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_checkpoint_line_profile$
DECLARE
  v_lead uuid;
  v_identity uuid;
  v_picture_present boolean;
BEGIN
  IF jsonb_typeof(payload)<>'object'
     OR NOT private_line.safe_json_keys_only(payload,ARRAY[
       'lead_id','display_name_ciphertext_b64','display_name_nonce_b64','display_name_auth_tag_b64','display_name_key_version',
       'picture_url_ciphertext_b64','picture_url_nonce_b64','picture_url_auth_tag_b64','picture_url_key_version','fetched_at'
     ]::text[]) THEN RAISE EXCEPTION 'unsafe line profile payload'; END IF;
  v_lead := (payload->>'lead_id')::uuid;
  SELECT c.identity_id INTO v_identity FROM private_line.lead l JOIN private_line.conversation c ON c.conversation_id=l.conversation_id WHERE l.lead_id=v_lead;
  IF v_identity IS NULL THEN RAISE EXCEPTION 'lead profile source missing'; END IF;
  IF COALESCE(length(payload->>'display_name_ciphertext_b64'),0)=0
     OR COALESCE(length(payload->>'display_name_nonce_b64'),0)=0
     OR COALESCE(length(payload->>'display_name_auth_tag_b64'),0)=0
     OR COALESCE((payload->>'display_name_key_version')::integer,0)<=0 THEN RAISE EXCEPTION 'display name encryption invalid'; END IF;
  v_picture_present := NULLIF(payload->>'picture_url_ciphertext_b64','') IS NOT NULL;
  IF v_picture_present AND (
     COALESCE(length(payload->>'picture_url_nonce_b64'),0)=0 OR
     COALESCE(length(payload->>'picture_url_auth_tag_b64'),0)=0 OR
     COALESCE((payload->>'picture_url_key_version')::integer,0)<=0
  ) THEN RAISE EXCEPTION 'picture url encryption invalid'; END IF;
  INSERT INTO private_line.line_profile_private(
    identity_id,display_name_ciphertext_b64,display_name_nonce_b64,display_name_auth_tag_b64,display_name_key_version,
    picture_url_ciphertext_b64,picture_url_nonce_b64,picture_url_auth_tag_b64,picture_url_key_version,fetched_at,updated_at
  ) VALUES (
    v_identity,payload->>'display_name_ciphertext_b64',payload->>'display_name_nonce_b64',payload->>'display_name_auth_tag_b64',
    (payload->>'display_name_key_version')::smallint,
    NULLIF(payload->>'picture_url_ciphertext_b64',''),NULLIF(payload->>'picture_url_nonce_b64',''),NULLIF(payload->>'picture_url_auth_tag_b64',''),
    NULLIF(payload->>'picture_url_key_version','')::smallint,
    COALESCE(NULLIF(payload->>'fetched_at','')::timestamptz,now()),now()
  )
  ON CONFLICT(identity_id) DO UPDATE SET
    display_name_ciphertext_b64=EXCLUDED.display_name_ciphertext_b64,
    display_name_nonce_b64=EXCLUDED.display_name_nonce_b64,
    display_name_auth_tag_b64=EXCLUDED.display_name_auth_tag_b64,
    display_name_key_version=EXCLUDED.display_name_key_version,
    picture_url_ciphertext_b64=EXCLUDED.picture_url_ciphertext_b64,
    picture_url_nonce_b64=EXCLUDED.picture_url_nonce_b64,
    picture_url_auth_tag_b64=EXCLUDED.picture_url_auth_tag_b64,
    picture_url_key_version=EXCLUDED.picture_url_key_version,
    fetched_at=EXCLUDED.fetched_at,updated_at=now();
  RETURN QUERY SELECT 'stored'::text;
END
$admin_checkpoint_line_profile$;

CREATE OR REPLACE FUNCTION private_line.admin_import_line_oa_archive_message(payload jsonb)
RETURNS TABLE(outcome text, archive_message_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_import_line_oa_archive_message$
DECLARE
  v_lead uuid;
  v_conversation uuid;
  v_archive uuid;
  v_digest text;
BEGIN
  IF jsonb_typeof(payload)<>'object'
     OR NOT private_line.safe_json_keys_only(payload,ARRAY[
       'lead_id','source_digest','occurred_at','content_ciphertext_b64','content_nonce_b64','content_auth_tag_b64','content_key_version'
     ]::text[]) THEN RAISE EXCEPTION 'unsafe line oa import payload'; END IF;
  v_lead := (payload->>'lead_id')::uuid;
  v_digest := payload->>'source_digest';
  IF NOT private_line.safe_hex_digest(v_digest)
     OR COALESCE(length(payload->>'content_ciphertext_b64'),0)=0
     OR COALESCE(length(payload->>'content_nonce_b64'),0)=0
     OR COALESCE(length(payload->>'content_auth_tag_b64'),0)=0
     OR COALESCE((payload->>'content_key_version')::integer,0)<=0 THEN RAISE EXCEPTION 'line oa import validation failed'; END IF;
  SELECT conversation_id INTO v_conversation FROM private_line.lead WHERE lead_id=v_lead;
  IF v_conversation IS NULL THEN RAISE EXCEPTION 'line oa import lead missing'; END IF;
  INSERT INTO private_line.line_conversation_archive(
    conversation_id,source_kind,source_digest,direction,message_type,status,needs_human,occurred_at,
    content_ciphertext_b64,content_nonce_b64,content_auth_tag_b64,content_key_version,content_purpose,imported_at,updated_at
  ) VALUES (
    v_conversation,'line_oa_csv',v_digest,'outbound','text','imported',false,(payload->>'occurred_at')::timestamptz,
    payload->>'content_ciphertext_b64',payload->>'content_nonce_b64',payload->>'content_auth_tag_b64',
    (payload->>'content_key_version')::smallint,'line-oa-import-content',now(),now()
  )
  ON CONFLICT(source_digest) DO NOTHING
  RETURNING line_conversation_archive.archive_message_id INTO v_archive;
  IF v_archive IS NULL THEN
    SELECT a.archive_message_id INTO v_archive FROM private_line.line_conversation_archive a WHERE a.source_digest=v_digest;
    RETURN QUERY SELECT 'duplicate'::text,v_archive;
  ELSE
    RETURN QUERY SELECT 'imported'::text,v_archive;
  END IF;
END
$admin_import_line_oa_archive_message$;

CREATE OR REPLACE FUNCTION private_line.admin_record_line_evidence_access(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_record_line_evidence_access$
DECLARE
  v_lead uuid;
  v_actor text;
  v_action text;
  v_count integer;
BEGIN
  IF jsonb_typeof(payload)<>'object'
     OR NOT private_line.safe_json_keys_only(payload,ARRAY['lead_id','actor_digest','action','item_count']::text[]) THEN
    RAISE EXCEPTION 'unsafe line evidence access payload';
  END IF;
  v_lead := (payload->>'lead_id')::uuid;
  v_actor := payload->>'actor_digest';
  v_action := payload->>'action';
  v_count := COALESCE((payload->>'item_count')::integer,0);
  IF NOT private_line.safe_hex_digest(v_actor) OR v_action NOT IN ('view','print') OR v_count<0 OR v_count>500 THEN
    RAISE EXCEPTION 'line evidence access validation failed';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM private_line.lead WHERE lead_id=v_lead) THEN RAISE EXCEPTION 'line evidence lead missing'; END IF;
  INSERT INTO private_line.line_evidence_access_log(lead_id,actor_digest,action,item_count) VALUES(v_lead,v_actor,v_action,v_count);
  RETURN QUERY SELECT 'recorded'::text;
END
$admin_record_line_evidence_access$;

CREATE OR REPLACE FUNCTION private_line.admin_read_line_archive_health()
RETURNS TABLE(
  archived_message_count bigint,
  retained_unsent_count bigint,
  imported_outbound_count bigint,
  cached_profile_count bigint,
  evidence_access_count bigint,
  direct_admin_reply_enabled boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_line_archive_health$
  SELECT
    (SELECT count(*) FROM private_line.line_conversation_archive),
    (SELECT count(*) FROM private_line.line_conversation_archive WHERE status='unsent' AND content_ciphertext_b64 IS NOT NULL),
    (SELECT count(*) FROM private_line.line_conversation_archive WHERE source_kind='line_oa_csv' AND direction='outbound'),
    (SELECT count(*) FROM private_line.line_profile_private),
    (SELECT count(*) FROM private_line.line_evidence_access_log),
    false
$admin_read_line_archive_health$;

REVOKE ALL ON TABLE private_line.line_conversation_archive FROM PUBLIC,ccpun_line_ingress,ccpun_admin_runtime;
REVOKE ALL ON TABLE private_line.line_profile_private FROM PUBLIC,ccpun_line_ingress,ccpun_admin_runtime;
REVOKE ALL ON TABLE private_line.line_evidence_access_log FROM PUBLIC,ccpun_line_ingress,ccpun_admin_runtime;
REVOKE ALL ON FUNCTION private_line.sync_line_conversation_archive() FROM PUBLIC,ccpun_line_ingress,ccpun_admin_runtime;
REVOKE ALL ON FUNCTION private_line.admin_read_line_archive(uuid,integer) FROM PUBLIC,ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_line_profile_source(uuid) FROM PUBLIC,ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_checkpoint_line_profile(jsonb) FROM PUBLIC,ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_import_line_oa_archive_message(jsonb) FROM PUBLIC,ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_record_line_evidence_access(jsonb) FROM PUBLIC,ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_line_archive_health() FROM PUBLIC,ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_enqueue_line_reply(jsonb) FROM ccpun_admin_runtime;
REVOKE ALL ON FUNCTION private_line.admin_claim_line_outbound(jsonb) FROM ccpun_admin_runtime;

GRANT EXECUTE ON FUNCTION private_line.admin_read_line_transcript(uuid,integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_line_archive(uuid,integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_line_profile_source(uuid) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_checkpoint_line_profile(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_import_line_oa_archive_message(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_record_line_evidence_access(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_line_archive_health() TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum)
VALUES('20260918_line_conversation_archive_v1_production','sha256:15d047b231bd18214f5e47ce4382033e5cd7786811006e3dfa217d0db32f8fef')
ON CONFLICT(version) DO UPDATE SET checksum=EXCLUDED.checksum;
COMMIT;

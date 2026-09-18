BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_attribution_privacy_ops_fix_v1_uat' AND checksum='sha256:966f039cbf412946528136a5c1b9ebf04ce98027d5f2a15ea1820a63d189a2b2') THEN RAISE EXCEPTION 'attribution/privacy fix missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.system_identity WHERE singleton=true AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394' AND database_name='neondb' AND migration_version='20260917_private_line_runtime_v1_uat') THEN RAISE EXCEPTION 'base system identity changed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_document_media_activation_v1'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_document_media_activation_v1_uat';
  IF existing_checksum IS NOT NULL AND existing_checksum <> 'sha256:fcab7e746a62850711493cfa849548975c6dfdb8365417d3b142fdc26ae1026f' THEN RAISE EXCEPTION 'document/media activation checksum mismatch'; END IF;
END
$guard$;
-- checksum-source-begin
CREATE TABLE IF NOT EXISTS private_line.line_runtime_health (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  active_encryption_version smallint NOT NULL CHECK (active_encryption_version IN (1,2)),
  v1_key_present boolean NOT NULL,
  v2_key_present boolean NOT NULL,
  lazy_rotation_enabled boolean NOT NULL,
  last_reported_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT lazy_rotation_enabled OR (active_encryption_version=2 AND v1_key_present AND v2_key_present))
);

CREATE TABLE IF NOT EXISTS private_line.customer_drive_folder (
  customer_id uuid PRIMARY KEY REFERENCES private_line.customer(customer_id),
  storage_provider text NOT NULL DEFAULT 'google_drive' CHECK (storage_provider='google_drive'),
  external_folder_id text NOT NULL CHECK (external_folder_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  folder_id_digest text NOT NULL UNIQUE CHECK (private_line.safe_hex_digest(folder_id_digest)),
  status text NOT NULL DEFAULT 'pending_authorization' CHECK (status IN ('pending_authorization','ready','revocation_required','revoked','failed')),
  permission_state text NOT NULL DEFAULT 'unverified' CHECK (permission_state IN ('unverified','private','unsafe')),
  authorization_mode text NOT NULL DEFAULT 'owner_interactive' CHECK (authorization_mode='owner_interactive'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.document_storage_object (
  document_id uuid PRIMARY KEY REFERENCES private_line.document(document_id),
  customer_id uuid NOT NULL REFERENCES private_line.customer(customer_id),
  storage_provider text NOT NULL DEFAULT 'google_drive' CHECK (storage_provider='google_drive'),
  external_file_id text CHECK (external_file_id IS NULL OR external_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  external_file_id_digest text CHECK (external_file_id_digest IS NULL OR private_line.safe_hex_digest(external_file_id_digest)),
  external_folder_id text CHECK (external_folder_id IS NULL OR external_folder_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  upload_idempotency_digest text UNIQUE CHECK (upload_idempotency_digest IS NULL OR private_line.safe_hex_digest(upload_idempotency_digest)),
  status text NOT NULL DEFAULT 'pending_fetch' CHECK (status IN ('pending_fetch','pending_upload','stored','revoke_required','revoked','deleted','failed','reconciliation_required')),
  permission_state text NOT NULL DEFAULT 'unverified' CHECK (permission_state IN ('unverified','private','unsafe')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_class text CHECK (last_error_class IS NULL OR private_line.safe_id(last_error_class)),
  next_retry_at timestamptz,
  stored_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS private_line_document_storage_status_idx
  ON private_line.document_storage_object(status, next_retry_at, updated_at);

CREATE TABLE IF NOT EXISTS private_line.document_media_attempt (
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES private_line.document(document_id),
  operation text NOT NULL CHECK (operation IN ('fetch','upload','revoke')),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  status text NOT NULL CHECK (status IN ('started','succeeded','failed','reconciliation_required')),
  error_class text CHECK (error_class IS NULL OR private_line.safe_id(error_class)),
  provider_status_code integer CHECK (provider_status_code IS NULL OR provider_status_code BETWEEN 100 AND 599),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, operation, attempt_number)
);

INSERT INTO private_line.document_storage_object (
  document_id,customer_id,external_file_id,external_folder_id,status,permission_state,created_at,updated_at
)
SELECT
  d.document_id,d.customer_id,d.external_file_id,d.external_folder_id,
  CASE
    WHEN d.status='stored' THEN 'stored'
    WHEN d.status='revoke_required' THEN 'revoke_required'
    WHEN d.status='revoked' THEN 'revoked'
    WHEN d.status='deleted' THEN 'deleted'
    WHEN d.status='failed' THEN 'failed'
    ELSE 'pending_fetch'
  END,
  'unverified',d.created_at,d.updated_at
FROM private_line.document d
WHERE d.external_file_id IS NOT NULL OR d.external_folder_id IS NOT NULL
ON CONFLICT(document_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private_line.sync_document_storage_object()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $sync_document_storage_object$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO private_line.document_storage_object(
      document_id,customer_id,external_file_id,external_folder_id,status,updated_at
    ) VALUES (
      NEW.document_id,NEW.customer_id,NEW.external_file_id,NEW.external_folder_id,
      CASE WHEN NEW.status='stored' THEN 'stored' ELSE 'pending_fetch' END,now()
    )
    ON CONFLICT(document_id) DO NOTHING;
    RETURN NEW;
  END IF;

  IF NEW.status='stored' AND NEW.external_file_id IS NOT NULL THEN
    INSERT INTO private_line.document_storage_object(
      document_id,customer_id,external_file_id,external_folder_id,status,updated_at
    ) VALUES (
      NEW.document_id,NEW.customer_id,NEW.external_file_id,NEW.external_folder_id,'stored',now()
    )
    ON CONFLICT(document_id) DO UPDATE SET
      external_file_id=COALESCE(EXCLUDED.external_file_id,private_line.document_storage_object.external_file_id),
      external_folder_id=COALESCE(EXCLUDED.external_folder_id,private_line.document_storage_object.external_folder_id),
      status='stored',
      updated_at=now();
  ELSIF NEW.status='revoke_required' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO private_line.document_storage_object(
      document_id,customer_id,external_file_id,external_folder_id,status,updated_at
    ) VALUES (
      NEW.document_id,NEW.customer_id,COALESCE(OLD.external_file_id,NEW.external_file_id),
      COALESCE(OLD.external_folder_id,NEW.external_folder_id),'revoke_required',now()
    )
    ON CONFLICT(document_id) DO UPDATE SET
      external_file_id=COALESCE(private_line.document_storage_object.external_file_id,EXCLUDED.external_file_id),
      external_folder_id=COALESCE(private_line.document_storage_object.external_folder_id,EXCLUDED.external_folder_id),
      status=CASE
        WHEN private_line.document_storage_object.status IN ('revoked','deleted') THEN private_line.document_storage_object.status
        ELSE 'revoke_required'
      END,
      updated_at=now();
  END IF;
  RETURN NEW;
END
$sync_document_storage_object$;

DROP TRIGGER IF EXISTS private_line_document_storage_sync ON private_line.document;
CREATE TRIGGER private_line_document_storage_sync
AFTER INSERT OR UPDATE OF status,external_file_id,external_folder_id ON private_line.document
FOR EACH ROW EXECUTE FUNCTION private_line.sync_document_storage_object();

CREATE OR REPLACE FUNCTION private_line.ingress_record_line_runtime_health(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $ingress_record_line_runtime_health$
DECLARE
  v_active smallint;
  v_v1 boolean;
  v_v2 boolean;
  v_lazy boolean;
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR NOT private_line.safe_json_keys_only(payload,ARRAY['active_version','v1_key_present','v2_key_present','lazy_rotation_enabled']::text[])
  THEN RAISE EXCEPTION 'invalid LINE runtime health payload'; END IF;

  v_active := (payload->>'active_version')::smallint;
  v_v1 := (payload->>'v1_key_present')::boolean;
  v_v2 := (payload->>'v2_key_present')::boolean;
  v_lazy := (payload->>'lazy_rotation_enabled')::boolean;

  IF v_active NOT IN (1,2) OR v_v1 IS NULL OR v_v2 IS NULL OR v_lazy IS NULL THEN
    RAISE EXCEPTION 'invalid LINE runtime health values';
  END IF;
  IF v_lazy AND (v_active<>2 OR NOT v_v1 OR NOT v_v2) THEN
    RAISE EXCEPTION 'unsafe LINE lazy rotation runtime';
  END IF;

  INSERT INTO private_line.line_runtime_health(
    singleton,active_encryption_version,v1_key_present,v2_key_present,lazy_rotation_enabled,last_reported_at
  ) VALUES (true,v_active,v_v1,v_v2,v_lazy,now())
  ON CONFLICT(singleton) DO UPDATE SET
    active_encryption_version=EXCLUDED.active_encryption_version,
    v1_key_present=EXCLUDED.v1_key_present,
    v2_key_present=EXCLUDED.v2_key_present,
    lazy_rotation_enabled=EXCLUDED.lazy_rotation_enabled,
    last_reported_at=now();

  RETURN QUERY SELECT 'recorded'::text;
END
$ingress_record_line_runtime_health$;

CREATE OR REPLACE FUNCTION private_line.admin_register_customer_drive_folder(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_register_customer_drive_folder$
DECLARE
  v_customer_id uuid;
  v_external_folder_id text;
  v_folder_digest text;
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR NOT private_line.safe_json_keys_only(payload,ARRAY['customer_id','external_folder_id','folder_id_digest','permission_state']::text[])
  THEN RAISE EXCEPTION 'invalid Drive folder payload'; END IF;
  IF payload->>'permission_state'<>'private' THEN RAISE EXCEPTION 'Drive folder must be private'; END IF;

  v_customer_id := (payload->>'customer_id')::uuid;
  v_external_folder_id := payload->>'external_folder_id';
  v_folder_digest := payload->>'folder_id_digest';
  IF v_external_folder_id !~ '^[A-Za-z0-9_-]{10,200}$' OR NOT private_line.safe_hex_digest(v_folder_digest) THEN
    RAISE EXCEPTION 'invalid Drive folder identity';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.customer WHERE customer_id=v_customer_id) THEN
    RAISE EXCEPTION 'customer not found';
  END IF;

  INSERT INTO private_line.customer_drive_folder(
    customer_id,external_folder_id,folder_id_digest,status,permission_state,updated_at
  ) VALUES (v_customer_id,v_external_folder_id,v_folder_digest,'ready','private',now())
  ON CONFLICT(customer_id) DO UPDATE SET
    external_folder_id=EXCLUDED.external_folder_id,
    folder_id_digest=EXCLUDED.folder_id_digest,
    status='ready',
    permission_state='private',
    updated_at=now();
  RETURN QUERY SELECT 'ready'::text;
END
$admin_register_customer_drive_folder$;

CREATE OR REPLACE FUNCTION private_line.admin_read_document_fetch_source(p_document_id uuid)
RETURNS TABLE(
  provider_message_ciphertext_b64 text,
  provider_message_nonce_b64 text,
  provider_message_auth_tag_b64 text,
  provider_message_key_version smallint,
  message_type text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_document_fetch_source$
  SELECT
    m.provider_message_ciphertext_b64,
    m.provider_message_nonce_b64,
    m.provider_message_auth_tag_b64,
    m.provider_message_key_version,
    m.message_type
  FROM private_line.document d
  JOIN private_line.message m ON m.message_id=d.message_id
  WHERE d.document_id=p_document_id
    AND d.status IN ('pending_fetch','failed')
    AND m.status<>'unsent'
    AND m.provider_message_ciphertext_b64 IS NOT NULL
    AND m.provider_message_nonce_b64 IS NOT NULL
    AND m.provider_message_auth_tag_b64 IS NOT NULL
    AND m.provider_message_key_version IS NOT NULL
$admin_read_document_fetch_source$;

CREATE OR REPLACE FUNCTION private_line.admin_checkpoint_document_fetch(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_checkpoint_document_fetch$
DECLARE
  v_document_id uuid;
  v_result text;
  v_error_class text;
  v_provider_status integer;
  v_attempt integer;
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR NOT private_line.safe_json_keys_only(payload,ARRAY['document_id','result','error_class','provider_status_code']::text[])
  THEN RAISE EXCEPTION 'invalid document fetch checkpoint payload'; END IF;
  v_document_id := (payload->>'document_id')::uuid;
  v_result := payload->>'result';
  v_error_class := NULLIF(payload->>'error_class','');
  v_provider_status := NULLIF(payload->>'provider_status_code','')::integer;
  IF v_result NOT IN ('ready_for_upload','failed','reconciliation_required') THEN RAISE EXCEPTION 'invalid fetch result'; END IF;
  IF v_error_class IS NOT NULL AND NOT private_line.safe_id(v_error_class) THEN RAISE EXCEPTION 'invalid fetch error class'; END IF;

  UPDATE private_line.document_storage_object
  SET status=CASE WHEN v_result='ready_for_upload' THEN 'pending_upload' ELSE v_result END,
      attempt_count=attempt_count+1,
      last_error_class=v_error_class,
      next_retry_at=CASE WHEN v_result='failed' THEN now()+interval '15 minutes' ELSE NULL END,
      updated_at=now()
  WHERE document_id=v_document_id
  RETURNING attempt_count INTO v_attempt;
  IF v_attempt IS NULL THEN RAISE EXCEPTION 'document storage object not found'; END IF;

  INSERT INTO private_line.document_media_attempt(document_id,operation,attempt_number,status,error_class,provider_status_code)
  VALUES (
    v_document_id,'fetch',v_attempt,
    CASE WHEN v_result='ready_for_upload' THEN 'succeeded' ELSE v_result END,
    v_error_class,v_provider_status
  ) ON CONFLICT(document_id,operation,attempt_number) DO NOTHING;

  IF v_result<>'ready_for_upload' THEN
    UPDATE private_line.document
    SET status='failed',updated_at=now()
    WHERE document_id=v_document_id AND status NOT IN ('revoke_required','revoked','deleted');
  END IF;

  RETURN QUERY SELECT v_result;
END
$admin_checkpoint_document_fetch$;

CREATE OR REPLACE FUNCTION private_line.admin_prepare_document_upload(payload jsonb)
RETURNS TABLE(outcome text, external_folder_id text, upload_idempotency_digest text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_prepare_document_upload$
DECLARE
  v_document_id uuid;
  v_upload_digest text;
  v_document private_line.document%ROWTYPE;
  v_folder private_line.customer_drive_folder%ROWTYPE;
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR NOT private_line.safe_json_keys_only(payload,ARRAY['document_id','upload_idempotency_digest']::text[])
  THEN RAISE EXCEPTION 'invalid document upload payload'; END IF;
  v_document_id := (payload->>'document_id')::uuid;
  v_upload_digest := payload->>'upload_idempotency_digest';
  IF NOT private_line.safe_hex_digest(v_upload_digest) THEN RAISE EXCEPTION 'invalid upload digest'; END IF;

  SELECT * INTO v_document FROM private_line.document WHERE document_id=v_document_id FOR UPDATE;
  IF v_document.document_id IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;
  IF v_document.status IN ('revoke_required','revoked','deleted') THEN RAISE EXCEPTION 'document not uploadable'; END IF;

  SELECT * INTO v_folder FROM private_line.customer_drive_folder
  WHERE customer_id=v_document.customer_id AND status='ready' AND permission_state='private';
  IF v_folder.customer_id IS NULL THEN
    RETURN QUERY SELECT 'drive_authorization_required'::text,NULL::text,v_upload_digest;
    RETURN;
  END IF;

  INSERT INTO private_line.document_storage_object(
    document_id,customer_id,external_folder_id,upload_idempotency_digest,status,permission_state,updated_at
  ) VALUES (
    v_document.document_id,v_document.customer_id,v_folder.external_folder_id,v_upload_digest,'pending_upload','private',now()
  )
  ON CONFLICT(document_id) DO UPDATE SET
    external_folder_id=EXCLUDED.external_folder_id,
    upload_idempotency_digest=COALESCE(private_line.document_storage_object.upload_idempotency_digest,EXCLUDED.upload_idempotency_digest),
    permission_state='private',
    status=CASE
      WHEN private_line.document_storage_object.status='stored' THEN 'stored'
      ELSE 'pending_upload'
    END,
    last_error_class=NULL,
    next_retry_at=NULL,
    updated_at=now();

  RETURN QUERY
  SELECT
    CASE WHEN dso.status='stored' THEN 'already_stored' ELSE 'ready' END,
    dso.external_folder_id,
    dso.upload_idempotency_digest
  FROM private_line.document_storage_object dso
  WHERE dso.document_id=v_document_id;
END
$admin_prepare_document_upload$;

CREATE OR REPLACE FUNCTION private_line.admin_checkpoint_document_upload(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_checkpoint_document_upload$
DECLARE
  v_document_id uuid;
  v_result text;
  v_external_file_id text;
  v_external_file_digest text;
  v_mime_type text;
  v_byte_size bigint;
  v_error_class text;
  v_provider_status integer;
  v_attempt integer;
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR NOT private_line.safe_json_keys_only(payload,ARRAY['document_id','result','external_file_id','external_file_id_digest','mime_type','byte_size','error_class','provider_status_code']::text[])
  THEN RAISE EXCEPTION 'invalid document checkpoint payload'; END IF;

  v_document_id := (payload->>'document_id')::uuid;
  v_result := payload->>'result';
  v_external_file_id := NULLIF(payload->>'external_file_id','');
  v_external_file_digest := NULLIF(payload->>'external_file_id_digest','');
  v_mime_type := NULLIF(payload->>'mime_type','');
  v_byte_size := NULLIF(payload->>'byte_size','')::bigint;
  v_error_class := NULLIF(payload->>'error_class','');
  v_provider_status := NULLIF(payload->>'provider_status_code','')::integer;

  IF v_result NOT IN ('stored','failed','reconciliation_required') THEN RAISE EXCEPTION 'invalid document checkpoint result'; END IF;
  IF v_external_file_id IS NOT NULL AND v_external_file_id !~ '^[A-Za-z0-9_-]{10,200}$' THEN RAISE EXCEPTION 'invalid external file id'; END IF;
  IF v_external_file_digest IS NOT NULL AND NOT private_line.safe_hex_digest(v_external_file_digest) THEN RAISE EXCEPTION 'invalid external file digest'; END IF;
  IF v_error_class IS NOT NULL AND NOT private_line.safe_id(v_error_class) THEN RAISE EXCEPTION 'invalid document error class'; END IF;
  IF v_byte_size IS NOT NULL AND v_byte_size<0 THEN RAISE EXCEPTION 'invalid document byte size'; END IF;
  IF v_result='stored' AND (v_external_file_id IS NULL OR v_external_file_digest IS NULL OR v_mime_type IS NULL) THEN
    RAISE EXCEPTION 'stored document requires verified metadata';
  END IF;

  UPDATE private_line.document_storage_object
  SET external_file_id=COALESCE(v_external_file_id,external_file_id),
      external_file_id_digest=COALESCE(v_external_file_digest,external_file_id_digest),
      status=v_result,
      permission_state=CASE WHEN v_result='stored' THEN 'private' ELSE permission_state END,
      attempt_count=attempt_count+1,
      last_error_class=v_error_class,
      next_retry_at=CASE WHEN v_result='failed' THEN now()+interval '15 minutes' ELSE NULL END,
      stored_at=CASE WHEN v_result='stored' THEN COALESCE(stored_at,now()) ELSE stored_at END,
      updated_at=now()
  WHERE document_id=v_document_id
  RETURNING attempt_count INTO v_attempt;
  IF v_attempt IS NULL THEN RAISE EXCEPTION 'document storage object not prepared'; END IF;

  INSERT INTO private_line.document_media_attempt(document_id,operation,attempt_number,status,error_class,provider_status_code)
  VALUES (
    v_document_id,'upload',v_attempt,
    CASE WHEN v_result='stored' THEN 'succeeded' ELSE v_result END,
    v_error_class,v_provider_status
  ) ON CONFLICT(document_id,operation,attempt_number) DO NOTHING;

  IF v_result='stored' THEN
    UPDATE private_line.document d
    SET external_file_id=v_external_file_id,
        external_folder_id=(SELECT dso.external_folder_id FROM private_line.document_storage_object dso WHERE dso.document_id=v_document_id),
        mime_type=v_mime_type,
        byte_size=v_byte_size,
        status='stored',
        updated_at=now()
    WHERE d.document_id=v_document_id;
  ELSE
    UPDATE private_line.document
    SET status='failed',updated_at=now()
    WHERE document_id=v_document_id AND status NOT IN ('revoke_required','revoked','deleted');
  END IF;

  RETURN QUERY SELECT v_result;
END
$admin_checkpoint_document_upload$;

CREATE OR REPLACE FUNCTION private_line.admin_read_document_storage_target(p_document_id uuid)
RETURNS TABLE(
  external_file_id text,
  external_folder_id text,
  upload_idempotency_digest text,
  storage_status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_document_storage_target$
  SELECT dso.external_file_id,dso.external_folder_id,dso.upload_idempotency_digest,dso.status
  FROM private_line.document_storage_object dso
  WHERE dso.document_id=p_document_id
$admin_read_document_storage_target$;

CREATE OR REPLACE FUNCTION private_line.admin_checkpoint_document_revoke(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_checkpoint_document_revoke$
DECLARE
  v_document_id uuid;
  v_result text;
  v_error_class text;
  v_provider_status integer;
  v_attempt integer;
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR NOT private_line.safe_json_keys_only(payload,ARRAY['document_id','result','error_class','provider_status_code']::text[])
  THEN RAISE EXCEPTION 'invalid document revoke payload'; END IF;
  v_document_id := (payload->>'document_id')::uuid;
  v_result := payload->>'result';
  v_error_class := NULLIF(payload->>'error_class','');
  v_provider_status := NULLIF(payload->>'provider_status_code','')::integer;
  IF v_result NOT IN ('revoked','deleted','failed','reconciliation_required') THEN RAISE EXCEPTION 'invalid revoke result'; END IF;
  IF v_error_class IS NOT NULL AND NOT private_line.safe_id(v_error_class) THEN RAISE EXCEPTION 'invalid revoke error class'; END IF;

  UPDATE private_line.document_storage_object
  SET status=v_result,
      attempt_count=attempt_count+1,
      last_error_class=v_error_class,
      next_retry_at=CASE WHEN v_result='failed' THEN now()+interval '15 minutes' ELSE NULL END,
      revoked_at=CASE WHEN v_result IN ('revoked','deleted') THEN COALESCE(revoked_at,now()) ELSE revoked_at END,
      external_file_id=CASE WHEN v_result IN ('revoked','deleted') THEN NULL ELSE external_file_id END,
      updated_at=now()
  WHERE document_id=v_document_id
  RETURNING attempt_count INTO v_attempt;
  IF v_attempt IS NULL THEN RAISE EXCEPTION 'document storage object not found'; END IF;

  INSERT INTO private_line.document_media_attempt(document_id,operation,attempt_number,status,error_class,provider_status_code)
  VALUES (
    v_document_id,'revoke',v_attempt,
    CASE WHEN v_result IN ('revoked','deleted') THEN 'succeeded' ELSE v_result END,
    v_error_class,v_provider_status
  ) ON CONFLICT(document_id,operation,attempt_number) DO NOTHING;

  UPDATE private_line.document
  SET status=CASE WHEN v_result IN ('revoked','deleted') THEN v_result ELSE 'revoke_required' END,
      external_file_id=CASE WHEN v_result IN ('revoked','deleted') THEN NULL ELSE external_file_id END,
      updated_at=now()
  WHERE document_id=v_document_id;

  RETURN QUERY SELECT v_result;
END
$admin_checkpoint_document_revoke$;

CREATE OR REPLACE FUNCTION private_line.admin_read_document_media_health()
RETURNS TABLE(
  web_runtime_active_v2 boolean,
  web_runtime_v1_key_present boolean,
  web_runtime_v2_key_present boolean,
  web_runtime_lazy_rotation_enabled boolean,
  web_runtime_last_reported_at timestamptz,
  drive_folder_ready bigint,
  drive_folder_unsafe bigint,
  document_pending_fetch bigint,
  document_pending_upload bigint,
  document_stored bigint,
  document_failed bigint,
  document_revoke_required bigint,
  document_reconciliation bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_document_media_health$
  SELECT
    COALESCE((SELECT active_encryption_version=2 FROM private_line.line_runtime_health WHERE singleton=true),false),
    COALESCE((SELECT v1_key_present FROM private_line.line_runtime_health WHERE singleton=true),false),
    COALESCE((SELECT v2_key_present FROM private_line.line_runtime_health WHERE singleton=true),false),
    COALESCE((SELECT lazy_rotation_enabled FROM private_line.line_runtime_health WHERE singleton=true),false),
    (SELECT last_reported_at FROM private_line.line_runtime_health WHERE singleton=true),
    (SELECT count(*) FROM private_line.customer_drive_folder WHERE status='ready' AND permission_state='private'),
    (SELECT count(*) FROM private_line.customer_drive_folder WHERE permission_state='unsafe'),
    (SELECT count(*) FROM private_line.document_storage_object WHERE status='pending_fetch'),
    (SELECT count(*) FROM private_line.document_storage_object WHERE status='pending_upload'),
    (SELECT count(*) FROM private_line.document_storage_object WHERE status='stored'),
    (SELECT count(*) FROM private_line.document_storage_object WHERE status='failed'),
    (SELECT count(*) FROM private_line.document_storage_object WHERE status='revoke_required'),
    (SELECT count(*) FROM private_line.document_storage_object WHERE status='reconciliation_required')
$admin_read_document_media_health$;

REVOKE ALL PRIVILEGES ON TABLE
  private_line.line_runtime_health,
  private_line.customer_drive_folder,
  private_line.document_storage_object,
  private_line.document_media_attempt
FROM ccpun_admin_runtime;
REVOKE ALL PRIVILEGES ON TABLE
  private_line.line_runtime_health,
  private_line.customer_drive_folder,
  private_line.document_storage_object,
  private_line.document_media_attempt
FROM ccpun_line_ingress;

REVOKE ALL ON FUNCTION private_line.sync_document_storage_object() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.sync_document_storage_object() FROM ccpun_admin_runtime;
REVOKE ALL ON FUNCTION private_line.sync_document_storage_object() FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.ingress_record_line_runtime_health(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.ingress_record_line_runtime_health(jsonb) FROM ccpun_admin_runtime;
REVOKE ALL ON FUNCTION private_line.admin_register_customer_drive_folder(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_register_customer_drive_folder(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_document_fetch_source(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_document_fetch_source(uuid) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_checkpoint_document_fetch(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_checkpoint_document_fetch(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_prepare_document_upload(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_prepare_document_upload(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_checkpoint_document_upload(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_checkpoint_document_upload(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_document_storage_target(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_document_storage_target(uuid) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_checkpoint_document_revoke(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_checkpoint_document_revoke(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_document_media_health() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_document_media_health() FROM ccpun_line_ingress;

GRANT EXECUTE ON FUNCTION private_line.ingress_record_line_runtime_health(jsonb) TO ccpun_line_ingress;
GRANT EXECUTE ON FUNCTION private_line.admin_register_customer_drive_folder(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_document_fetch_source(uuid) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_checkpoint_document_fetch(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_prepare_document_upload(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_checkpoint_document_upload(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_document_storage_target(uuid) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_checkpoint_document_revoke(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_document_media_health() TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum) VALUES('20260918_line_document_media_activation_v1_uat','sha256:fcab7e746a62850711493cfa849548975c6dfdb8365417d3b142fdc26ae1026f') ON CONFLICT(version) DO NOTHING;
COMMIT;

BEGIN;

CREATE SCHEMA IF NOT EXISTS private_line;

CREATE TABLE IF NOT EXISTS private_line.schema_migration (
  version text PRIMARY KEY,
  checksum text NOT NULL CHECK (checksum ~ '^sha256:[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now()
);

DO $migration_guard$
DECLARE
  current_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN
    RAISE EXCEPTION 'CCPun private LINE migration requires database neondb';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260917_private_line_runtime_v1_uat'));
  SELECT checksum INTO current_checksum
  FROM private_line.schema_migration
  WHERE version = '20260917_private_line_runtime_v1_uat';

  IF current_checksum IS NOT NULL AND current_checksum <> 'sha256:19a7dfaf26d2cc4f6cbf01d7ff2380056383f8e87dd079a6e141e73b878985d3' THEN
    RAISE EXCEPTION 'CCPun private LINE migration checksum mismatch';
  END IF;

  IF current_checksum IS NULL AND (
    to_regclass('private_line.customer') IS NOT NULL OR
    to_regclass('private_line.provider_identity') IS NOT NULL OR
    to_regclass('private_line.conversation') IS NOT NULL OR
    to_regclass('private_line.message') IS NOT NULL OR
    to_regclass('private_line.webhook_event') IS NOT NULL OR
    to_regclass('private_line.system_identity') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'CCPun private LINE schema exists without the current migration ledger';
  END IF;
END
$migration_guard$;

-- checksum-source-begin
CREATE TABLE IF NOT EXISTS private_line.system_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  project_id text NOT NULL CHECK (project_id = 'young-term-47483330'),
  branch_id text NOT NULL CHECK (branch_id = 'br-crimson-mouse-az7ajkv8'),
  endpoint_id text NOT NULL CHECK (endpoint_id = 'ep-mute-frost-aztvz394'),
  database_name text NOT NULL CHECK (database_name = 'neondb'),
  migration_version text NOT NULL CHECK (migration_version = '20260917_private_line_runtime_v1_uat'),
  migration_checksum text NOT NULL CHECK (migration_checksum ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.customer (
  customer_id uuid PRIMARY KEY,
  customer_code text NOT NULL UNIQUE CHECK (customer_code ~ '^C[0-9A-F]{32}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.provider_identity (
  identity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES private_line.customer(customer_id),
  provider text NOT NULL CHECK (provider = 'line'),
  external_ref_digest text NOT NULL UNIQUE CHECK (external_ref_digest ~ '^[0-9a-f]{64}$'),
  external_ref_ciphertext_b64 text NOT NULL,
  external_ref_nonce_b64 text NOT NULL,
  external_ref_auth_tag_b64 text NOT NULL,
  key_version smallint NOT NULL CHECK (key_version > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.conversation (
  conversation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL UNIQUE REFERENCES private_line.provider_identity(identity_id),
  channel text NOT NULL CHECK (channel = 'line'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  last_activity_at timestamptz,
  journey text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.webhook_event (
  event_digest text PRIMARY KEY CHECK (event_digest ~ '^[0-9a-f]{64}$'),
  event_type text NOT NULL CHECK (event_type IN ('message','follow','unfollow','postback','unsend')),
  occurred_at timestamptz NOT NULL,
  is_redelivery boolean NOT NULL DEFAULT false,
  source_type text NOT NULL CHECK (source_type IN ('user','group','room','unknown')),
  outcome text NOT NULL DEFAULT 'processing' CHECK (outcome IN ('processing','accepted','duplicate_message','unsend_applied','unsend_pending')),
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.message (
  message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES private_line.conversation(conversation_id),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  provider_message_digest text NOT NULL UNIQUE CHECK (provider_message_digest ~ '^[0-9a-f]{64}$'),
  provider_message_ciphertext_b64 text,
  provider_message_nonce_b64 text,
  provider_message_auth_tag_b64 text,
  provider_message_key_version smallint CHECK (provider_message_key_version IS NULL OR provider_message_key_version > 0),
  message_type text NOT NULL CHECK (message_type IN ('text','image','video','audio','file','location','sticker')),
  content_ciphertext_b64 text,
  content_nonce_b64 text,
  content_auth_tag_b64 text,
  content_key_version smallint CHECK (content_key_version IS NULL OR content_key_version > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','unsent','delivery_pending','sent','failed')),
  needs_human boolean NOT NULL DEFAULT true,
  received_at timestamptz NOT NULL,
  unsent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((content_ciphertext_b64 IS NULL) = (content_nonce_b64 IS NULL)),
  CHECK ((content_ciphertext_b64 IS NULL) = (content_auth_tag_b64 IS NULL)),
  CHECK ((content_ciphertext_b64 IS NULL) = (content_key_version IS NULL))
);

CREATE TABLE IF NOT EXISTS private_line.document (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES private_line.customer(customer_id),
  conversation_id uuid NOT NULL REFERENCES private_line.conversation(conversation_id),
  message_id uuid NOT NULL UNIQUE REFERENCES private_line.message(message_id),
  storage_provider text NOT NULL DEFAULT 'google_drive' CHECK (storage_provider IN ('google_drive')),
  external_file_id text,
  external_folder_id text,
  mime_type text,
  byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  document_category text NOT NULL DEFAULT 'LINE Attachments' CHECK (document_category IN ('LINE Attachments','Insurance','Quotations','Other Documents')),
  status text NOT NULL DEFAULT 'pending_fetch' CHECK (status IN ('pending_fetch','stored','revoke_required','revoked','deleted','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.lead (
  lead_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES private_line.customer(customer_id),
  conversation_id uuid NOT NULL REFERENCES private_line.conversation(conversation_id),
  journey text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('New','Qualified','Expert Review','Solution','Quote','Implementation','Won','Lost')),
  material_received boolean NOT NULL DEFAULT false,
  source_origin text NOT NULL DEFAULT 'line',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS private_line_lead_open_customer_idx
  ON private_line.lead (customer_id, updated_at DESC)
  WHERE stage NOT IN ('Won','Lost');

CREATE TABLE IF NOT EXISTS private_line.advisor_case (
  advisor_case_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES private_line.lead(lead_id),
  conversation_id uuid NOT NULL REFERENCES private_line.conversation(conversation_id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  assigned_advisor text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  follow_up_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.safe_journey_state (
  customer_id uuid PRIMARY KEY REFERENCES private_line.customer(customer_id),
  journey text NOT NULL CHECK (journey ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  stage text NOT NULL CHECK (stage ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  material_received boolean NOT NULL DEFAULT false,
  needs_human boolean NOT NULL DEFAULT false,
  content_id text CHECK (content_id IS NULL OR content_id ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.message_tombstone (
  provider_message_digest text PRIMARY KEY CHECK (provider_message_digest ~ '^[0-9a-f]{64}$'),
  unsent_at timestamptz NOT NULL,
  message_id uuid,
  content_purged boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $runtime_role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_line_ingress') THEN
    CREATE ROLE ccpun_line_ingress NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  ELSE
    ALTER ROLE ccpun_line_ingress WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$runtime_role$;

CREATE OR REPLACE FUNCTION private_line.ingest_line_event(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $function$
DECLARE
  v_event_digest text;
  v_event_type text;
  v_occurred_at timestamptz;
  v_source_type text;
  v_identity_digest text;
  v_customer_id uuid;
  v_identity_id uuid;
  v_conversation_id uuid;
  v_provider_message_digest text;
  v_message_id uuid;
  v_unsend_digest text;
  v_inserted integer;
  v_tombstoned boolean := false;
  v_material_received boolean := false;
  v_lead_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM private_line.system_identity
    WHERE singleton = true
      AND project_id = 'young-term-47483330'
      AND branch_id = 'br-crimson-mouse-az7ajkv8'
      AND endpoint_id = 'ep-mute-frost-aztvz394'
      AND database_name = 'neondb'
      AND migration_version = '20260917_private_line_runtime_v1_uat'
  ) THEN
    RAISE EXCEPTION 'private LINE runtime identity mismatch';
  END IF;

  IF jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'private LINE payload must be an object';
  END IF;

  v_event_digest := payload->>'event_digest';
  v_event_type := payload->>'event_type';
  v_occurred_at := (payload->>'occurred_at')::timestamptz;
  v_source_type := payload->>'source_type';
  IF v_event_digest !~ '^[0-9a-f]{64}$'
    OR v_event_type NOT IN ('message','follow','unfollow','postback','unsend')
    OR v_source_type NOT IN ('user','group','room','unknown')
  THEN
    RAISE EXCEPTION 'private LINE payload validation failed';
  END IF;

  INSERT INTO private_line.webhook_event (
    event_digest, event_type, occurred_at, is_redelivery, source_type
  ) VALUES (
    v_event_digest, v_event_type, v_occurred_at,
    COALESCE((payload->>'is_redelivery')::boolean, false), v_source_type
  ) ON CONFLICT (event_digest) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN QUERY SELECT 'duplicate_event'::text;
    RETURN;
  END IF;

  IF v_event_type = 'unsend' THEN
    v_unsend_digest := payload->>'unsend_target_digest';
    IF v_unsend_digest !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'private LINE unsend target invalid';
    END IF;

    INSERT INTO private_line.message_tombstone (provider_message_digest, unsent_at)
    VALUES (v_unsend_digest, v_occurred_at)
    ON CONFLICT (provider_message_digest) DO UPDATE SET
      unsent_at = LEAST(private_line.message_tombstone.unsent_at, EXCLUDED.unsent_at),
      content_purged = true;

    UPDATE private_line.message
    SET provider_message_ciphertext_b64 = NULL,
        provider_message_nonce_b64 = NULL,
        provider_message_auth_tag_b64 = NULL,
        provider_message_key_version = NULL,
        content_ciphertext_b64 = NULL,
        content_nonce_b64 = NULL,
        content_auth_tag_b64 = NULL,
        content_key_version = NULL,
        status = 'unsent',
        unsent_at = v_occurred_at,
        needs_human = false,
        updated_at = now()
    WHERE provider_message_digest = v_unsend_digest
    RETURNING message_id INTO v_message_id;

    IF v_message_id IS NOT NULL THEN
      UPDATE private_line.message_tombstone
      SET message_id = v_message_id
      WHERE provider_message_digest = v_unsend_digest;
      UPDATE private_line.document
      SET status = CASE WHEN status IN ('revoked','deleted') THEN status ELSE 'revoke_required' END,
          external_file_id = NULL,
          updated_at = now()
      WHERE message_id = v_message_id;
      UPDATE private_line.webhook_event SET outcome = 'unsend_applied' WHERE event_digest = v_event_digest;
      RETURN QUERY SELECT 'unsend_applied'::text;
    ELSE
      UPDATE private_line.webhook_event SET outcome = 'unsend_pending' WHERE event_digest = v_event_digest;
      RETURN QUERY SELECT 'unsend_pending'::text;
    END IF;
    RETURN;
  END IF;

  IF jsonb_typeof(payload->'identity') <> 'object' THEN
    RAISE EXCEPTION 'private LINE identity required';
  END IF;
  v_identity_digest := payload->'identity'->>'lookup_digest';
  IF v_identity_digest !~ '^[0-9a-f]{64}$'
    OR COALESCE(length(payload->'identity'->>'ciphertext_b64'), 0) = 0
    OR COALESCE(length(payload->'identity'->>'nonce_b64'), 0) = 0
    OR COALESCE(length(payload->'identity'->>'auth_tag_b64'), 0) = 0
    OR COALESCE((payload->'identity'->>'key_version')::integer, 0) <= 0
  THEN
    RAISE EXCEPTION 'private LINE identity validation failed';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_identity_digest));
  SELECT identity_id, customer_id INTO v_identity_id, v_customer_id
  FROM private_line.provider_identity
  WHERE provider = 'line' AND external_ref_digest = v_identity_digest;

  IF v_identity_id IS NULL THEN
    v_customer_id := gen_random_uuid();
    INSERT INTO private_line.customer (customer_id, customer_code)
    VALUES (v_customer_id, 'C' || upper(replace(v_customer_id::text, '-', '')));
    INSERT INTO private_line.provider_identity (
      customer_id, provider, external_ref_digest, external_ref_ciphertext_b64,
      external_ref_nonce_b64, external_ref_auth_tag_b64, key_version
    ) VALUES (
      v_customer_id, 'line', v_identity_digest,
      payload->'identity'->>'ciphertext_b64', payload->'identity'->>'nonce_b64',
      payload->'identity'->>'auth_tag_b64', (payload->'identity'->>'key_version')::smallint
    ) RETURNING identity_id INTO v_identity_id;
  ELSE
    UPDATE private_line.provider_identity
    SET external_ref_ciphertext_b64 = payload->'identity'->>'ciphertext_b64',
        external_ref_nonce_b64 = payload->'identity'->>'nonce_b64',
        external_ref_auth_tag_b64 = payload->'identity'->>'auth_tag_b64',
        key_version = (payload->'identity'->>'key_version')::smallint,
        active = true,
        updated_at = now()
    WHERE identity_id = v_identity_id;
  END IF;

  INSERT INTO private_line.conversation (identity_id, channel, status, last_activity_at)
  VALUES (v_identity_id, 'line', 'open', v_occurred_at)
  ON CONFLICT (identity_id) DO UPDATE SET
    last_activity_at = GREATEST(COALESCE(private_line.conversation.last_activity_at, EXCLUDED.last_activity_at), EXCLUDED.last_activity_at),
    updated_at = now()
  RETURNING conversation_id INTO v_conversation_id;

  IF v_event_type = 'follow' THEN
    UPDATE private_line.provider_identity SET active = true, updated_at = now() WHERE identity_id = v_identity_id;
    UPDATE private_line.conversation SET status = 'open', updated_at = now() WHERE conversation_id = v_conversation_id;
    UPDATE private_line.webhook_event SET outcome = 'accepted' WHERE event_digest = v_event_digest;
    RETURN QUERY SELECT 'accepted'::text;
    RETURN;
  ELSIF v_event_type = 'unfollow' THEN
    UPDATE private_line.provider_identity SET active = false, updated_at = now() WHERE identity_id = v_identity_id;
    UPDATE private_line.conversation SET status = 'closed', updated_at = now() WHERE conversation_id = v_conversation_id;
    UPDATE private_line.webhook_event SET outcome = 'accepted' WHERE event_digest = v_event_digest;
    RETURN QUERY SELECT 'accepted'::text;
    RETURN;
  ELSIF v_event_type = 'postback' THEN
    UPDATE private_line.webhook_event SET outcome = 'accepted' WHERE event_digest = v_event_digest;
    RETURN QUERY SELECT 'accepted'::text;
    RETURN;
  END IF;

  IF jsonb_typeof(payload->'message') <> 'object' THEN
    RAISE EXCEPTION 'private LINE message required';
  END IF;
  v_provider_message_digest := payload->'message'->>'provider_message_digest';
  v_material_received := COALESCE((payload->'message'->>'material_received')::boolean, false);
  IF v_provider_message_digest !~ '^[0-9a-f]{64}$'
    OR payload->'message'->>'message_type' NOT IN ('text','image','video','audio','file','location','sticker')
  THEN
    RAISE EXCEPTION 'private LINE message validation failed';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM private_line.message_tombstone WHERE provider_message_digest = v_provider_message_digest
  ) INTO v_tombstoned;

  INSERT INTO private_line.message (
    conversation_id, direction, provider_message_digest,
    provider_message_ciphertext_b64, provider_message_nonce_b64,
    provider_message_auth_tag_b64, provider_message_key_version,
    message_type, content_ciphertext_b64, content_nonce_b64,
    content_auth_tag_b64, content_key_version, status, needs_human, received_at,
    unsent_at
  ) VALUES (
    v_conversation_id, 'inbound', v_provider_message_digest,
    CASE WHEN v_tombstoned THEN NULL ELSE payload->'message'->>'provider_message_ciphertext_b64' END,
    CASE WHEN v_tombstoned THEN NULL ELSE payload->'message'->>'provider_message_nonce_b64' END,
    CASE WHEN v_tombstoned THEN NULL ELSE payload->'message'->>'provider_message_auth_tag_b64' END,
    CASE WHEN v_tombstoned THEN NULL ELSE (payload->'message'->>'provider_message_key_version')::smallint END,
    payload->'message'->>'message_type',
    CASE WHEN v_tombstoned THEN NULL ELSE payload->'message'->'content'->>'ciphertext_b64' END,
    CASE WHEN v_tombstoned THEN NULL ELSE payload->'message'->'content'->>'nonce_b64' END,
    CASE WHEN v_tombstoned THEN NULL ELSE payload->'message'->'content'->>'auth_tag_b64' END,
    CASE WHEN v_tombstoned OR payload->'message'->'content' IS NULL THEN NULL ELSE (payload->'message'->'content'->>'key_version')::smallint END,
    CASE WHEN v_tombstoned THEN 'unsent' ELSE 'active' END,
    CASE WHEN v_tombstoned THEN false ELSE COALESCE((payload->>'needs_human')::boolean, true) END,
    v_occurred_at,
    CASE WHEN v_tombstoned THEN v_occurred_at ELSE NULL END
  ) ON CONFLICT (provider_message_digest) DO NOTHING
  RETURNING message_id INTO v_message_id;

  IF v_message_id IS NULL THEN
    UPDATE private_line.webhook_event SET outcome = 'duplicate_message' WHERE event_digest = v_event_digest;
    RETURN QUERY SELECT 'duplicate_message'::text;
    RETURN;
  END IF;

  IF v_tombstoned THEN
    UPDATE private_line.message_tombstone SET message_id = v_message_id
    WHERE provider_message_digest = v_provider_message_digest;
  END IF;

  UPDATE private_line.conversation
  SET unread_count = unread_count + CASE WHEN v_tombstoned THEN 0 ELSE 1 END,
      last_activity_at = GREATEST(COALESCE(last_activity_at, v_occurred_at), v_occurred_at),
      updated_at = now()
  WHERE conversation_id = v_conversation_id;

  IF v_material_received THEN
    INSERT INTO private_line.document (
      customer_id, conversation_id, message_id, status
    ) VALUES (
      v_customer_id, v_conversation_id, v_message_id,
      CASE WHEN v_tombstoned THEN 'revoke_required' ELSE 'pending_fetch' END
    ) ON CONFLICT (message_id) DO NOTHING;
  END IF;

  IF NOT v_tombstoned AND COALESCE((payload->>'needs_human')::boolean, true) THEN
    SELECT lead_id INTO v_lead_id
    FROM private_line.lead
    WHERE customer_id = v_customer_id AND stage NOT IN ('Won','Lost')
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_lead_id IS NULL THEN
      INSERT INTO private_line.lead (
        customer_id, conversation_id, journey, stage, material_received
      ) VALUES (
        v_customer_id, v_conversation_id, 'human_handoff', 'New', v_material_received
      ) RETURNING lead_id INTO v_lead_id;
    ELSE
      UPDATE private_line.lead
      SET material_received = material_received OR v_material_received,
          updated_at = now()
      WHERE lead_id = v_lead_id;
    END IF;

    INSERT INTO private_line.advisor_case (lead_id, conversation_id)
    VALUES (v_lead_id, v_conversation_id)
    ON CONFLICT (lead_id) DO UPDATE SET updated_at = now();

    INSERT INTO private_line.safe_journey_state (
      customer_id, journey, stage, material_received, needs_human
    ) VALUES (
      v_customer_id, 'human_handoff', 'waiting_for_advisor', v_material_received, true
    ) ON CONFLICT (customer_id) DO UPDATE SET
      journey = EXCLUDED.journey,
      stage = EXCLUDED.stage,
      material_received = private_line.safe_journey_state.material_received OR EXCLUDED.material_received,
      needs_human = true,
      updated_at = now();
  END IF;

  UPDATE private_line.webhook_event SET outcome = 'accepted' WHERE event_digest = v_event_digest;
  RETURN QUERY SELECT 'accepted'::text;
END
$function$;

REVOKE ALL PRIVILEGES ON DATABASE neondb FROM ccpun_line_ingress;
GRANT CONNECT ON DATABASE neondb TO ccpun_line_ingress;
REVOKE ALL PRIVILEGES ON SCHEMA private_line FROM ccpun_line_ingress;
GRANT USAGE ON SCHEMA private_line TO ccpun_line_ingress;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA private_line FROM ccpun_line_ingress;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA private_line FROM ccpun_line_ingress;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA private_line FROM ccpun_line_ingress;
GRANT EXECUTE ON FUNCTION private_line.ingest_line_event(jsonb) TO ccpun_line_ingress;

DO $cross_schema_revoke$
DECLARE
  schema_name text;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY['ccpun_admin','ccpun_social','neon_auth'] LOOP
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = schema_name) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON SCHEMA %I FROM ccpun_line_ingress', schema_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I FROM ccpun_line_ingress', schema_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I FROM ccpun_line_ingress', schema_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA %I FROM ccpun_line_ingress', schema_name);
    END IF;
  END LOOP;
END
$cross_schema_revoke$;

REVOKE CREATE ON SCHEMA public FROM ccpun_line_ingress;
REVOKE ALL ON SCHEMA private_line FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA private_line FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private_line FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private_line FROM PUBLIC;
GRANT USAGE ON SCHEMA private_line TO ccpun_line_ingress;
GRANT EXECUTE ON FUNCTION private_line.ingest_line_event(jsonb) TO ccpun_line_ingress;
-- checksum-source-end

INSERT INTO private_line.schema_migration (version, checksum)
VALUES ('20260917_private_line_runtime_v1_uat', 'sha256:19a7dfaf26d2cc4f6cbf01d7ff2380056383f8e87dd079a6e141e73b878985d3')
ON CONFLICT (version) DO NOTHING;

INSERT INTO private_line.system_identity (
  singleton, project_id, branch_id, endpoint_id, database_name, migration_version, migration_checksum
) VALUES (
  true,
  'young-term-47483330',
  'br-crimson-mouse-az7ajkv8',
  'ep-mute-frost-aztvz394',
  'neondb',
  '20260917_private_line_runtime_v1_uat',
  'sha256:19a7dfaf26d2cc4f6cbf01d7ff2380056383f8e87dd079a6e141e73b878985d3'
) ON CONFLICT (singleton) DO UPDATE SET
  project_id = EXCLUDED.project_id,
  branch_id = EXCLUDED.branch_id,
  endpoint_id = EXCLUDED.endpoint_id,
  database_name = EXCLUDED.database_name,
  migration_version = EXCLUDED.migration_version,
  migration_checksum = EXCLUDED.migration_checksum;

COMMIT;

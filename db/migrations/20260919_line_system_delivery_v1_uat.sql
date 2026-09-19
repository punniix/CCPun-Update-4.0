BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database()<>'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM private_line.schema_migration
    WHERE version='20260918_line_delivery_activation_v1_uat'
      AND checksum='sha256:0ae7539cbc55299979f1821984875181e66259efec4ddc16cc3e549a056eabfa'
  ) THEN RAISE EXCEPTION 'LINE delivery activation v1 missing'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM private_line.schema_migration
    WHERE version='20260918_line_postback_context_v1_uat'
      AND checksum='sha256:e3f015b5d8cba805d9856333bfedffa1a33cd7f6a87892f69e634fe1f7a6f5ca'
  ) THEN RAISE EXCEPTION 'LINE postback context v1 missing'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM private_line.system_identity
    WHERE singleton=true
      AND project_id='young-term-47483330'
      AND branch_id='br-crimson-mouse-az7ajkv8'
      AND endpoint_id='ep-mute-frost-aztvz394'
      AND database_name='neondb'
  ) THEN RAISE EXCEPTION 'LINE runtime identity changed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260919_line_system_delivery_v1'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260919_line_system_delivery_v1_uat';
  IF existing_checksum IS NOT NULL AND existing_checksum<>'sha256:61d1e71b9ca7a0f27e2dd99f0902a514dff7216e5bfbcbc7bd1fda9e04b47e45' THEN
    RAISE EXCEPTION 'LINE system delivery checksum mismatch';
  END IF;
END
$guard$;
-- checksum-source-begin
ALTER TABLE private_line.outbound_message
  ADD COLUMN IF NOT EXISTS dispatch_token_digest text;

ALTER TABLE private_line.outbound_message
  ALTER COLUMN lead_id DROP NOT NULL;

ALTER TABLE private_line.outbound_message
  DROP CONSTRAINT IF EXISTS outbound_message_system_delivery_contract;

ALTER TABLE private_line.outbound_message
  ADD CONSTRAINT outbound_message_system_delivery_contract CHECK (
    (
      message_kind='system_notice'
      AND lead_id IS NULL
      AND advisor_case_id IS NULL
      AND dispatch_token_digest IS NOT NULL
      AND private_line.safe_hex_digest(dispatch_token_digest)
    )
    OR
    (
      message_kind<>'system_notice'
      AND lead_id IS NOT NULL
      AND dispatch_token_digest IS NULL
    )
  );

CREATE OR REPLACE FUNCTION private_line.line_delivery_retry_class(p_error_class text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, private_line
AS $line_delivery_retry_class$
  SELECT CASE
    WHEN p_error_class IS NULL OR btrim(p_error_class)='' THEN 'permanent'
    WHEN p_error_class IN ('rate_limited','provider_unavailable','content_unavailable') THEN 'retryable'
    WHEN p_error_class='provider_result_ambiguous' THEN 'ambiguous'
    ELSE 'permanent'
  END
$line_delivery_retry_class$;

CREATE OR REPLACE FUNCTION private_line.ingress_enqueue_line_system_outbound(payload jsonb)
RETURNS TABLE(outcome text, outbound_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $ingress_enqueue_line_system_outbound$
DECLARE
  v_identity_digest text := payload->>'identity_digest';
  v_journey text := payload->>'journey';
  v_idempotency_digest text := payload->>'idempotency_digest';
  v_dispatch_digest text := payload->>'dispatch_token_digest';
  v_created_by_digest text := payload->>'created_by_digest';
  v_conversation_id uuid;
  v_outbound_id uuid;
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR NOT private_line.safe_json_keys_only(
      payload,
      ARRAY[
        'identity_digest','journey','idempotency_digest','dispatch_token_digest',
        'content_ciphertext_b64','content_nonce_b64','content_auth_tag_b64',
        'content_key_version','created_by_digest'
      ]::text[]
    )
  THEN
    RAISE EXCEPTION 'invalid LINE system outbound payload';
  END IF;

  IF NOT private_line.safe_hex_digest(v_identity_digest)
    OR NOT private_line.safe_id(v_journey)
    OR NOT private_line.safe_hex_digest(v_idempotency_digest)
    OR NOT private_line.safe_hex_digest(v_dispatch_digest)
    OR NOT private_line.safe_hex_digest(v_created_by_digest)
    OR COALESCE(payload->>'content_ciphertext_b64','')=''
    OR COALESCE(payload->>'content_nonce_b64','')=''
    OR COALESCE(payload->>'content_auth_tag_b64','')=''
    OR COALESCE((payload->>'content_key_version')::integer,0)<=0
  THEN
    RAISE EXCEPTION 'invalid LINE system outbound fields';
  END IF;

  IF v_journey NOT IN (
    'motor_quote_review',
    'life_health_policy_review',
    'investment_before_you_act'
  ) THEN
    RAISE EXCEPTION 'unapproved LINE discovery journey';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM private_line.rich_menu_item rmi
    WHERE rmi.active
      AND rmi.action_type='postback'
      AND rmi.postback_data='journey='||v_journey||'&stage=entry'
  ) THEN
    RAISE EXCEPTION 'unapproved LINE discovery postback';
  END IF;

  SELECT c.conversation_id
  INTO v_conversation_id
  FROM private_line.provider_identity pi
  JOIN private_line.conversation c ON c.identity_id=pi.identity_id
  WHERE pi.provider='line'
    AND pi.active
    AND pi.external_ref_digest=v_identity_digest
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    RETURN QUERY SELECT 'identity_missing'::text, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO private_line.outbound_message(
    lead_id,
    conversation_id,
    advisor_case_id,
    message_kind,
    idempotency_digest,
    content_ciphertext_b64,
    content_nonce_b64,
    content_auth_tag_b64,
    content_key_version,
    dispatch_token_digest,
    created_by_digest
  ) VALUES (
    NULL,
    v_conversation_id,
    NULL,
    'system_notice',
    v_idempotency_digest,
    payload->>'content_ciphertext_b64',
    payload->>'content_nonce_b64',
    payload->>'content_auth_tag_b64',
    (payload->>'content_key_version')::smallint,
    v_dispatch_digest,
    v_created_by_digest
  )
  ON CONFLICT (idempotency_digest) DO NOTHING
  RETURNING outbound_message.outbound_id INTO v_outbound_id;

  IF v_outbound_id IS NULL THEN
    SELECT om.outbound_id
    INTO v_outbound_id
    FROM private_line.outbound_message om
    WHERE om.idempotency_digest=v_idempotency_digest
      AND om.message_kind='system_notice'
      AND om.conversation_id=v_conversation_id
      AND om.dispatch_token_digest=v_dispatch_digest;

    IF v_outbound_id IS NULL THEN
      RAISE EXCEPTION 'LINE system outbound idempotency conflict';
    END IF;

    RETURN QUERY SELECT 'duplicate'::text, v_outbound_id;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'queued'::text, v_outbound_id;
END
$ingress_enqueue_line_system_outbound$;

CREATE OR REPLACE FUNCTION private_line.admin_claim_line_outbound(payload jsonb)
RETURNS TABLE(
  outbound_id uuid,
  lead_id uuid,
  attempt_number integer,
  recipient_ciphertext_b64 text,
  recipient_nonce_b64 text,
  recipient_auth_tag_b64 text,
  recipient_key_version smallint,
  content_ciphertext_b64 text,
  content_nonce_b64 text,
  content_auth_tag_b64 text,
  content_key_version smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_claim_line_outbound$
DECLARE
  v_worker text;
  v_outbound uuid;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['worker_digest','outbound_id']::text[]) THEN
    RAISE EXCEPTION 'unsafe claim payload';
  END IF;
  v_worker := payload->>'worker_digest';
  IF v_worker IS NULL OR NOT private_line.safe_hex_digest(v_worker) THEN
    RAISE EXCEPTION 'invalid worker digest';
  END IF;

  SELECT om.outbound_id
  INTO v_outbound
  FROM private_line.outbound_message om
  WHERE om.outbound_id=NULLIF(payload->>'outbound_id','')::uuid
    AND om.message_kind<>'system_notice'
    AND (
      om.status='queued'
      OR (
        om.status='failed'
        AND private_line.line_delivery_retry_class(om.last_error_class)='retryable'
      )
    )
    AND COALESCE(om.send_after,now())<=now()
    AND om.attempt_count<3
  FOR UPDATE SKIP LOCKED;

  IF v_outbound IS NULL THEN
    RETURN;
  END IF;

  UPDATE private_line.outbound_message om
  SET status='leased',
      lease_owner_digest=v_worker,
      lease_expires_at=now()+interval '2 minutes',
      attempt_count=om.attempt_count+1,
      updated_at=now()
  WHERE om.outbound_id=v_outbound;

  RETURN QUERY
  SELECT
    om.outbound_id,
    om.lead_id,
    om.attempt_count,
    pi.external_ref_ciphertext_b64,
    pi.external_ref_nonce_b64,
    pi.external_ref_auth_tag_b64,
    pi.key_version,
    om.content_ciphertext_b64,
    om.content_nonce_b64,
    om.content_auth_tag_b64,
    om.content_key_version
  FROM private_line.outbound_message om
  JOIN private_line.conversation c ON c.conversation_id=om.conversation_id
  JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id
  WHERE om.outbound_id=v_outbound
    AND om.lease_owner_digest=v_worker;
END
$admin_claim_line_outbound$;

CREATE OR REPLACE FUNCTION private_line.admin_claim_line_system_outbound(payload jsonb)
RETURNS TABLE(
  outbound_id uuid,
  attempt_number integer,
  recipient_ciphertext_b64 text,
  recipient_nonce_b64 text,
  recipient_auth_tag_b64 text,
  recipient_key_version smallint,
  content_ciphertext_b64 text,
  content_nonce_b64 text,
  content_auth_tag_b64 text,
  content_key_version smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_claim_line_system_outbound$
DECLARE
  v_worker text := payload->>'worker_digest';
  v_dispatch_digest text := payload->>'dispatch_token_digest';
  v_outbound uuid;
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR NOT private_line.safe_json_keys_only(
      payload,
      ARRAY['worker_digest','outbound_id','dispatch_token_digest']::text[]
    )
  THEN
    RAISE EXCEPTION 'unsafe LINE system claim payload';
  END IF;

  IF v_worker IS NULL
    OR NOT private_line.safe_hex_digest(v_worker)
    OR v_dispatch_digest IS NULL
    OR NOT private_line.safe_hex_digest(v_dispatch_digest)
  THEN
    RAISE EXCEPTION 'invalid LINE system claim';
  END IF;

  SELECT om.outbound_id
  INTO v_outbound
  FROM private_line.outbound_message om
  WHERE om.outbound_id=NULLIF(payload->>'outbound_id','')::uuid
    AND om.message_kind='system_notice'
    AND om.dispatch_token_digest=v_dispatch_digest
    AND (
      om.status='queued'
      OR (
        om.status='failed'
        AND private_line.line_delivery_retry_class(om.last_error_class)='retryable'
      )
    )
    AND COALESCE(om.send_after,now())<=now()
    AND om.attempt_count<3
  FOR UPDATE SKIP LOCKED;

  IF v_outbound IS NULL THEN
    RETURN;
  END IF;

  UPDATE private_line.outbound_message om
  SET status='leased',
      lease_owner_digest=v_worker,
      lease_expires_at=now()+interval '2 minutes',
      attempt_count=om.attempt_count+1,
      updated_at=now()
  WHERE om.outbound_id=v_outbound;

  RETURN QUERY
  SELECT
    om.outbound_id,
    om.attempt_count,
    pi.external_ref_ciphertext_b64,
    pi.external_ref_nonce_b64,
    pi.external_ref_auth_tag_b64,
    pi.key_version,
    om.content_ciphertext_b64,
    om.content_nonce_b64,
    om.content_auth_tag_b64,
    om.content_key_version
  FROM private_line.outbound_message om
  JOIN private_line.conversation c ON c.conversation_id=om.conversation_id
  JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id
  WHERE om.outbound_id=v_outbound
    AND om.lease_owner_digest=v_worker;
END
$admin_claim_line_system_outbound$;

REVOKE ALL ON FUNCTION private_line.ingress_enqueue_line_system_outbound(jsonb)
  FROM PUBLIC,ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.ingress_enqueue_line_system_outbound(jsonb)
  TO ccpun_line_ingress;

REVOKE ALL ON FUNCTION private_line.admin_claim_line_system_outbound(jsonb)
  FROM PUBLIC,ccpun_line_ingress;
GRANT EXECUTE ON FUNCTION private_line.admin_claim_line_system_outbound(jsonb)
  TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum)
VALUES('20260919_line_system_delivery_v1_uat','sha256:61d1e71b9ca7a0f27e2dd99f0902a514dff7216e5bfbcbc7bd1fda9e04b47e45')
ON CONFLICT(version) DO UPDATE SET checksum=EXCLUDED.checksum;
COMMIT;

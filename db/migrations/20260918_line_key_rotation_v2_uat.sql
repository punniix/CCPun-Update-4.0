BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_safe_knowledge_crm_campaign_v1_uat' AND checksum='sha256:099a8968a8ec6fbb1fee589b410f3f071e762dd86ef3b1906b903fed5029e68d') THEN RAISE EXCEPTION 'previous LINE migration missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.system_identity WHERE singleton=true AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394' AND database_name='neondb' AND migration_version='20260917_private_line_runtime_v1_uat') THEN RAISE EXCEPTION 'base system identity changed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_key_rotation_v2'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_key_rotation_v2_uat';
  IF existing_checksum IS NOT NULL AND existing_checksum <> 'sha256:3884446394a191afdfbde544f4b6e887fd996732d6705956ac7fc0efda7fc21d' THEN RAISE EXCEPTION 'key rotation checksum mismatch'; END IF;
END
$guard$;
-- checksum-source-begin
CREATE OR REPLACE FUNCTION private_line.ingress_read_line_key_rotation_candidates(
  p_identity_digest text,
  p_limit integer DEFAULT 12
)
RETURNS TABLE(
  candidate_kind text,
  record_id uuid,
  source_key_version smallint,
  ciphertext_b64 text,
  nonce_b64 text,
  auth_tag_b64 text,
  purpose text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $ingress_read_line_key_rotation_candidates$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit,12),1),24);
BEGIN
  IF p_identity_digest IS NULL OR NOT private_line.safe_hex_digest(p_identity_digest) THEN
    RAISE EXCEPTION 'invalid identity digest';
  END IF;

  RETURN QUERY
  WITH identity_scope AS (
    SELECT pi.identity_id
    FROM private_line.provider_identity pi
    WHERE pi.provider='line'
      AND pi.external_ref_digest=p_identity_digest
    LIMIT 1
  ),
  candidates AS (
    SELECT
      0 AS sort_order,
      pi.updated_at AS occurred_at,
      'identity_external_ref'::text AS candidate_kind,
      pi.identity_id AS record_id,
      pi.key_version AS source_key_version,
      pi.external_ref_ciphertext_b64 AS ciphertext_b64,
      pi.external_ref_nonce_b64 AS nonce_b64,
      pi.external_ref_auth_tag_b64 AS auth_tag_b64,
      'line-user-id'::text AS purpose
    FROM private_line.provider_identity pi
    JOIN identity_scope scope ON scope.identity_id=pi.identity_id
    WHERE pi.key_version=1

    UNION ALL

    SELECT
      1,
      m.received_at,
      'message_provider_id'::text,
      m.message_id,
      m.provider_message_key_version,
      m.provider_message_ciphertext_b64,
      m.provider_message_nonce_b64,
      m.provider_message_auth_tag_b64,
      'message-provider-id'::text
    FROM private_line.message m
    JOIN private_line.conversation c ON c.conversation_id=m.conversation_id
    JOIN identity_scope scope ON scope.identity_id=c.identity_id
    WHERE m.status<>'unsent'
      AND m.provider_message_key_version=1
      AND m.provider_message_ciphertext_b64 IS NOT NULL
      AND m.provider_message_nonce_b64 IS NOT NULL
      AND m.provider_message_auth_tag_b64 IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM private_line.message_tombstone tomb
        WHERE tomb.provider_message_digest=m.provider_message_digest
      )

    UNION ALL

    SELECT
      2,
      m.received_at,
      'message_content'::text,
      m.message_id,
      m.content_key_version,
      m.content_ciphertext_b64,
      m.content_nonce_b64,
      m.content_auth_tag_b64,
      'message-content'::text
    FROM private_line.message m
    JOIN private_line.conversation c ON c.conversation_id=m.conversation_id
    JOIN identity_scope scope ON scope.identity_id=c.identity_id
    WHERE m.status<>'unsent'
      AND m.content_key_version=1
      AND m.content_ciphertext_b64 IS NOT NULL
      AND m.content_nonce_b64 IS NOT NULL
      AND m.content_auth_tag_b64 IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM private_line.message_tombstone tomb
        WHERE tomb.provider_message_digest=m.provider_message_digest
      )
  )
  SELECT
    candidates.candidate_kind,
    candidates.record_id,
    candidates.source_key_version,
    candidates.ciphertext_b64,
    candidates.nonce_b64,
    candidates.auth_tag_b64,
    candidates.purpose
  FROM candidates
  ORDER BY candidates.sort_order, candidates.occurred_at, candidates.record_id
  LIMIT v_limit;
END
$ingress_read_line_key_rotation_candidates$;

CREATE OR REPLACE FUNCTION private_line.ingress_apply_line_key_rotation(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $ingress_apply_line_key_rotation$
DECLARE
  v_digest text := payload->>'identity_digest';
  v_kind text := payload->>'candidate_kind';
  v_record uuid := NULLIF(payload->>'record_id','')::uuid;
  v_source smallint := NULLIF(payload->>'source_key_version','')::smallint;
  v_target smallint := NULLIF(payload->>'target_key_version','')::smallint;
  v_count integer := 0;
BEGIN
  IF NOT private_line.safe_json_keys_only(
    payload,
    ARRAY[
      'identity_digest','candidate_kind','record_id','source_key_version','target_key_version',
      'ciphertext_b64','nonce_b64','auth_tag_b64'
    ]::text[]
  ) THEN
    RAISE EXCEPTION 'unsafe rotation payload';
  END IF;
  IF v_digest IS NULL OR NOT private_line.safe_hex_digest(v_digest)
     OR v_record IS NULL
     OR v_kind NOT IN ('identity_external_ref','message_provider_id','message_content')
     OR v_source<>1
     OR v_target<>2
     OR COALESCE(length(payload->>'ciphertext_b64'),0)=0
     OR COALESCE(length(payload->>'nonce_b64'),0)=0
     OR COALESCE(length(payload->>'auth_tag_b64'),0)=0
  THEN
    RAISE EXCEPTION 'invalid rotation payload';
  END IF;

  IF v_kind='identity_external_ref' THEN
    UPDATE private_line.provider_identity pi
    SET external_ref_ciphertext_b64=payload->>'ciphertext_b64',
        external_ref_nonce_b64=payload->>'nonce_b64',
        external_ref_auth_tag_b64=payload->>'auth_tag_b64',
        key_version=2,
        updated_at=now()
    WHERE pi.identity_id=v_record
      AND pi.provider='line'
      AND pi.external_ref_digest=v_digest
      AND pi.key_version=1;
    GET DIAGNOSTICS v_count=ROW_COUNT;

  ELSIF v_kind='message_provider_id' THEN
    UPDATE private_line.message m
    SET provider_message_ciphertext_b64=payload->>'ciphertext_b64',
        provider_message_nonce_b64=payload->>'nonce_b64',
        provider_message_auth_tag_b64=payload->>'auth_tag_b64',
        provider_message_key_version=2,
        updated_at=now()
    FROM private_line.conversation c, private_line.provider_identity pi
    WHERE m.message_id=v_record
      AND m.conversation_id=c.conversation_id
      AND c.identity_id=pi.identity_id
      AND pi.provider='line'
      AND pi.external_ref_digest=v_digest
      AND m.provider_message_key_version=1
      AND m.status<>'unsent'
      AND NOT EXISTS (
        SELECT 1 FROM private_line.message_tombstone tomb
        WHERE tomb.provider_message_digest=m.provider_message_digest
      );
    GET DIAGNOSTICS v_count=ROW_COUNT;

  ELSE
    UPDATE private_line.message m
    SET content_ciphertext_b64=payload->>'ciphertext_b64',
        content_nonce_b64=payload->>'nonce_b64',
        content_auth_tag_b64=payload->>'auth_tag_b64',
        content_key_version=2,
        updated_at=now()
    FROM private_line.conversation c, private_line.provider_identity pi
    WHERE m.message_id=v_record
      AND m.conversation_id=c.conversation_id
      AND c.identity_id=pi.identity_id
      AND pi.provider='line'
      AND pi.external_ref_digest=v_digest
      AND m.content_key_version=1
      AND m.status<>'unsent'
      AND NOT EXISTS (
        SELECT 1 FROM private_line.message_tombstone tomb
        WHERE tomb.provider_message_digest=m.provider_message_digest
      );
    GET DIAGNOSTICS v_count=ROW_COUNT;
  END IF;

  RETURN QUERY SELECT CASE WHEN v_count=1 THEN 'rotated'::text ELSE 'stale_or_purged'::text END;
END
$ingress_apply_line_key_rotation$;

CREATE OR REPLACE FUNCTION private_line.admin_read_line_key_rotation_status()
RETURNS TABLE(
  identity_v1_count bigint,
  identity_v2_count bigint,
  provider_message_v1_count bigint,
  provider_message_v2_count bigint,
  message_content_v1_count bigint,
  message_content_v2_count bigint,
  outbound_content_v1_count bigint,
  outbound_content_v2_count bigint,
  advisor_note_v1_count bigint,
  advisor_note_v2_count bigint,
  rotatable_v1_count bigint,
  admin_only_v1_count bigint,
  total_v1_count bigint,
  unsupported_version_count bigint,
  encrypted_unsent_count bigint,
  all_v1_zero boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_line_key_rotation_status$
  WITH counts AS (
    SELECT
      (SELECT count(*) FROM private_line.provider_identity WHERE key_version=1) AS identity_v1,
      (SELECT count(*) FROM private_line.provider_identity WHERE key_version=2) AS identity_v2,
      (SELECT count(*) FROM private_line.message WHERE provider_message_key_version=1) AS provider_v1,
      (SELECT count(*) FROM private_line.message WHERE provider_message_key_version=2) AS provider_v2,
      (SELECT count(*) FROM private_line.message WHERE content_key_version=1) AS content_v1,
      (SELECT count(*) FROM private_line.message WHERE content_key_version=2) AS content_v2,
      (SELECT count(*) FROM private_line.outbound_message WHERE content_key_version=1) AS outbound_v1,
      (SELECT count(*) FROM private_line.outbound_message WHERE content_key_version=2) AS outbound_v2,
      (SELECT count(*) FROM private_line.advisor_private_note WHERE content_key_version=1) AS note_v1,
      (SELECT count(*) FROM private_line.advisor_private_note WHERE content_key_version=2) AS note_v2,
      (
        SELECT count(*) FROM private_line.message
        WHERE status='unsent'
          AND (
            provider_message_ciphertext_b64 IS NOT NULL OR
            provider_message_nonce_b64 IS NOT NULL OR
            provider_message_auth_tag_b64 IS NOT NULL OR
            provider_message_key_version IS NOT NULL OR
            content_ciphertext_b64 IS NOT NULL OR
            content_nonce_b64 IS NOT NULL OR
            content_auth_tag_b64 IS NOT NULL OR
            content_key_version IS NOT NULL
          )
      ) AS unsent_encrypted,
      (
        (SELECT count(*) FROM private_line.provider_identity WHERE key_version NOT IN (1,2))
        + (SELECT count(*) FROM private_line.message WHERE provider_message_key_version IS NOT NULL AND provider_message_key_version NOT IN (1,2))
        + (SELECT count(*) FROM private_line.message WHERE content_key_version IS NOT NULL AND content_key_version NOT IN (1,2))
        + (SELECT count(*) FROM private_line.outbound_message WHERE content_key_version NOT IN (1,2))
        + (SELECT count(*) FROM private_line.advisor_private_note WHERE content_key_version NOT IN (1,2))
      ) AS unsupported
  )
  SELECT
    identity_v1, identity_v2,
    provider_v1, provider_v2,
    content_v1, content_v2,
    outbound_v1, outbound_v2,
    note_v1, note_v2,
    identity_v1+provider_v1+content_v1 AS rotatable_v1_count,
    outbound_v1+note_v1 AS admin_only_v1_count,
    identity_v1+provider_v1+content_v1+outbound_v1+note_v1 AS total_v1_count,
    unsupported AS unsupported_version_count,
    unsent_encrypted AS encrypted_unsent_count,
    (identity_v1+provider_v1+content_v1+outbound_v1+note_v1)=0 AS all_v1_zero
  FROM counts
$admin_read_line_key_rotation_status$;

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
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['worker_digest','outbound_id']::text[]) THEN RAISE EXCEPTION 'unsafe claim payload'; END IF;
  v_worker := payload->>'worker_digest';
  IF v_worker IS NULL OR NOT private_line.safe_hex_digest(v_worker) THEN RAISE EXCEPTION 'invalid worker digest'; END IF;
  SELECT om.outbound_id INTO v_outbound
  FROM private_line.outbound_message om
  WHERE om.outbound_id = NULLIF(payload->>'outbound_id','')::uuid
    AND om.status IN ('queued','failed')
    AND COALESCE(om.send_after, now()) <= now()
    AND om.attempt_count < 3
    AND COALESCE(om.last_error_class,'') NOT IN ('key_unavailable','unsupported_key_version')
  FOR UPDATE SKIP LOCKED;
  IF v_outbound IS NULL THEN RETURN; END IF;
  UPDATE private_line.outbound_message om
  SET status='leased', lease_owner_digest=v_worker, lease_expires_at=now()+interval '2 minutes',
      attempt_count=om.attempt_count+1, updated_at=now()
  WHERE om.outbound_id=v_outbound;
  RETURN QUERY
  SELECT om.outbound_id, om.lead_id, om.attempt_count,
         pi.external_ref_ciphertext_b64, pi.external_ref_nonce_b64, pi.external_ref_auth_tag_b64, pi.key_version,
         om.content_ciphertext_b64, om.content_nonce_b64, om.content_auth_tag_b64, om.content_key_version
  FROM private_line.outbound_message om
  JOIN private_line.conversation c ON c.conversation_id=om.conversation_id
  JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id
  WHERE om.outbound_id=v_outbound AND om.lease_owner_digest=v_worker;
END
$admin_claim_line_outbound$;

CREATE OR REPLACE FUNCTION private_line.admin_claim_line_campaign_delivery(payload jsonb)
RETURNS TABLE(
  delivery_id uuid,
  campaign_id uuid,
  lead_id uuid,
  attempt_number integer,
  recipient_ciphertext_b64 text,
  recipient_nonce_b64 text,
  recipient_auth_tag_b64 text,
  recipient_key_version smallint,
  copy_text text,
  copy_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_claim_line_campaign_delivery$
DECLARE
  v_worker text := payload->>'worker_digest';
  v_delivery uuid := NULLIF(payload->>'delivery_id','')::uuid;
  v_claimed uuid;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['worker_digest','delivery_id']::text[]) THEN RAISE EXCEPTION 'unsafe campaign claim'; END IF;
  IF v_worker IS NULL OR NOT private_line.safe_hex_digest(v_worker) THEN RAISE EXCEPTION 'invalid worker'; END IF;

  SELECT d.delivery_id INTO v_claimed
  FROM private_line.line_campaign_delivery d
  JOIN private_line.line_campaign c ON c.campaign_id=d.campaign_id
  WHERE (v_delivery IS NULL OR d.delivery_id=v_delivery)
    AND d.status IN ('queued','failed')
    AND d.attempt_count < 3
    AND COALESCE(d.last_error_class,'') NOT IN ('key_unavailable','unsupported_key_version')
    AND c.status='active'
    AND (c.scheduled_start_at IS NULL OR c.scheduled_start_at<=now())
    AND (c.scheduled_end_at IS NULL OR c.scheduled_end_at>=now())
  ORDER BY d.created_at ASC
  LIMIT 1
  FOR UPDATE OF d SKIP LOCKED;

  IF v_claimed IS NULL THEN RETURN; END IF;

  UPDATE private_line.line_campaign_delivery d
  SET status='leased',lease_owner_digest=v_worker,lease_expires_at=now()+interval '2 minutes',
      attempt_count=d.attempt_count+1,updated_at=now()
  WHERE d.delivery_id=v_claimed;

  RETURN QUERY
  SELECT d.delivery_id,d.campaign_id,d.lead_id,d.attempt_count,
         pi.external_ref_ciphertext_b64,pi.external_ref_nonce_b64,pi.external_ref_auth_tag_b64,pi.key_version,
         c.copy_text,c.copy_version
  FROM private_line.line_campaign_delivery d
  JOIN private_line.conversation conv ON conv.conversation_id=d.conversation_id
  JOIN private_line.provider_identity pi ON pi.identity_id=conv.identity_id
  JOIN private_line.line_campaign c ON c.campaign_id=d.campaign_id
  WHERE d.delivery_id=v_claimed AND d.lease_owner_digest=v_worker;
END
$admin_claim_line_campaign_delivery$;

REVOKE ALL ON FUNCTION private_line.ingress_read_line_key_rotation_candidates(text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.ingress_read_line_key_rotation_candidates(text,integer) FROM ccpun_admin_runtime;
REVOKE ALL ON FUNCTION private_line.ingress_apply_line_key_rotation(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.ingress_apply_line_key_rotation(jsonb) FROM ccpun_admin_runtime;
REVOKE ALL ON FUNCTION private_line.admin_read_line_key_rotation_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_line_key_rotation_status() FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_claim_line_outbound(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_claim_line_outbound(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_claim_line_campaign_delivery(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_claim_line_campaign_delivery(jsonb) FROM ccpun_line_ingress;

GRANT EXECUTE ON FUNCTION private_line.ingress_read_line_key_rotation_candidates(text,integer) TO ccpun_line_ingress;
GRANT EXECUTE ON FUNCTION private_line.ingress_apply_line_key_rotation(jsonb) TO ccpun_line_ingress;
GRANT EXECUTE ON FUNCTION private_line.admin_read_line_key_rotation_status() TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_claim_line_outbound(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_claim_line_campaign_delivery(jsonb) TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum) VALUES('20260918_line_key_rotation_v2_uat','sha256:3884446394a191afdfbde544f4b6e887fd996732d6705956ac7fc0efda7fc21d') ON CONFLICT(version) DO NOTHING;
COMMIT;

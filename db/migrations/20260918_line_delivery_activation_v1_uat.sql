BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_document_media_activation_v1_uat' AND checksum='sha256:fcab7e746a62850711493cfa849548975c6dfdb8365417d3b142fdc26ae1026f') THEN RAISE EXCEPTION 'document/media activation missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.system_identity WHERE singleton=true AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394' AND database_name='neondb' AND migration_version='20260917_private_line_runtime_v1_uat') THEN RAISE EXCEPTION 'base system identity changed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_delivery_activation_v1'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_delivery_activation_v1_uat';
  IF existing_checksum IS NOT NULL AND existing_checksum <> 'sha256:0ae7539cbc55299979f1821984875181e66259efec4ddc16cc3e549a056eabfa' THEN RAISE EXCEPTION 'delivery activation checksum mismatch'; END IF;
END
$guard$;
-- checksum-source-begin
CREATE OR REPLACE FUNCTION private_line.line_delivery_retry_class(p_error_class text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, private_line
AS $line_delivery_retry_class$
  SELECT CASE
    WHEN p_error_class IS NULL OR btrim(p_error_class)='' THEN 'permanent'
    WHEN p_error_class IN ('rate_limited','provider_unavailable') THEN 'retryable'
    WHEN p_error_class='provider_result_ambiguous' THEN 'ambiguous'
    ELSE 'permanent'
  END
$line_delivery_retry_class$;

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
    AND (
      om.status='queued'
      OR (
        om.status='failed'
        AND private_line.line_delivery_retry_class(om.last_error_class)='retryable'
      )
    )
    AND COALESCE(om.send_after, now()) <= now()
    AND om.attempt_count < 3
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
    AND (
      d.status='queued'
      OR (
        d.status='failed'
        AND private_line.line_delivery_retry_class(d.last_error_class)='retryable'
      )
    )
    AND d.attempt_count < 3
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

CREATE OR REPLACE FUNCTION private_line.admin_read_line_delivery_health()
RETURNS TABLE(
  outbound_queued bigint,
  outbound_leased bigint,
  outbound_sent bigint,
  outbound_retryable_failed bigint,
  outbound_dead_letter bigint,
  outbound_reconciliation bigint,
  campaign_queued bigint,
  campaign_leased bigint,
  campaign_sent bigint,
  campaign_retryable_failed bigint,
  campaign_dead_letter bigint,
  campaign_reconciliation bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_line_delivery_health$
  SELECT
    (SELECT count(*) FROM private_line.outbound_message WHERE status='queued'),
    (SELECT count(*) FROM private_line.outbound_message WHERE status='leased'),
    (SELECT count(*) FROM private_line.outbound_message WHERE status='sent'),
    (SELECT count(*) FROM private_line.outbound_message
      WHERE status='failed' AND attempt_count<3 AND private_line.line_delivery_retry_class(last_error_class)='retryable'),
    (SELECT count(*) FROM private_line.outbound_message
      WHERE status='failed' AND (attempt_count>=3 OR private_line.line_delivery_retry_class(last_error_class)='permanent')),
    (SELECT count(*) FROM private_line.outbound_message WHERE status='reconciliation_required'),
    (SELECT count(*) FROM private_line.line_campaign_delivery WHERE status='queued'),
    (SELECT count(*) FROM private_line.line_campaign_delivery WHERE status='leased'),
    (SELECT count(*) FROM private_line.line_campaign_delivery WHERE status='sent'),
    (SELECT count(*) FROM private_line.line_campaign_delivery
      WHERE status='failed' AND attempt_count<3 AND private_line.line_delivery_retry_class(last_error_class)='retryable'),
    (SELECT count(*) FROM private_line.line_campaign_delivery
      WHERE status='failed' AND (attempt_count>=3 OR private_line.line_delivery_retry_class(last_error_class)='permanent')),
    (SELECT count(*) FROM private_line.line_campaign_delivery WHERE status='reconciliation_required')
$admin_read_line_delivery_health$;

REVOKE ALL ON FUNCTION private_line.line_delivery_retry_class(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.line_delivery_retry_class(text) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.line_delivery_retry_class(text) FROM ccpun_admin_runtime;
REVOKE ALL ON FUNCTION private_line.admin_claim_line_outbound(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_claim_line_outbound(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_claim_line_campaign_delivery(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_claim_line_campaign_delivery(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_line_delivery_health() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_line_delivery_health() FROM ccpun_line_ingress;

GRANT EXECUTE ON FUNCTION private_line.admin_claim_line_outbound(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_claim_line_campaign_delivery(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_line_delivery_health() TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum) VALUES('20260918_line_delivery_activation_v1_uat','sha256:0ae7539cbc55299979f1821984875181e66259efec4ddc16cc3e549a056eabfa') ON CONFLICT(version) DO NOTHING;
COMMIT;

BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_content_intelligence_v2_production' AND checksum='sha256:084d1063b0d0fbc1c48762ea8de88994210f7d063f244874c2b17c5ff55147af') THEN RAISE EXCEPTION 'content intelligence v2 missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.system_identity WHERE singleton=true AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w' AND database_name='neondb' AND migration_version='20260917_private_line_runtime_v1_production') THEN RAISE EXCEPTION 'base system identity changed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_privacy_retention_v2'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_privacy_retention_v2_production';
  IF existing_checksum IS NOT NULL AND existing_checksum <> 'sha256:ce3a55a27969b4effecb70af0bc8f5e4de4f9dc023fbd32fc91ded69a08005f8' THEN RAISE EXCEPTION 'privacy retention v2 checksum mismatch'; END IF;
END
$guard$;
-- checksum-source-begin
ALTER TABLE private_line.retention_policy
  ADD COLUMN IF NOT EXISTS conversation_review_after_days integer
    CHECK (conversation_review_after_days IS NULL OR conversation_review_after_days BETWEEN 1 AND 36500),
  ADD COLUMN IF NOT EXISTS document_review_after_days integer
    CHECK (document_review_after_days IS NULL OR document_review_after_days BETWEEN 1 AND 36500),
  ADD COLUMN IF NOT EXISTS audit_review_after_days integer
    CHECK (audit_review_after_days IS NULL OR audit_review_after_days BETWEEN 1 AND 36500),
  ADD COLUMN IF NOT EXISTS attachment_unsend_action text NOT NULL DEFAULT 'revoke_then_delete'
    CHECK (attachment_unsend_action='revoke_then_delete'),
  ADD COLUMN IF NOT EXISTS updated_by_digest text
    CHECK (updated_by_digest IS NULL OR private_line.safe_hex_digest(updated_by_digest));

CREATE TABLE IF NOT EXISTS private_line.privacy_export_manifest (
  privacy_request_id uuid PRIMARY KEY REFERENCES private_line.privacy_request(privacy_request_id),
  manifest_version text NOT NULL DEFAULT 'privacy_export_v1' CHECK (manifest_version='privacy_export_v1'),
  status text NOT NULL DEFAULT 'prepared' CHECK (status='prepared'),
  conversation_count bigint NOT NULL CHECK (conversation_count >= 0),
  message_count bigint NOT NULL CHECK (message_count >= 0),
  document_count bigint NOT NULL CHECK (document_count >= 0),
  lead_count bigint NOT NULL CHECK (lead_count >= 0),
  advisor_case_count bigint NOT NULL CHECK (advisor_case_count >= 0),
  business_event_count bigint NOT NULL CHECK (business_event_count >= 0),
  implementation_count bigint NOT NULL CHECK (implementation_count >= 0),
  revenue_record_count bigint NOT NULL CHECK (revenue_record_count >= 0),
  raw_payload_materialized boolean NOT NULL DEFAULT false CHECK (raw_payload_materialized=false),
  prepared_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.privacy_delete_audit_tombstone (
  privacy_request_id uuid PRIMARY KEY REFERENCES private_line.privacy_request(privacy_request_id),
  tombstone_version text NOT NULL DEFAULT 'privacy_delete_v1' CHECK (tombstone_version='privacy_delete_v1'),
  phase text NOT NULL DEFAULT 'prepared' CHECK (phase IN ('prepared','executed')),
  conversation_count bigint NOT NULL CHECK (conversation_count >= 0),
  message_count bigint NOT NULL CHECK (message_count >= 0),
  document_count bigint NOT NULL CHECK (document_count >= 0),
  lead_count bigint NOT NULL CHECK (lead_count >= 0),
  advisor_case_count bigint NOT NULL CHECK (advisor_case_count >= 0),
  business_event_count bigint NOT NULL CHECK (business_event_count >= 0),
  implementation_count bigint NOT NULL CHECK (implementation_count >= 0),
  revenue_record_count bigint NOT NULL CHECK (revenue_record_count >= 0),
  attachment_cleanup_required_count bigint NOT NULL DEFAULT 0 CHECK (attachment_cleanup_required_count >= 0),
  attachment_cleanup_completed_count bigint NOT NULL DEFAULT 0 CHECK (attachment_cleanup_completed_count >= 0),
  content_included boolean NOT NULL DEFAULT false CHECK (content_included=false),
  prepared_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  CHECK ((phase='prepared' AND executed_at IS NULL) OR phase='executed')
);

CREATE OR REPLACE FUNCTION private_line.admin_update_retention_policy(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_update_retention_policy$
DECLARE
  v_mode text := COALESCE(NULLIF(payload->>'policy_mode',''),'manual_review');
  v_auto boolean := COALESCE((payload->>'automatic_delete_enabled')::boolean,false);
  v_conversation integer := NULLIF(payload->>'conversation_review_after_days','')::integer;
  v_document integer := NULLIF(payload->>'document_review_after_days','')::integer;
  v_audit integer := NULLIF(payload->>'audit_review_after_days','')::integer;
  v_attachment_action text := COALESCE(NULLIF(payload->>'attachment_unsend_action',''),'revoke_then_delete');
  v_actor text := NULLIF(payload->>'actor_digest','');
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR NOT private_line.safe_json_keys_only(
      payload,
      ARRAY[
        'policy_mode','automatic_delete_enabled','conversation_review_after_days',
        'document_review_after_days','audit_review_after_days','attachment_unsend_action','actor_digest'
      ]::text[]
    )
  THEN RAISE EXCEPTION 'unsafe retention policy payload'; END IF;

  IF v_mode<>'manual_review' OR v_auto<>false OR v_attachment_action<>'revoke_then_delete'
    OR v_actor IS NULL OR NOT private_line.safe_hex_digest(v_actor)
    OR (v_conversation IS NOT NULL AND (v_conversation<1 OR v_conversation>36500))
    OR (v_document IS NOT NULL AND (v_document<1 OR v_document>36500))
    OR (v_audit IS NOT NULL AND (v_audit<1 OR v_audit>36500))
  THEN RAISE EXCEPTION 'invalid retention policy'; END IF;

  INSERT INTO private_line.retention_policy(
    singleton,policy_mode,automatic_delete_enabled,
    conversation_review_after_days,document_review_after_days,audit_review_after_days,
    attachment_unsend_action,updated_by_digest,updated_at
  )
  VALUES(
    true,'manual_review',false,v_conversation,v_document,v_audit,'revoke_then_delete',v_actor,now()
  )
  ON CONFLICT(singleton) DO UPDATE SET
    policy_mode='manual_review',
    automatic_delete_enabled=false,
    conversation_review_after_days=EXCLUDED.conversation_review_after_days,
    document_review_after_days=EXCLUDED.document_review_after_days,
    audit_review_after_days=EXCLUDED.audit_review_after_days,
    attachment_unsend_action='revoke_then_delete',
    updated_by_digest=EXCLUDED.updated_by_digest,
    updated_at=now();

  RETURN QUERY SELECT 'updated'::text;
END
$admin_update_retention_policy$;

CREATE OR REPLACE FUNCTION private_line.admin_prepare_privacy_export(p_request_id uuid)
RETURNS TABLE(
  outcome text,
  conversation_count bigint,
  message_count bigint,
  document_count bigint,
  lead_count bigint,
  advisor_case_count bigint,
  business_event_count bigint,
  implementation_count bigint,
  revenue_record_count bigint,
  raw_payload_materialized boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_prepare_privacy_export$
DECLARE
  v_type text;
  v_status text;
  v_conversation bigint;
  v_message bigint;
  v_document bigint;
  v_lead bigint;
  v_case bigint;
  v_event bigint;
  v_implementation bigint;
  v_revenue bigint;
  v_destructive boolean;
BEGIN
  SELECT pr.request_type,pr.status INTO v_type,v_status
  FROM private_line.privacy_request pr
  WHERE pr.privacy_request_id=p_request_id;
  IF v_type IS NULL THEN RAISE EXCEPTION 'privacy request not found'; END IF;
  IF v_type<>'export' THEN RAISE EXCEPTION 'privacy request is not export'; END IF;
  IF v_status NOT IN ('verified','prepared','approved') THEN RAISE EXCEPTION 'privacy export not verified'; END IF;

  SELECT p.request_type,p.status,p.conversation_count,p.message_count,p.document_count,p.lead_count,
         p.advisor_case_count,p.business_event_count,p.implementation_count,p.revenue_record_count,
         p.destructive_execution_available
  INTO v_type,v_status,v_conversation,v_message,v_document,v_lead,v_case,v_event,v_implementation,v_revenue,v_destructive
  FROM private_line.admin_prepare_privacy_request(p_request_id) p;

  INSERT INTO private_line.privacy_export_manifest(
    privacy_request_id,conversation_count,message_count,document_count,lead_count,advisor_case_count,
    business_event_count,implementation_count,revenue_record_count,raw_payload_materialized,prepared_at
  )
  VALUES(
    p_request_id,v_conversation,v_message,v_document,v_lead,v_case,
    v_event,v_implementation,v_revenue,false,now()
  )
  ON CONFLICT(privacy_request_id) DO UPDATE SET
    conversation_count=EXCLUDED.conversation_count,
    message_count=EXCLUDED.message_count,
    document_count=EXCLUDED.document_count,
    lead_count=EXCLUDED.lead_count,
    advisor_case_count=EXCLUDED.advisor_case_count,
    business_event_count=EXCLUDED.business_event_count,
    implementation_count=EXCLUDED.implementation_count,
    revenue_record_count=EXCLUDED.revenue_record_count,
    raw_payload_materialized=false;

  RETURN QUERY SELECT 'prepared'::text,v_conversation,v_message,v_document,v_lead,v_case,
    v_event,v_implementation,v_revenue,false;
END
$admin_prepare_privacy_export$;

CREATE OR REPLACE FUNCTION private_line.admin_prepare_privacy_delete(p_request_id uuid)
RETURNS TABLE(
  outcome text,
  conversation_count bigint,
  message_count bigint,
  document_count bigint,
  lead_count bigint,
  advisor_case_count bigint,
  business_event_count bigint,
  implementation_count bigint,
  revenue_record_count bigint,
  attachment_cleanup_required_count bigint,
  destructive_execution_available boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_prepare_privacy_delete$
DECLARE
  v_customer uuid;
  v_lead_id uuid;
  v_type text;
  v_status text;
  v_conversation bigint;
  v_message bigint;
  v_document bigint;
  v_lead bigint;
  v_case bigint;
  v_event bigint;
  v_implementation bigint;
  v_revenue bigint;
  v_destructive boolean;
  v_attachment_cleanup bigint;
BEGIN
  SELECT pr.customer_id,pr.lead_id,pr.request_type,pr.status
  INTO v_customer,v_lead_id,v_type,v_status
  FROM private_line.privacy_request pr
  WHERE pr.privacy_request_id=p_request_id;
  IF v_type IS NULL THEN RAISE EXCEPTION 'privacy request not found'; END IF;
  IF v_type<>'delete' THEN RAISE EXCEPTION 'privacy request is not delete'; END IF;
  IF v_status NOT IN ('verified','prepared','approved') THEN RAISE EXCEPTION 'privacy delete not verified'; END IF;

  SELECT p.request_type,p.status,p.conversation_count,p.message_count,p.document_count,p.lead_count,
         p.advisor_case_count,p.business_event_count,p.implementation_count,p.revenue_record_count,
         p.destructive_execution_available
  INTO v_type,v_status,v_conversation,v_message,v_document,v_lead,v_case,v_event,v_implementation,v_revenue,v_destructive
  FROM private_line.admin_prepare_privacy_request(p_request_id) p;

  WITH scoped_leads AS (
    SELECT l.lead_id,l.conversation_id
    FROM private_line.lead l
    WHERE (v_lead_id IS NOT NULL AND l.lead_id=v_lead_id)
       OR (v_lead_id IS NULL AND v_customer IS NOT NULL AND l.customer_id=v_customer)
  ),
  scoped_documents AS (
    SELECT d.document_id
    FROM private_line.document d
    WHERE d.conversation_id IN (
      SELECT sl.conversation_id FROM scoped_leads sl WHERE sl.conversation_id IS NOT NULL
    )
  )
  SELECT count(*)::bigint INTO v_attachment_cleanup
  FROM private_line.document_storage_object dso
  WHERE dso.document_id IN (SELECT sd.document_id FROM scoped_documents sd)
    AND dso.status NOT IN ('revoked','deleted');

  INSERT INTO private_line.privacy_delete_audit_tombstone(
    privacy_request_id,phase,conversation_count,message_count,document_count,lead_count,advisor_case_count,
    business_event_count,implementation_count,revenue_record_count,attachment_cleanup_required_count,
    attachment_cleanup_completed_count,content_included,prepared_at,executed_at
  )
  VALUES(
    p_request_id,'prepared',v_conversation,v_message,v_document,v_lead,v_case,
    v_event,v_implementation,v_revenue,COALESCE(v_attachment_cleanup,0),0,false,now(),NULL
  )
  ON CONFLICT(privacy_request_id) DO UPDATE SET
    phase='prepared',
    conversation_count=EXCLUDED.conversation_count,
    message_count=EXCLUDED.message_count,
    document_count=EXCLUDED.document_count,
    lead_count=EXCLUDED.lead_count,
    advisor_case_count=EXCLUDED.advisor_case_count,
    business_event_count=EXCLUDED.business_event_count,
    implementation_count=EXCLUDED.implementation_count,
    revenue_record_count=EXCLUDED.revenue_record_count,
    attachment_cleanup_required_count=EXCLUDED.attachment_cleanup_required_count,
    content_included=false,
    executed_at=NULL;

  RETURN QUERY SELECT 'prepared'::text,v_conversation,v_message,v_document,v_lead,v_case,
    v_event,v_implementation,v_revenue,COALESCE(v_attachment_cleanup,0),false;
END
$admin_prepare_privacy_delete$;

CREATE OR REPLACE FUNCTION private_line.admin_read_privacy_safety_health()
RETURNS TABLE(
  retention_mode text,
  automatic_delete_enabled boolean,
  conversation_review_after_days integer,
  document_review_after_days integer,
  audit_review_after_days integer,
  attachment_unsend_action text,
  prepared_export_manifest_count bigint,
  prepared_delete_tombstone_count bigint,
  attachment_cleanup_required_count bigint,
  destructive_execution_available boolean,
  backup_restore_evidence_state text,
  key_rotation_evidence_state text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_privacy_safety_health$
  SELECT
    rp.policy_mode,
    rp.automatic_delete_enabled,
    rp.conversation_review_after_days,
    rp.document_review_after_days,
    rp.audit_review_after_days,
    rp.attachment_unsend_action,
    (SELECT count(*) FROM private_line.privacy_export_manifest pem WHERE pem.status='prepared'),
    (SELECT count(*) FROM private_line.privacy_delete_audit_tombstone pdt WHERE pdt.phase='prepared'),
    (SELECT COALESCE(sum(pdt.attachment_cleanup_required_count),0)::bigint
       FROM private_line.privacy_delete_audit_tombstone pdt WHERE pdt.phase='prepared'),
    false,
    'external_verification_required'::text,
    'aggregate_status_available'::text
  FROM private_line.retention_policy rp
  WHERE rp.singleton=true
$admin_read_privacy_safety_health$;

REVOKE ALL PRIVILEGES ON TABLE private_line.privacy_export_manifest FROM ccpun_admin_runtime;
REVOKE ALL PRIVILEGES ON TABLE private_line.privacy_export_manifest FROM ccpun_line_ingress;
REVOKE ALL PRIVILEGES ON TABLE private_line.privacy_delete_audit_tombstone FROM ccpun_admin_runtime;
REVOKE ALL PRIVILEGES ON TABLE private_line.privacy_delete_audit_tombstone FROM ccpun_line_ingress;

REVOKE ALL ON FUNCTION private_line.admin_update_retention_policy(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_update_retention_policy(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_prepare_privacy_export(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_prepare_privacy_export(uuid) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_prepare_privacy_delete(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_prepare_privacy_delete(uuid) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_privacy_safety_health() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_privacy_safety_health() FROM ccpun_line_ingress;

GRANT EXECUTE ON FUNCTION private_line.admin_update_retention_policy(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_prepare_privacy_export(uuid) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_prepare_privacy_delete(uuid) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_privacy_safety_health() TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum) VALUES('20260918_line_privacy_retention_v2_production','sha256:ce3a55a27969b4effecb70af0bc8f5e4de4f9dc023fbd32fc91ded69a08005f8') ON CONFLICT(version) DO NOTHING;
COMMIT;

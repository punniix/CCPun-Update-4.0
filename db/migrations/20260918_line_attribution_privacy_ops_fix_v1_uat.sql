BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_attribution_privacy_ops_v1_uat' AND checksum='sha256:4d8552c0f3a44407733a7a396a36909e4cc87c657e8d0c39a8d5e818e7f5875b') THEN RAISE EXCEPTION 'attribution/privacy base missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_attribution_privacy_ops_fix_v1'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_attribution_privacy_ops_fix_v1_uat';
  IF existing_checksum IS NOT NULL AND existing_checksum <> 'sha256:966f039cbf412946528136a5c1b9ebf04ce98027d5f2a15ea1820a63d189a2b2' THEN RAISE EXCEPTION 'privacy prepare fix checksum mismatch'; END IF;
END
$guard$;
-- checksum-source-begin
CREATE OR REPLACE FUNCTION private_line.admin_prepare_privacy_request(p_request_id uuid)
RETURNS TABLE(
  request_type text,
  status text,
  conversation_count bigint,
  message_count bigint,
  document_count bigint,
  lead_count bigint,
  advisor_case_count bigint,
  business_event_count bigint,
  implementation_count bigint,
  revenue_record_count bigint,
  destructive_execution_available boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_prepare_privacy_request$
DECLARE
  v_customer uuid;
  v_lead uuid;
  v_type text;
  v_status text;
BEGIN
  SELECT pr.customer_id,pr.lead_id,pr.request_type,pr.status
  INTO v_customer,v_lead,v_type,v_status
  FROM private_line.privacy_request pr
  WHERE pr.privacy_request_id=p_request_id;

  IF v_type IS NULL THEN RAISE EXCEPTION 'privacy request not found'; END IF;
  IF v_status NOT IN ('verified','prepared','approved') THEN RAISE EXCEPTION 'privacy request not verified'; END IF;
  IF v_status='verified' THEN
    UPDATE private_line.privacy_request pr
    SET status='prepared',prepared_at=COALESCE(pr.prepared_at,now())
    WHERE pr.privacy_request_id=p_request_id;
    v_status := 'prepared';
  END IF;

  RETURN QUERY
  WITH scoped_leads AS (
    SELECT l.lead_id,l.conversation_id,l.customer_id
    FROM private_line.lead l
    WHERE (v_lead IS NOT NULL AND l.lead_id=v_lead)
       OR (v_lead IS NULL AND v_customer IS NOT NULL AND l.customer_id=v_customer)
  ),
  scoped_conversations AS (
    SELECT DISTINCT sl.conversation_id
    FROM scoped_leads sl
    WHERE sl.conversation_id IS NOT NULL
  )
  SELECT
    v_type,
    v_status,
    (SELECT count(*) FROM scoped_conversations),
    (SELECT count(*) FROM private_line.message m WHERE m.conversation_id IN (SELECT sc.conversation_id FROM scoped_conversations sc)),
    (SELECT count(*) FROM private_line.document d WHERE d.conversation_id IN (SELECT sc.conversation_id FROM scoped_conversations sc)),
    (SELECT count(*) FROM scoped_leads),
    (SELECT count(*) FROM private_line.advisor_case ac WHERE ac.lead_id IN (SELECT sl.lead_id FROM scoped_leads sl)),
    (SELECT count(*) FROM private_line.business_event e WHERE e.lead_id IN (SELECT sl.lead_id FROM scoped_leads sl)),
    (SELECT count(*) FROM private_line.lead_implementation li WHERE li.lead_id IN (SELECT sl.lead_id FROM scoped_leads sl)),
    (SELECT count(*) FROM private_line.lead_revenue r WHERE r.lead_id IN (SELECT sl.lead_id FROM scoped_leads sl)),
    false;
END
$admin_prepare_privacy_request$;

REVOKE ALL ON FUNCTION private_line.admin_prepare_privacy_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_prepare_privacy_request(uuid) FROM ccpun_line_ingress;
GRANT EXECUTE ON FUNCTION private_line.admin_prepare_privacy_request(uuid) TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum) VALUES('20260918_line_attribution_privacy_ops_fix_v1_uat','sha256:966f039cbf412946528136a5c1b9ebf04ce98027d5f2a15ea1820a63d189a2b2') ON CONFLICT(version) DO NOTHING;
COMMIT;

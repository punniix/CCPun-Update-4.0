BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_private_context_compat_v1_uat' AND checksum='sha256:83c0b6c89014bd11cf3e1aa51d4b7ce0233bfce62b33d594a397514c02e832a0') THEN RAISE EXCEPTION 'context compatibility patch missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_private_inbox_reader_v1'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_private_inbox_reader_v1_uat';
  IF existing_checksum IS NOT NULL AND existing_checksum <> 'sha256:48d5ebc7084f38f6a4e9bdb5ff4f72b1a7ba9bfc42f8356f6fbfd59ee0607c1c' THEN RAISE EXCEPTION 'inbox reader checksum mismatch'; END IF;
END
$guard$;
-- checksum-source-begin
CREATE OR REPLACE FUNCTION private_line.admin_read_advisor_inbox(p_lead_id uuid DEFAULT NULL, p_limit integer DEFAULT 100)
RETURNS TABLE(
  lead_id uuid,
  advisor_case_id uuid,
  customer_code text,
  stage text,
  journey text,
  material_received boolean,
  conversation_status text,
  unread_count integer,
  last_activity_at timestamptz,
  priority text,
  assigned_advisor text,
  latest_message_type text,
  latest_message_status text,
  latest_message_needs_human boolean,
  updated_at timestamptz,
  origin text,
  campaign_id text,
  content_id text,
  need text,
  tool_id text,
  saved_result_ref text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_advisor_inbox$
  SELECT
    l.lead_id,
    ac.advisor_case_id,
    c.customer_code,
    l.stage,
    l.journey,
    l.material_received,
    conv.status AS conversation_status,
    conv.unread_count,
    conv.last_activity_at,
    ac.priority,
    ac.assigned_advisor,
    latest.message_type AS latest_message_type,
    latest.status AS latest_message_status,
    latest.needs_human AS latest_message_needs_human,
    GREATEST(l.updated_at, conv.updated_at, COALESCE(ac.updated_at, l.updated_at), COALESCE(lc.updated_at, l.updated_at)) AS updated_at,
    COALESCE(lc.origin, l.source_origin) AS origin,
    lc.campaign_id,
    lc.content_id,
    lc.need,
    lc.tool_id,
    lc.saved_result_ref
  FROM private_line.lead l
  JOIN private_line.customer c ON c.customer_id = l.customer_id
  JOIN private_line.conversation conv ON conv.conversation_id = l.conversation_id
  LEFT JOIN private_line.advisor_case ac ON ac.lead_id = l.lead_id
  LEFT JOIN private_line.lead_context lc ON lc.lead_id = l.lead_id
  LEFT JOIN LATERAL (
    SELECT m.message_type, m.status, m.needs_human
    FROM private_line.message m
    WHERE m.conversation_id = l.conversation_id
    ORDER BY m.received_at DESC, m.created_at DESC
    LIMIT 1
  ) latest ON true
  WHERE p_lead_id IS NULL OR l.lead_id = p_lead_id
  ORDER BY COALESCE(conv.last_activity_at, l.updated_at) DESC, l.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),100)
$admin_read_advisor_inbox$;

REVOKE ALL ON FUNCTION private_line.admin_read_advisor_inbox(uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_advisor_inbox(uuid,integer) FROM ccpun_line_ingress;
GRANT EXECUTE ON FUNCTION private_line.admin_read_advisor_inbox(uuid,integer) TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum) VALUES('20260918_line_private_inbox_reader_v1_uat','sha256:48d5ebc7084f38f6a4e9bdb5ff4f72b1a7ba9bfc42f8356f6fbfd59ee0607c1c') ON CONFLICT(version) DO NOTHING;
COMMIT;

BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_private_conversation_security_v1_uat' AND checksum='sha256:be2942e075f2beaca66619c72e2b28684c82ce1c950fa7bd9ba5bcda8049c534') THEN RAISE EXCEPTION 'security patch missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_private_context_compat_v1'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_private_context_compat_v1_uat';
  IF existing_checksum IS NOT NULL AND existing_checksum <> 'sha256:83c0b6c89014bd11cf3e1aa51d4b7ce0233bfce62b33d594a397514c02e832a0' THEN RAISE EXCEPTION 'context compatibility checksum mismatch'; END IF;
END
$guard$;
-- checksum-source-begin
DROP VIEW private_line.advisor_inbox_safe;

CREATE VIEW private_line.advisor_inbox_safe AS
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
  GREATEST(l.updated_at, conv.updated_at, COALESCE(ac.updated_at, l.updated_at)) AS updated_at
FROM private_line.lead l
JOIN private_line.customer c ON c.customer_id = l.customer_id
JOIN private_line.conversation conv ON conv.conversation_id = l.conversation_id
LEFT JOIN private_line.advisor_case ac ON ac.lead_id = l.lead_id
LEFT JOIN LATERAL (
  SELECT m.message_type, m.status, m.needs_human
  FROM private_line.message m
  WHERE m.conversation_id = l.conversation_id
  ORDER BY m.received_at DESC, m.created_at DESC
  LIMIT 1
) latest ON true;

CREATE OR REPLACE VIEW private_line.lead_context_safe AS
SELECT
  lead_id,
  origin,
  campaign_id,
  content_id,
  need,
  journey,
  tool_id,
  saved_result_ref,
  updated_at
FROM private_line.lead_context;

REVOKE ALL ON TABLE private_line.advisor_inbox_safe FROM PUBLIC;
REVOKE ALL ON TABLE private_line.lead_context_safe FROM PUBLIC;
REVOKE ALL ON TABLE private_line.lead_context_safe FROM ccpun_line_ingress;
GRANT SELECT ON TABLE private_line.advisor_inbox_safe TO ccpun_admin_runtime;
GRANT SELECT ON TABLE private_line.lead_context_safe TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum) VALUES('20260918_line_private_context_compat_v1_uat','sha256:83c0b6c89014bd11cf3e1aa51d4b7ce0233bfce62b33d594a397514c02e832a0') ON CONFLICT(version) DO NOTHING;
COMMIT;

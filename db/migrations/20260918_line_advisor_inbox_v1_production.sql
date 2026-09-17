BEGIN;

DO $migration_guard$
DECLARE
  current_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN
    RAISE EXCEPTION 'CCPun LINE Advisor Inbox migration requires database neondb';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private_line.schema_migration
    WHERE version = '20260917_private_line_runtime_v1_production'
      AND checksum = 'sha256:f562ba174f50cf617d0e12ffd13c46e5815b069dc823ecb7c8522d7b05d6c57b'
  ) THEN
    RAISE EXCEPTION 'Base private_line Production migration is missing or mismatched';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private_line.system_identity
    WHERE singleton = true
      AND project_id = 'lively-bar-43618798'
      AND branch_id = 'br-long-resonance-b3ys5xrv'
      AND endpoint_id = 'ep-broad-butterfly-b3ro7u8w'
      AND database_name = 'neondb'
      AND migration_version = '20260917_private_line_runtime_v1_production'
      AND migration_checksum = 'sha256:f562ba174f50cf617d0e12ffd13c46e5815b069dc823ecb7c8522d7b05d6c57b'
  ) THEN
    RAISE EXCEPTION 'Base private_line Production identity is missing or mismatched';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_admin_runtime') THEN
    RAISE EXCEPTION 'ccpun_admin_runtime role is required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_advisor_inbox_v1'));
  SELECT checksum INTO current_checksum
  FROM private_line.schema_migration
  WHERE version = '20260918_line_advisor_inbox_v1_production';
  IF current_checksum IS NOT NULL AND current_checksum <> 'sha256:99519369562761cfb4cb95fe7d6e14f5d0a158ba31b116200d729eb865a451e0' THEN
    RAISE EXCEPTION 'CCPun LINE Advisor Inbox migration checksum mismatch';
  END IF;
  IF current_checksum IS NULL AND to_regclass('private_line.advisor_inbox_safe') IS NOT NULL THEN
    RAISE EXCEPTION 'Advisor Inbox safe view exists without the current migration ledger';
  END IF;
END
$migration_guard$;

-- checksum-source-begin
CREATE OR REPLACE VIEW private_line.advisor_inbox_safe AS
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

REVOKE ALL ON TABLE private_line.advisor_inbox_safe FROM PUBLIC;
REVOKE ALL ON TABLE private_line.advisor_inbox_safe FROM ccpun_line_ingress;
REVOKE ALL PRIVILEGES ON TABLE
  private_line.schema_migration,
  private_line.system_identity,
  private_line.customer,
  private_line.provider_identity,
  private_line.conversation,
  private_line.webhook_event,
  private_line.message,
  private_line.document,
  private_line.lead,
  private_line.advisor_case,
  private_line.safe_journey_state,
  private_line.message_tombstone
FROM ccpun_admin_runtime;
GRANT USAGE ON SCHEMA private_line TO ccpun_admin_runtime;
GRANT SELECT ON TABLE private_line.advisor_inbox_safe TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO private_line.schema_migration (version, checksum)
VALUES ('20260918_line_advisor_inbox_v1_production', 'sha256:99519369562761cfb4cb95fe7d6e14f5d0a158ba31b116200d729eb865a451e0')
ON CONFLICT (version) DO NOTHING;

COMMIT;

BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_private_conversation_v1_production' AND checksum='sha256:d208639906275865acb686cb0d0039e14a9feb3dcd7a2156702f45b061c34344') THEN RAISE EXCEPTION 'private conversation base missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_private_conversation_security_v1'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_private_conversation_security_v1_production';
  IF existing_checksum IS NOT NULL AND existing_checksum <> 'sha256:be2942e075f2beaca66619c72e2b28684c82ce1c950fa7bd9ba5bcda8049c534' THEN RAISE EXCEPTION 'security patch checksum mismatch'; END IF;
END
$guard$;
-- checksum-source-begin
REVOKE ALL ON FUNCTION private_line.safe_id(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.safe_hex_digest(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.safe_json_keys_only(jsonb,text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.record_safe_web_journey_event(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_line_transcript(uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_enqueue_line_reply(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_claim_line_outbound(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_checkpoint_line_outbound(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_update_lead_stage(jsonb) FROM PUBLIC;

REVOKE ALL ON FUNCTION private_line.record_safe_web_journey_event(jsonb) FROM ccpun_admin_runtime;
REVOKE ALL ON FUNCTION private_line.admin_read_line_transcript(uuid,integer) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_enqueue_line_reply(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_claim_line_outbound(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_checkpoint_line_outbound(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_update_lead_stage(jsonb) FROM ccpun_line_ingress;

GRANT EXECUTE ON FUNCTION private_line.record_safe_web_journey_event(jsonb) TO ccpun_line_ingress;
GRANT EXECUTE ON FUNCTION private_line.admin_read_line_transcript(uuid,integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_enqueue_line_reply(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_claim_line_outbound(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_checkpoint_line_outbound(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_update_lead_stage(jsonb) TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum) VALUES('20260918_line_private_conversation_security_v1_production','sha256:be2942e075f2beaca66619c72e2b28684c82ce1c950fa7bd9ba5bcda8049c534') ON CONFLICT(version) DO NOTHING;
COMMIT;

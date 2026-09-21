BEGIN;
SET LOCAL lock_timeout = '5s';

DO $guard$
BEGIN
  IF current_database() <> 'neondb' THEN
    RAISE EXCEPTION 'LINE_ADMIN_INGRESS_DATABASE_MISMATCH';
  END IF;
  IF to_regprocedure('private_line.ingest_line_event(jsonb)') IS NULL
     OR to_regprocedure('private_line.ingress_record_line_runtime_health(jsonb)') IS NULL
     OR to_regprocedure('private_line.ingress_apply_line_postback_context(jsonb)') IS NULL
     OR to_regprocedure('private_line.ingress_apply_line_message_context(jsonb)') IS NULL
     OR to_regprocedure('private_line.ingress_enqueue_line_system_outbound(jsonb)') IS NULL
     OR to_regprocedure('private_line.ingress_read_line_key_rotation_candidates(text,integer)') IS NULL
     OR to_regprocedure('private_line.ingress_apply_line_key_rotation(jsonb)') IS NULL
     OR to_regprocedure('private_line.ingress_record_safe_knowledge_event(jsonb)') IS NULL
     OR to_regprocedure('private_line.record_safe_web_journey_event(jsonb)') IS NULL
  THEN
    RAISE EXCEPTION 'LINE_ADMIN_INGRESS_CAPABILITY_MISSING';
  END IF;
END
$guard$;

GRANT EXECUTE ON FUNCTION private_line.ingest_line_event(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.ingress_record_line_runtime_health(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.ingress_apply_line_postback_context(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.ingress_apply_line_message_context(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.ingress_enqueue_line_system_outbound(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.ingress_read_line_key_rotation_candidates(text,integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.ingress_apply_line_key_rotation(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.ingress_record_safe_knowledge_event(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.record_safe_web_journey_event(jsonb) TO ccpun_admin_runtime;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA private_line FROM ccpun_line_ingress;

INSERT INTO ccpun_admin.schema_migration(version,checksum)
VALUES('20260921_line_admin_ingress_boundary_v1','sha256:81ead580ba722a69d8093530f38eab6124374203528ea965314bba269be78459')
ON CONFLICT(version) DO NOTHING;

COMMIT;

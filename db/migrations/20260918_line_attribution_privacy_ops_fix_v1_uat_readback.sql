SELECT
 EXISTS(SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_attribution_privacy_ops_fix_v1_uat' AND checksum='sha256:966f039cbf412946528136a5c1b9ebf04ce98027d5f2a15ea1820a63d189a2b2') AS fix_checksum_ok,
 has_function_privilege('ccpun_admin_runtime','private_line.admin_prepare_privacy_request(uuid)','EXECUTE') AS admin_prepare_execute,
 NOT has_function_privilege('ccpun_line_ingress','private_line.admin_prepare_privacy_request(uuid)','EXECUTE') AS ingress_prepare_denied,
 (SELECT NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') FROM pg_proc p WHERE p.oid='private_line.admin_prepare_privacy_request(uuid)'::regprocedure) AS public_prepare_denied,
 position('pr.request_type' in pg_get_functiondef('private_line.admin_prepare_privacy_request(uuid)'::regprocedure)) > 0 AS qualified_request_type_ok,
 position('pr.status' in pg_get_functiondef('private_line.admin_prepare_privacy_request(uuid)'::regprocedure)) > 0 AS qualified_status_ok;

SELECT
 EXISTS(SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_private_inbox_reader_v1_production' AND checksum='sha256:48d5ebc7084f38f6a4e9bdb5ff4f72b1a7ba9bfc42f8356f6fbfd59ee0607c1c') AS inbox_reader_checksum_ok,
 has_function_privilege('ccpun_admin_runtime','private_line.admin_read_advisor_inbox(uuid,integer)','EXECUTE') AS admin_reader_execute,
 NOT has_function_privilege('ccpun_line_ingress','private_line.admin_read_advisor_inbox(uuid,integer)','EXECUTE') AS ingress_reader_denied,
 (SELECT NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') FROM pg_proc p WHERE p.oid='private_line.admin_read_advisor_inbox(uuid,integer)'::regprocedure) AS public_reader_denied,
 NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants g JOIN information_schema.tables t ON t.table_schema=g.table_schema AND t.table_name=g.table_name WHERE g.grantee='ccpun_admin_runtime' AND g.table_schema='private_line' AND t.table_type='BASE TABLE') AS admin_no_base_table_grants;

-- Read-only verification for 20261026_investment_fund_catalog_v1 (run on the lane just migrated).
SELECT current_database() AS database_name,
  (SELECT checksum FROM ccpun_fund.schema_migration WHERE version = '20261026_investment_fund_catalog_v1') AS ledger_checksum,
  (SELECT string_agg(c.relname, ',' ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'ccpun_fund' AND c.relkind = 'r') AS tables,
  (SELECT string_agg(r.rolname || ':login=' || r.rolcanlogin, ',' ORDER BY r.rolname) FROM pg_roles r
    WHERE r.rolname IN ('ccpun_fund_runtime','ccpun_fund_sync')) AS roles,
  (SELECT string_agg(r.rolname || '.' || p.proname, ',' ORDER BY r.rolname, p.proname)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('ccpun_fund_runtime'),('ccpun_fund_sync')) r(rolname)
    WHERE n.nspname = 'ccpun_fund' AND has_function_privilege(r.rolname, p.oid, 'EXECUTE')) AS executable_functions,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('ccpun_fund_runtime'),('ccpun_fund_sync')) r(rolname)
    WHERE n.nspname = 'ccpun_fund' AND c.relkind = 'r'
      AND has_table_privilege(r.rolname, c.oid, 'SELECT,INSERT,UPDATE,DELETE')) AS direct_table_privileges,
  (SELECT count(*) FROM ccpun_fund.fund) AS fund_rows,
  (SELECT count(*) FROM ccpun_fund.sync_run) AS sync_runs;

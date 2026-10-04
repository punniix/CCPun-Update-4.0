BEGIN READ ONLY;

SELECT
  current_user='ccpun_social_runtime' AND current_database()='neondb' AS runtime_current,
  current_setting('transaction_isolation')='read committed' AS isolation_current,
  EXISTS (SELECT 1 FROM ccpun_social.schema_migration WHERE version='20261004_social_operation_receipts_v1' AND checksum='sha256:1917b07e95bd84bf8e908a54dbaf80eefbe17ee1071b637d1ec7685b1f2940b3') AS ledger_current,
  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='ccpun_social.social_publication_job'::regclass
    AND a.attname='mutation_receipts' AND a.atttypid='jsonb'::regtype AND a.attnotnull AND NOT a.attisdropped
    AND EXISTS (SELECT 1 FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum
      AND pg_get_expr(d.adbin,d.adrelid)=(quote_literal('{}')||'::jsonb'))) AS column_current,
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
    WHERE t.tgrelid='ccpun_social.social_publication_job'::regclass
      AND t.tgname='social_operation_receipts_guard' AND NOT t.tgisinternal
      AND t.tgtype=31 AND t.tgenabled='O' AND p.pronamespace='ccpun_social'::regnamespace
      AND p.proname='guard_social_operation_receipts' AND p.provolatile='v' AND NOT p.prosecdef
      AND p.proconfig=ARRAY['search_path=pg_catalog']::text[] AND md5(p.prosrc)='dabc72200ce5b7c8da41ff1207fbadff'
      AND has_function_privilege(current_user,p.oid,'EXECUTE')) AS trigger_current,
  NOT EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND
    (tgrelid IN ('ccpun_social.social_publication'::regclass,'ccpun_social.social_execution_audit'::regclass)
      OR (tgrelid='ccpun_social.social_publication_job'::regclass AND tgname<>'social_operation_receipts_guard')))
    AS other_triggers_absent,
  (SELECT count(*)=3 AND bool_and(NOT relrowsecurity AND NOT relforcerowsecurity) FROM pg_class
    WHERE oid IN ('ccpun_social.social_publication'::regclass,'ccpun_social.social_publication_job'::regclass,
      'ccpun_social.social_execution_audit'::regclass)) AS rls_absent,
  EXISTS (SELECT 1 FROM pg_constraint c WHERE c.contype='f' AND c.convalidated AND NOT c.condeferrable
    AND NOT c.condeferred AND c.conrelid='ccpun_social.social_publication_job'::regclass
    AND c.confrelid='ccpun_social.social_publication'::regclass
    AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='publication_id')]::smallint[]
    AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='id')]::smallint[])
    AS immediate_fk_current,
  has_column_privilege(current_user,'ccpun_social.social_publication_job','mutation_receipts','UPDATE')
    AND NOT has_table_privilege(current_user,'ccpun_social.social_publication_job','UPDATE') AS receipt_grant_current,
  has_table_privilege(current_user,'ccpun_social.social_execution_audit','INSERT')
    AND NOT has_any_column_privilege(current_user,'ccpun_social.social_execution_audit','SELECT')
    AND NOT has_any_column_privilege(current_user,'ccpun_social.social_execution_audit','UPDATE,REFERENCES')
    AND NOT has_table_privilege(current_user,'ccpun_social.social_execution_audit','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AS audit_append_only;

ROLLBACK;

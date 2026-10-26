-- Read-only; run separately in each owner-approved lane, never by this task.
SELECT project_id,branch_id FROM ccpun_admin.system_identity WHERE singleton;
SELECT table_name,column_name,data_type FROM information_schema.columns
 WHERE table_schema='ccpun_admin' AND table_name LIKE 'seo_%' ORDER BY table_name,ordinal_position;
SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid IN ('ccpun_admin.seo_post_publish_job'::regclass,'ccpun_admin.seo_post_publish_intent'::regclass,'ccpun_admin.seo_post_publish_step'::regclass);
SELECT grantee,table_name,privilege_type FROM information_schema.role_table_grants
 WHERE table_schema='ccpun_admin' AND table_name LIKE 'seo_%' ORDER BY table_name,grantee,privilege_type;
SELECT has_function_privilege('ccpun_seo_post_publish_worker','ccpun_admin.seo_reserve_notification(uuid,uuid,text,int)','EXECUTE') AS worker_can_reserve,
 has_function_privilege('ccpun_admin_runtime','ccpun_admin.seo_reserve_notification(uuid,uuid,text,int)','EXECUTE') AS producer_cannot_reserve;

SELECT has_function_privilege('ccpun_seo_post_publish_worker','ccpun_admin.seo_reserve_initial_inspection(uuid,uuid)','EXECUTE') AS worker_can_reserve_observation,
 has_function_privilege('ccpun_admin_runtime','ccpun_admin.seo_reserve_initial_inspection(uuid,uuid)','EXECUTE') AS producer_cannot_reserve_observation;
SELECT proname,prosecdef,proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='ccpun_admin' AND proname IN ('seo_reserve_notification','seo_reserve_initial_inspection');
SELECT grantee,table_name,column_name,privilege_type FROM information_schema.column_privileges
 WHERE table_schema='ccpun_admin' AND table_name='seo_post_publish_job' ORDER BY grantee,column_name,privilege_type;

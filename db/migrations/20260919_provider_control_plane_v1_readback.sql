SELECT
  current_database()='neondb' AS database_ok,
  EXISTS(
    SELECT 1 FROM ccpun_admin.schema_migration
    WHERE version='20260919_provider_control_plane_v1'
      AND checksum='sha256:bfb668d37d859d3e01bdbee9ea433e5bdb835157f72ea983ce819c3c24160de1'
  ) AS migration_ok,
  EXISTS(
    SELECT 1 FROM ccpun_admin.control_resource
    WHERE resource_key='line.rich_menu.default'
      AND desired_mode='hold' AND state='hold' AND row_version=1
  ) AS rich_menu_fail_closed,
  to_regclass('ccpun_admin.control_command') IS NOT NULL AS command_table_ok,
  to_regclass('ccpun_admin.provider_operation') IS NOT NULL AS operation_table_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_read_control_resource(text)','EXECUTE') AS read_function_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_submit_control_command(jsonb)','EXECUTE') AS submit_function_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_claim_provider_operation(jsonb)','EXECUTE') AS claim_function_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_begin_provider_mutation(jsonb)','EXECUTE') AS begin_function_ok,
  has_function_privilege('ccpun_admin_runtime','ccpun_admin.admin_checkpoint_provider_operation(jsonb)','EXECUTE') AS checkpoint_function_ok,
  NOT has_table_privilege('ccpun_admin_runtime','ccpun_admin.control_resource','SELECT') AS direct_resource_denied,
  NOT has_table_privilege('ccpun_admin_runtime','ccpun_admin.control_command','SELECT') AS direct_command_denied,
  NOT has_table_privilege('ccpun_admin_runtime','ccpun_admin.provider_operation','SELECT') AS direct_operation_denied;

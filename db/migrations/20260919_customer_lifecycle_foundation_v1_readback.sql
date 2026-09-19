SELECT
  EXISTS(SELECT 1 FROM private_line.schema_migration
    WHERE version='20260919_customer_lifecycle_foundation_v1'
      AND checksum='sha256:cd12ea86c8705d4cdb1db3002cee9bb8616e208d007a39847edfa3bd37cbc693') AS migration_ok,
  to_regclass('private_line.contact_permission_event') IS NOT NULL AS permission_event_ok,
  to_regclass('private_line.customer_journey_instance') IS NOT NULL AS journey_instance_ok,
  to_regclass('private_line.conversation_task') IS NOT NULL AS conversation_task_ok,
  has_table_privilege('ccpun_admin_runtime','private_line.contact_permission_current_safe','SELECT') AS permission_safe_read_ok,
  has_table_privilege('ccpun_admin_runtime','private_line.customer_journey_instance_safe','SELECT') AS journey_safe_read_ok,
  has_table_privilege('ccpun_admin_runtime','private_line.conversation_task_safe','SELECT') AS task_safe_read_ok,
  NOT has_table_privilege('ccpun_admin_runtime','private_line.contact_permission_event','SELECT,INSERT,UPDATE,DELETE') AS permission_direct_denied,
  NOT has_table_privilege('ccpun_admin_runtime','private_line.customer_journey_instance','SELECT,INSERT,UPDATE,DELETE') AS journey_direct_denied,
  NOT has_table_privilege('ccpun_admin_runtime','private_line.conversation_task','SELECT,INSERT,UPDATE,DELETE') AS task_direct_denied;

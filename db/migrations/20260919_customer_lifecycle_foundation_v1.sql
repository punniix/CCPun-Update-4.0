BEGIN;

SELECT 1 / CASE WHEN current_database()='neondb' THEN 1 ELSE 0 END AS database_guard;
SELECT 1 / CASE WHEN EXISTS(
  SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime'
    AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
    AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls
) THEN 1 ELSE 0 END AS runtime_role_guard;
SELECT 1 / CASE WHEN EXISTS(
  SELECT 1 FROM private_line.system_identity WHERE singleton=true
) THEN 1 ELSE 0 END AS identity_guard;
SELECT pg_advisory_xact_lock(hashtext('private_line:20260919_customer_lifecycle_foundation_v1'));
SELECT 1 / CASE WHEN NOT EXISTS(
  SELECT 1 FROM private_line.schema_migration
  WHERE version='20260919_customer_lifecycle_foundation_v1'
    AND checksum<>'sha256:cd12ea86c8705d4cdb1db3002cee9bb8616e208d007a39847edfa3bd37cbc693'
) THEN 1 ELSE 0 END AS checksum_guard;

-- checksum-source-begin
CREATE TABLE IF NOT EXISTS private_line.contact_permission_event (
  permission_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES private_line.customer(customer_id),
  channel text NOT NULL CHECK (channel IN ('line','email','phone','sms','web_push')),
  purpose text NOT NULL CHECK (purpose IN ('service','advisory','marketing')),
  decision text NOT NULL CHECK (decision IN ('granted','denied','revoked','unknown')),
  source text NOT NULL CHECK (private_line.safe_id(source)),
  evidence_digest text NOT NULL CHECK (private_line.safe_hex_digest(evidence_digest)),
  actor_digest text NOT NULL CHECK (private_line.safe_hex_digest(actor_digest)),
  idempotency_digest text NOT NULL UNIQUE CHECK (private_line.safe_hex_digest(idempotency_digest)),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_permission_event_current_idx
  ON private_line.contact_permission_event(customer_id,channel,purpose,occurred_at DESC,recorded_at DESC);

CREATE TABLE IF NOT EXISTS private_line.customer_journey_instance (
  journey_instance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES private_line.customer(customer_id),
  conversation_id uuid REFERENCES private_line.conversation(conversation_id),
  lead_id uuid REFERENCES private_line.lead(lead_id),
  journey text NOT NULL CHECK (private_line.safe_id(journey)),
  state text NOT NULL CHECK (state IN ('active','completed','abandoned','human_handoff')),
  entrypoint text NOT NULL CHECK (private_line.safe_id(entrypoint)),
  source_event_key text NOT NULL UNIQUE CHECK (length(source_event_key) BETWEEN 16 AND 220),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version>0),
  started_at timestamptz NOT NULL,
  last_activity_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state='completed')=(completed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS customer_journey_instance_customer_idx
  ON private_line.customer_journey_instance(customer_id,last_activity_at DESC);
CREATE INDEX IF NOT EXISTS customer_journey_instance_active_idx
  ON private_line.customer_journey_instance(state,last_activity_at)
  WHERE state IN ('active','human_handoff');

CREATE TABLE IF NOT EXISTS private_line.conversation_task (
  conversation_task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES private_line.customer(customer_id),
  conversation_id uuid REFERENCES private_line.conversation(conversation_id),
  lead_id uuid REFERENCES private_line.lead(lead_id),
  advisor_case_id uuid REFERENCES private_line.advisor_case(advisor_case_id),
  journey_instance_id uuid REFERENCES private_line.customer_journey_instance(journey_instance_id),
  task_type text NOT NULL CHECK (task_type IN (
    'follow_up','document_review','policy_review','quote_review','investment_review','human_handoff'
  )),
  status text NOT NULL CHECK (status IN ('open','in_progress','done','cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_advisor_digest text CHECK (assigned_advisor_digest IS NULL OR private_line.safe_hex_digest(assigned_advisor_digest)),
  source_event_key text NOT NULL UNIQUE CHECK (length(source_event_key) BETWEEN 16 AND 220),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version>0),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='done')=(completed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS conversation_task_queue_idx
  ON private_line.conversation_task(status,priority,due_at,created_at)
  WHERE status IN ('open','in_progress');

CREATE OR REPLACE VIEW private_line.contact_permission_current_safe AS
SELECT DISTINCT ON (event.customer_id,event.channel,event.purpose)
  customer.customer_code,event.channel,event.purpose,event.decision,event.source,
  event.occurred_at,event.recorded_at
FROM private_line.contact_permission_event event
JOIN private_line.customer customer ON customer.customer_id=event.customer_id
ORDER BY event.customer_id,event.channel,event.purpose,event.occurred_at DESC,event.recorded_at DESC;

CREATE OR REPLACE VIEW private_line.customer_journey_instance_safe AS
SELECT instance.journey_instance_id,customer.customer_code,instance.journey,instance.state,
  instance.entrypoint,instance.row_version,instance.started_at,instance.last_activity_at,
  instance.completed_at,instance.created_at,instance.updated_at,
  (instance.conversation_id IS NOT NULL) AS conversation_bound,
  (instance.lead_id IS NOT NULL) AS lead_bound
FROM private_line.customer_journey_instance instance
JOIN private_line.customer customer ON customer.customer_id=instance.customer_id;

CREATE OR REPLACE VIEW private_line.conversation_task_safe AS
SELECT task.conversation_task_id,customer.customer_code,task.task_type,task.status,
  task.priority,task.row_version,task.due_at,task.completed_at,task.created_at,task.updated_at,
  (task.conversation_id IS NOT NULL) AS conversation_bound,
  (task.lead_id IS NOT NULL) AS lead_bound,
  (task.advisor_case_id IS NOT NULL) AS advisor_case_bound,
  (task.journey_instance_id IS NOT NULL) AS journey_instance_bound
FROM private_line.conversation_task task
JOIN private_line.customer customer ON customer.customer_id=task.customer_id;

REVOKE ALL PRIVILEGES ON private_line.contact_permission_event,
  private_line.customer_journey_instance,private_line.conversation_task
  FROM PUBLIC,ccpun_admin_runtime,ccpun_line_ingress;
REVOKE ALL ON private_line.contact_permission_current_safe,
  private_line.customer_journey_instance_safe,private_line.conversation_task_safe FROM PUBLIC;
GRANT SELECT ON private_line.contact_permission_current_safe,
  private_line.customer_journey_instance_safe,private_line.conversation_task_safe TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO private_line.schema_migration(version,checksum)
VALUES('20260919_customer_lifecycle_foundation_v1','sha256:cd12ea86c8705d4cdb1db3002cee9bb8616e208d007a39847edfa3bd37cbc693')
ON CONFLICT(version) DO NOTHING;

COMMIT;

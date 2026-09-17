BEGIN;

DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.schema_migration WHERE version='20260917_private_line_runtime_v1_uat' AND checksum='sha256:19a7dfaf26d2cc4f6cbf01d7ff2380056383f8e87dd079a6e141e73b878985d3') THEN RAISE EXCEPTION 'base private_line mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_advisor_inbox_v1_uat' AND checksum='sha256:99519369562761cfb4cb95fe7d6e14f5d0a158ba31b116200d729eb865a451e0') THEN RAISE EXCEPTION 'advisor inbox base missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.system_identity WHERE singleton=true AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394' AND database_name='neondb' AND migration_version='20260917_private_line_runtime_v1_uat' AND migration_checksum='sha256:19a7dfaf26d2cc4f6cbf01d7ff2380056383f8e87dd079a6e141e73b878985d3') THEN RAISE EXCEPTION 'base system identity changed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ccpun_admin_runtime') THEN RAISE EXCEPTION 'admin runtime role missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_private_conversation_v1'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_private_conversation_v1_uat';
  IF existing_checksum IS NOT NULL AND existing_checksum <> 'sha256:d208639906275865acb686cb0d0039e14a9feb3dcd7a2156702f45b061c34344' THEN RAISE EXCEPTION 'migration checksum mismatch'; END IF;
END
$guard$;

-- checksum-source-begin
CREATE OR REPLACE FUNCTION private_line.safe_id(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $safe_id$
  SELECT value IS NULL OR value ~ '^[a-z0-9][a-z0-9_-]{0,79}$'
$safe_id$;

CREATE OR REPLACE FUNCTION private_line.safe_hex_digest(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $safe_hex_digest$
  SELECT value IS NULL OR value ~ '^[0-9a-f]{64}$'
$safe_hex_digest$;

CREATE OR REPLACE FUNCTION private_line.safe_json_keys_only(payload jsonb, allowed text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $safe_json_keys_only$
  SELECT COALESCE(jsonb_typeof(payload) = 'object', false)
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(payload) AS keys(key_name)
      WHERE NOT key_name = ANY(allowed)
    )
$safe_json_keys_only$;

CREATE TABLE IF NOT EXISTS private_line.journey_definition (
  journey text PRIMARY KEY CHECK (private_line.safe_id(journey)),
  vertical text NOT NULL CHECK (vertical IN ('motor','life-health','investment')),
  label text NOT NULL,
  hero_offer text NOT NULL,
  entry_question text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.rich_menu_item (
  rich_menu_item_id text PRIMARY KEY CHECK (private_line.safe_id(rich_menu_item_id)),
  label text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('postback','uri')),
  postback_data text,
  uri text,
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((action_type = 'postback' AND postback_data IS NOT NULL AND uri IS NULL) OR (action_type = 'uri' AND uri IS NOT NULL AND postback_data IS NULL))
);

CREATE TABLE IF NOT EXISTS private_line.quick_reply_template (
  quick_reply_id text PRIMARY KEY CHECK (private_line.safe_id(quick_reply_id)),
  journey text NOT NULL REFERENCES private_line.journey_definition(journey),
  stage text NOT NULL CHECK (private_line.safe_id(stage)),
  label text NOT NULL,
  postback_data text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.web_journey_event (
  journey_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id_digest text CHECK (private_line.safe_hex_digest(anonymous_id_digest)),
  journey text NOT NULL REFERENCES private_line.journey_definition(journey),
  entrypoint text NOT NULL CHECK (private_line.safe_id(entrypoint)),
  event_type text NOT NULL CHECK (event_type IN ('content_cta','tool_start','tool_complete','save_to_line','line_continue','conversation_handoff')),
  content_id text CHECK (private_line.safe_id(content_id)),
  tool_id text CHECK (private_line.safe_id(tool_id)),
  saved_result_ref text CHECK (private_line.safe_id(saved_result_ref)),
  campaign_id text CHECK (private_line.safe_id(campaign_id)),
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (private_line.safe_json_keys_only(attribution, ARRAY['traffic_source','utm_source','utm_medium','utm_campaign','utm_content','utm_term','referrer_host']::text[])),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS private_line_web_journey_event_journey_idx
  ON private_line.web_journey_event (journey, created_at DESC);

CREATE TABLE IF NOT EXISTS private_line.saved_result_reference (
  saved_result_ref text PRIMARY KEY CHECK (private_line.safe_id(saved_result_ref)),
  anonymous_id_digest text CHECK (private_line.safe_hex_digest(anonymous_id_digest)),
  journey text NOT NULL REFERENCES private_line.journey_definition(journey),
  tool_id text CHECK (private_line.safe_id(tool_id)),
  content_id text CHECK (private_line.safe_id(content_id)),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (private_line.safe_json_keys_only(metadata, ARRAY['scenario_id','version','summary_id','question_id']::text[])),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.lead_context (
  lead_id uuid PRIMARY KEY REFERENCES private_line.lead(lead_id),
  origin text NOT NULL DEFAULT 'line' CHECK (private_line.safe_id(origin)),
  campaign_id text CHECK (private_line.safe_id(campaign_id)),
  content_id text CHECK (private_line.safe_id(content_id)),
  need text CHECK (private_line.safe_id(need)),
  journey text REFERENCES private_line.journey_definition(journey),
  tool_id text CHECK (private_line.safe_id(tool_id)),
  saved_result_ref text CHECK (private_line.safe_id(saved_result_ref)),
  question_ids text[] NOT NULL DEFAULT '{}'::text[],
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (private_line.safe_json_keys_only(attribution, ARRAY['traffic_source','utm_source','utm_medium','utm_campaign','utm_content','utm_term','referrer_host']::text[])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(question_ids) <= 20)
);

CREATE TABLE IF NOT EXISTS private_line.lead_stage_history (
  lead_stage_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES private_line.lead(lead_id),
  from_stage text NOT NULL CHECK (from_stage IN ('New','Qualified','Expert Review','Solution','Quote','Implementation','Won','Lost')),
  to_stage text NOT NULL CHECK (to_stage IN ('New','Qualified','Expert Review','Solution','Quote','Implementation','Won','Lost')),
  actor_digest text NOT NULL CHECK (private_line.safe_hex_digest(actor_digest)),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS private_line_lead_stage_history_idx
  ON private_line.lead_stage_history (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS private_line.outbound_message (
  outbound_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES private_line.lead(lead_id),
  conversation_id uuid NOT NULL REFERENCES private_line.conversation(conversation_id),
  advisor_case_id uuid REFERENCES private_line.advisor_case(advisor_case_id),
  message_kind text NOT NULL DEFAULT 'admin_reply' CHECK (message_kind IN ('admin_reply','quick_reply','system_notice')),
  idempotency_digest text NOT NULL UNIQUE CHECK (private_line.safe_hex_digest(idempotency_digest)),
  content_ciphertext_b64 text NOT NULL,
  content_nonce_b64 text NOT NULL,
  content_auth_tag_b64 text NOT NULL,
  content_key_version smallint NOT NULL CHECK (content_key_version > 0),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','leased','sent','failed','reconciliation_required','cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_owner_digest text CHECK (private_line.safe_hex_digest(lease_owner_digest)),
  lease_expires_at timestamptz,
  send_after timestamptz,
  provider_message_digest text CHECK (private_line.safe_hex_digest(provider_message_digest)),
  last_error_class text CHECK (private_line.safe_id(last_error_class)),
  created_by_digest text NOT NULL CHECK (private_line.safe_hex_digest(created_by_digest)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS private_line_outbound_queue_idx
  ON private_line.outbound_message (status, COALESCE(send_after, created_at), created_at)
  WHERE status IN ('queued','failed');

CREATE TABLE IF NOT EXISTS private_line.outbound_delivery_attempt (
  delivery_attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_id uuid NOT NULL REFERENCES private_line.outbound_message(outbound_id),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  provider_status text NOT NULL CHECK (provider_status IN ('sent','failed','reconciliation_required')),
  provider_status_code integer,
  error_class text CHECK (private_line.safe_id(error_class)),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outbound_id, attempt_number)
);

INSERT INTO private_line.journey_definition (journey, vertical, label, hero_offer, entry_question)
VALUES
  ('motor_quote_review','motor','ประกันรถ','ส่ง Quote มาเช็ก','มีใบเสนอราคาประกันรถอยู่แล้วไหม?'),
  ('life_health_policy_review','life-health','ชีวิต / สุขภาพ','ส่งของเดิมมาเช็ก','มีกรมธรรม์หรือแผนเดิมที่อยากให้ช่วยแยกหน้าที่ไหม?'),
  ('investment_before_you_act','investment','ลงทุน','ก่อนเพิ่ม/ย้าย ลองเช็กก่อน','กำลังจะเพิ่มเงิน ย้ายกอง หรือซื้ออะไรเพิ่ม?')
ON CONFLICT (journey) DO UPDATE SET
  vertical = EXCLUDED.vertical,
  label = EXCLUDED.label,
  hero_offer = EXCLUDED.hero_offer,
  entry_question = EXCLUDED.entry_question,
  active = true,
  updated_at = now();

INSERT INTO private_line.rich_menu_item (rich_menu_item_id, label, action_type, postback_data, uri, sort_order)
VALUES
  ('content','หาเรื่องอ่าน','uri',NULL,'https://ccpun.com/blog/',10),
  ('tools','เครื่องมือ','uri',NULL,'https://ccpun.com/tools/',20),
  ('insurance','ประกัน','postback','journey=life_health_policy_review&stage=entry',NULL,30),
  ('investment','ลงทุน','postback','journey=investment_before_you_act&stage=entry',NULL,40),
  ('motor','รถ','postback','journey=motor_quote_review&stage=entry',NULL,50),
  ('human','คุยกับปัน','postback','journey=human_handoff&stage=waiting_for_advisor',NULL,60)
ON CONFLICT (rich_menu_item_id) DO UPDATE SET
  label = EXCLUDED.label,
  action_type = EXCLUDED.action_type,
  postback_data = EXCLUDED.postback_data,
  uri = EXCLUDED.uri,
  sort_order = EXCLUDED.sort_order,
  active = true,
  updated_at = now();

INSERT INTO private_line.quick_reply_template (quick_reply_id, journey, stage, label, postback_data)
VALUES
  ('motor_has_quote','motor_quote_review','quote_available','มี Quote แล้ว','journey=motor_quote_review&stage=quote_available'),
  ('motor_no_quote','motor_quote_review','need_vehicle_info','ยังไม่มี Quote','journey=motor_quote_review&stage=need_vehicle_info'),
  ('life_has_policy','life_health_policy_review','material_request','มีกรมธรรม์เดิม','journey=life_health_policy_review&stage=material_request'),
  ('life_ci_check','life_health_policy_review','ci_planning_context','เช็กเงินก้อนโรคร้ายแรง','journey=life_health_policy_review&stage=ci_planning_context'),
  ('invest_add','investment_before_you_act','before_add','ก่อนซื้อเพิ่ม','journey=investment_before_you_act&stage=before_add'),
  ('invest_move','investment_before_you_act','before_switch','ก่อนย้าย/สับเปลี่ยน','journey=investment_before_you_act&stage=before_switch')
ON CONFLICT (quick_reply_id) DO UPDATE SET
  journey = EXCLUDED.journey,
  stage = EXCLUDED.stage,
  label = EXCLUDED.label,
  postback_data = EXCLUDED.postback_data,
  active = true,
  updated_at = now();

CREATE OR REPLACE VIEW private_line.advisor_inbox_safe AS
SELECT
  l.lead_id,
  ac.advisor_case_id,
  c.customer_code,
  l.stage,
  l.journey,
  l.material_received,
  conv.status AS conversation_status,
  conv.unread_count,
  conv.last_activity_at,
  ac.priority,
  ac.assigned_advisor,
  latest.message_type AS latest_message_type,
  latest.status AS latest_message_status,
  latest.needs_human AS latest_message_needs_human,
  GREATEST(l.updated_at, conv.updated_at, COALESCE(ac.updated_at, l.updated_at), COALESCE(lc.updated_at, l.updated_at)) AS updated_at,
  COALESCE(lc.origin, l.source_origin) AS origin,
  lc.campaign_id,
  lc.content_id,
  lc.need,
  lc.tool_id,
  lc.saved_result_ref
FROM private_line.lead l
JOIN private_line.customer c ON c.customer_id = l.customer_id
JOIN private_line.conversation conv ON conv.conversation_id = l.conversation_id
LEFT JOIN private_line.advisor_case ac ON ac.lead_id = l.lead_id
LEFT JOIN private_line.lead_context lc ON lc.lead_id = l.lead_id
LEFT JOIN LATERAL (
  SELECT m.message_type, m.status, m.needs_human
  FROM private_line.message m
  WHERE m.conversation_id = l.conversation_id
  ORDER BY m.received_at DESC, m.created_at DESC
  LIMIT 1
) latest ON true;

CREATE OR REPLACE VIEW private_line.lead_stage_history_safe AS
SELECT lead_stage_history_id, lead_id, from_stage, to_stage, created_at
FROM private_line.lead_stage_history;

CREATE OR REPLACE VIEW private_line.line_operations_safe AS
SELECT
  count(*) FILTER (WHERE status = 'queued')::integer AS queued_outbound,
  count(*) FILTER (WHERE status = 'leased')::integer AS leased_outbound,
  count(*) FILTER (WHERE status = 'reconciliation_required')::integer AS reconciliation_required,
  count(*) FILTER (WHERE status = 'failed')::integer AS failed_outbound,
  max(updated_at) AS latest_outbound_activity
FROM private_line.outbound_message;

CREATE OR REPLACE FUNCTION private_line.record_safe_web_journey_event(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $record_safe_web_journey_event$
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['anonymous_id_digest','journey','entrypoint','event_type','content_id','tool_id','saved_result_ref','campaign_id','attribution']::text[]) THEN
    RAISE EXCEPTION 'unsafe journey payload';
  END IF;
  IF NOT private_line.safe_id(payload->>'journey') OR NOT private_line.safe_id(COALESCE(payload->>'entrypoint','web')) THEN
    RAISE EXCEPTION 'invalid journey payload';
  END IF;
  INSERT INTO private_line.web_journey_event (
    anonymous_id_digest, journey, entrypoint, event_type, content_id, tool_id, saved_result_ref, campaign_id, attribution
  ) VALUES (
    NULLIF(payload->>'anonymous_id_digest',''), payload->>'journey', COALESCE(payload->>'entrypoint','web'),
    COALESCE(payload->>'event_type','line_continue'), NULLIF(payload->>'content_id',''), NULLIF(payload->>'tool_id',''),
    NULLIF(payload->>'saved_result_ref',''), NULLIF(payload->>'campaign_id',''), COALESCE(payload->'attribution','{}'::jsonb)
  );
  RETURN QUERY SELECT 'accepted'::text;
END
$record_safe_web_journey_event$;

CREATE OR REPLACE FUNCTION private_line.admin_read_line_transcript(p_lead_id uuid, p_limit integer DEFAULT 100)
RETURNS TABLE(
  item_id uuid,
  source_kind text,
  direction text,
  message_type text,
  status text,
  needs_human boolean,
  occurred_at timestamptz,
  unsent_at timestamptz,
  content_ciphertext_b64 text,
  content_nonce_b64 text,
  content_auth_tag_b64 text,
  content_key_version smallint,
  content_purpose text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_line_transcript$
  SELECT * FROM (
    SELECT m.message_id AS item_id, 'message'::text AS source_kind, m.direction, m.message_type, m.status,
           m.needs_human, m.received_at AS occurred_at, m.unsent_at,
           CASE WHEN m.status = 'unsent' THEN NULL ELSE m.content_ciphertext_b64 END,
           CASE WHEN m.status = 'unsent' THEN NULL ELSE m.content_nonce_b64 END,
           CASE WHEN m.status = 'unsent' THEN NULL ELSE m.content_auth_tag_b64 END,
           CASE WHEN m.status = 'unsent' THEN NULL ELSE m.content_key_version END,
           CASE WHEN m.status = 'unsent' THEN NULL ELSE 'message-content'::text END AS content_purpose
    FROM private_line.message m
    JOIN private_line.lead l ON l.conversation_id = m.conversation_id
    WHERE l.lead_id = p_lead_id
    UNION ALL
    SELECT om.outbound_id AS item_id, 'outbound'::text AS source_kind, 'outbound'::text AS direction, 'text'::text AS message_type,
           om.status, false AS needs_human, om.created_at AS occurred_at, NULL::timestamptz AS unsent_at,
           om.content_ciphertext_b64, om.content_nonce_b64, om.content_auth_tag_b64, om.content_key_version,
           'admin-outbound-message-content'::text AS content_purpose
    FROM private_line.outbound_message om
    WHERE om.lead_id = p_lead_id
  ) timeline
  ORDER BY occurred_at ASC, item_id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200)
$admin_read_line_transcript$;

CREATE OR REPLACE FUNCTION private_line.admin_enqueue_line_reply(payload jsonb)
RETURNS TABLE(outcome text, outbound_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_enqueue_line_reply$
DECLARE
  v_lead_id uuid;
  v_conversation_id uuid;
  v_case_id uuid;
  v_outbound_id uuid;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['lead_id','idempotency_digest','content_ciphertext_b64','content_nonce_b64','content_auth_tag_b64','content_key_version','created_by_digest']::text[]) THEN
    RAISE EXCEPTION 'unsafe admin reply payload';
  END IF;
  v_lead_id := (payload->>'lead_id')::uuid;
  SELECT l.conversation_id, ac.advisor_case_id INTO v_conversation_id, v_case_id
  FROM private_line.lead l LEFT JOIN private_line.advisor_case ac ON ac.lead_id = l.lead_id
  WHERE l.lead_id = v_lead_id;
  IF v_conversation_id IS NULL THEN RAISE EXCEPTION 'lead not found'; END IF;
  INSERT INTO private_line.outbound_message (
    lead_id, conversation_id, advisor_case_id, idempotency_digest,
    content_ciphertext_b64, content_nonce_b64, content_auth_tag_b64, content_key_version, created_by_digest
  ) VALUES (
    v_lead_id, v_conversation_id, v_case_id, payload->>'idempotency_digest',
    payload->>'content_ciphertext_b64', payload->>'content_nonce_b64', payload->>'content_auth_tag_b64',
    (payload->>'content_key_version')::smallint, payload->>'created_by_digest'
  ) ON CONFLICT (idempotency_digest) DO NOTHING
  RETURNING outbound_message.outbound_id INTO v_outbound_id;
  IF v_outbound_id IS NULL THEN
    SELECT om.outbound_id INTO v_outbound_id FROM private_line.outbound_message om WHERE om.idempotency_digest = payload->>'idempotency_digest';
    RETURN QUERY SELECT 'duplicate'::text, v_outbound_id;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'queued'::text, v_outbound_id;
END
$admin_enqueue_line_reply$;

CREATE OR REPLACE FUNCTION private_line.admin_claim_line_outbound(payload jsonb)
RETURNS TABLE(
  outbound_id uuid,
  lead_id uuid,
  attempt_number integer,
  recipient_ciphertext_b64 text,
  recipient_nonce_b64 text,
  recipient_auth_tag_b64 text,
  recipient_key_version smallint,
  content_ciphertext_b64 text,
  content_nonce_b64 text,
  content_auth_tag_b64 text,
  content_key_version smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_claim_line_outbound$
DECLARE
  v_worker text;
  v_outbound uuid;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['worker_digest','outbound_id']::text[]) THEN RAISE EXCEPTION 'unsafe claim payload'; END IF;
  v_worker := payload->>'worker_digest';
  IF v_worker IS NULL OR NOT private_line.safe_hex_digest(v_worker) THEN RAISE EXCEPTION 'invalid worker digest'; END IF;
  SELECT om.outbound_id INTO v_outbound
  FROM private_line.outbound_message om
  WHERE om.outbound_id = NULLIF(payload->>'outbound_id','')::uuid
    AND om.status IN ('queued','failed')
    AND COALESCE(om.send_after, now()) <= now()
    AND om.attempt_count < 3
  FOR UPDATE SKIP LOCKED;
  IF v_outbound IS NULL THEN RETURN; END IF;
  UPDATE private_line.outbound_message om
  SET status='leased', lease_owner_digest=v_worker, lease_expires_at=now()+interval '2 minutes',
      attempt_count=om.attempt_count+1, updated_at=now()
  WHERE om.outbound_id=v_outbound;
  RETURN QUERY
  SELECT om.outbound_id, om.lead_id, om.attempt_count,
         pi.external_ref_ciphertext_b64, pi.external_ref_nonce_b64, pi.external_ref_auth_tag_b64, pi.key_version,
         om.content_ciphertext_b64, om.content_nonce_b64, om.content_auth_tag_b64, om.content_key_version
  FROM private_line.outbound_message om
  JOIN private_line.conversation c ON c.conversation_id=om.conversation_id
  JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id
  WHERE om.outbound_id=v_outbound AND om.lease_owner_digest=v_worker;
END
$admin_claim_line_outbound$;

CREATE OR REPLACE FUNCTION private_line.admin_checkpoint_line_outbound(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_checkpoint_line_outbound$
DECLARE
  v_outbound uuid;
  v_worker text;
  v_result text;
  v_attempt integer;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['outbound_id','worker_digest','result','provider_message_digest','provider_status_code','error_class']::text[]) THEN RAISE EXCEPTION 'unsafe checkpoint payload'; END IF;
  v_outbound := (payload->>'outbound_id')::uuid;
  v_worker := payload->>'worker_digest';
  v_result := payload->>'result';
  IF v_result NOT IN ('sent','failed','reconciliation_required') OR v_worker IS NULL OR NOT private_line.safe_hex_digest(v_worker) THEN RAISE EXCEPTION 'invalid checkpoint'; END IF;
  SELECT attempt_count INTO v_attempt FROM private_line.outbound_message WHERE outbound_id=v_outbound AND status='leased' AND lease_owner_digest=v_worker AND lease_expires_at>now();
  IF v_attempt IS NULL THEN RAISE EXCEPTION 'lease mismatch'; END IF;
  UPDATE private_line.outbound_message
  SET status=v_result,
      provider_message_digest=NULLIF(payload->>'provider_message_digest',''),
      last_error_class=NULLIF(payload->>'error_class',''),
      lease_owner_digest=NULL, lease_expires_at=NULL, updated_at=now()
  WHERE outbound_id=v_outbound;
  INSERT INTO private_line.outbound_delivery_attempt(outbound_id, attempt_number, provider_status, provider_status_code, error_class)
  VALUES(v_outbound, v_attempt, v_result, NULLIF(payload->>'provider_status_code','')::integer, NULLIF(payload->>'error_class',''))
  ON CONFLICT(outbound_id, attempt_number) DO UPDATE SET provider_status=EXCLUDED.provider_status, provider_status_code=EXCLUDED.provider_status_code, error_class=EXCLUDED.error_class, attempted_at=now();
  RETURN QUERY SELECT v_result;
END
$admin_checkpoint_line_outbound$;

CREATE OR REPLACE FUNCTION private_line.admin_update_lead_stage(payload jsonb)
RETURNS TABLE(outcome text, lead_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_update_lead_stage$
DECLARE
  v_lead uuid;
  v_from text;
  v_to text;
  v_actor text;
  v_allowed boolean := false;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['lead_id','stage','actor_digest']::text[]) THEN RAISE EXCEPTION 'unsafe stage payload'; END IF;
  v_lead := (payload->>'lead_id')::uuid;
  v_to := payload->>'stage';
  v_actor := payload->>'actor_digest';
  IF v_actor IS NULL OR NOT private_line.safe_hex_digest(v_actor) THEN RAISE EXCEPTION 'invalid actor digest'; END IF;
  SELECT stage INTO v_from FROM private_line.lead WHERE private_line.lead.lead_id=v_lead FOR UPDATE;
  IF v_from IS NULL THEN RAISE EXCEPTION 'lead not found'; END IF;
  v_allowed := CASE v_from
    WHEN 'New' THEN v_to IN ('Qualified','Lost')
    WHEN 'Qualified' THEN v_to IN ('Expert Review','Lost')
    WHEN 'Expert Review' THEN v_to IN ('Solution','Quote','Lost')
    WHEN 'Solution' THEN v_to IN ('Quote','Implementation','Lost')
    WHEN 'Quote' THEN v_to IN ('Solution','Implementation','Lost')
    WHEN 'Implementation' THEN v_to IN ('Won','Lost')
    ELSE false
  END;
  IF NOT v_allowed THEN RAISE EXCEPTION 'invalid stage transition'; END IF;
  UPDATE private_line.lead SET stage=v_to, updated_at=now() WHERE private_line.lead.lead_id=v_lead;
  UPDATE private_line.advisor_case SET status=CASE WHEN v_to IN ('Won','Lost') THEN 'closed' ELSE 'open' END, updated_at=now() WHERE private_line.advisor_case.lead_id=v_lead;
  INSERT INTO private_line.lead_stage_history(lead_id,from_stage,to_stage,actor_digest) VALUES(v_lead,v_from,v_to,v_actor);
  RETURN QUERY SELECT 'updated'::text, v_lead;
END
$admin_update_lead_stage$;

REVOKE ALL ON TABLE private_line.advisor_inbox_safe FROM PUBLIC;
REVOKE ALL ON TABLE private_line.lead_stage_history_safe FROM PUBLIC;
REVOKE ALL ON TABLE private_line.line_operations_safe FROM PUBLIC;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA private_line FROM ccpun_line_ingress;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA private_line FROM ccpun_line_ingress;
GRANT USAGE ON SCHEMA private_line TO ccpun_line_ingress;
GRANT EXECUTE ON FUNCTION private_line.ingest_line_event(jsonb) TO ccpun_line_ingress;
GRANT EXECUTE ON FUNCTION private_line.record_safe_web_journey_event(jsonb) TO ccpun_line_ingress;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA private_line FROM ccpun_admin_runtime;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA private_line FROM ccpun_admin_runtime;
GRANT USAGE ON SCHEMA private_line TO ccpun_admin_runtime;
GRANT SELECT ON TABLE private_line.advisor_inbox_safe TO ccpun_admin_runtime;
GRANT SELECT ON TABLE private_line.lead_stage_history_safe TO ccpun_admin_runtime;
GRANT SELECT ON TABLE private_line.line_operations_safe TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_line_transcript(uuid, integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_enqueue_line_reply(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_claim_line_outbound(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_checkpoint_line_outbound(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_update_lead_stage(jsonb) TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO private_line.schema_migration(version,checksum) VALUES('20260918_line_private_conversation_v1_uat','sha256:d208639906275865acb686cb0d0039e14a9feb3dcd7a2156702f45b061c34344') ON CONFLICT(version) DO NOTHING;

COMMIT;

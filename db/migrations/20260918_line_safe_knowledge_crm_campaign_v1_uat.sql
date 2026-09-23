BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_private_inbox_reader_v1_uat' AND checksum='sha256:48d5ebc7084f38f6a4e9bdb5ff4f72b1a7ba9bfc42f8356f6fbfd59ee0607c1c') THEN RAISE EXCEPTION 'previous LINE migration missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.system_identity WHERE singleton=true AND project_id='young-term-47483330' AND branch_id='br-crimson-mouse-az7ajkv8' AND endpoint_id='ep-mute-frost-aztvz394' AND database_name='neondb' AND migration_version='20260917_private_line_runtime_v1_uat') THEN RAISE EXCEPTION 'base system identity changed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_safe_knowledge_crm_campaign_v1'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_safe_knowledge_crm_campaign_v1_uat';
  IF existing_checksum IS NOT NULL AND existing_checksum <> 'sha256:099a8968a8ec6fbb1fee589b410f3f071e762dd86ef3b1906b903fed5029e68d' THEN RAISE EXCEPTION 'migration checksum mismatch'; END IF;
END
$guard$;
-- checksum-source-begin
CREATE TABLE IF NOT EXISTS private_line.advisor_case_profile (
  lead_id uuid PRIMARY KEY REFERENCES private_line.lead(lead_id),
  case_state text NOT NULL DEFAULT 'active' CHECK (case_state IN ('active','waiting','completed')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_line.advisor_case_tag (
  lead_id uuid NOT NULL REFERENCES private_line.lead(lead_id),
  tag text NOT NULL CHECK (private_line.safe_id(tag)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, tag)
);

CREATE TABLE IF NOT EXISTS private_line.advisor_case_event (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES private_line.lead(lead_id),
  event_type text NOT NULL CHECK (event_type IN ('assignment','follow_up','priority','state','tag_added','tag_removed','note_added','document_status')),
  actor_digest text NOT NULL CHECK (private_line.safe_hex_digest(actor_digest)),
  safe_detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    private_line.safe_json_keys_only(safe_detail, ARRAY['assigned','priority','case_state','tag','follow_up_bucket','document_category','document_status']::text[])
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS private_line_advisor_case_event_lead_idx
  ON private_line.advisor_case_event (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS private_line.advisor_private_note (
  note_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES private_line.lead(lead_id),
  content_ciphertext_b64 text NOT NULL,
  content_nonce_b64 text NOT NULL,
  content_auth_tag_b64 text NOT NULL,
  content_key_version smallint NOT NULL CHECK (content_key_version > 0),
  actor_digest text NOT NULL CHECK (private_line.safe_hex_digest(actor_digest)),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS private_line_advisor_private_note_lead_idx
  ON private_line.advisor_private_note (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS private_line.line_campaign (
  campaign_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code text NOT NULL UNIQUE CHECK (private_line.safe_id(campaign_code)),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','active','paused','completed','cancelled')),
  journey text CHECK (journey IS NULL OR private_line.safe_id(journey)),
  content_id text CHECK (content_id IS NULL OR private_line.safe_id(content_id)),
  tool_id text CHECK (tool_id IS NULL OR private_line.safe_id(tool_id)),
  copy_text text NOT NULL CHECK (char_length(copy_text) BETWEEN 1 AND 2000),
  copy_version integer NOT NULL DEFAULT 1 CHECK (copy_version > 0),
  segment jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    private_line.safe_json_keys_only(segment, ARRAY['journey','stage','material_received','priority','case_state','origin','campaign_id','content_id','tool_id','tag','recency_bucket']::text[])
  ),
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  created_by_digest text NOT NULL CHECK (private_line.safe_hex_digest(created_by_digest)),
  approved_by_digest text CHECK (private_line.safe_hex_digest(approved_by_digest)),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (scheduled_end_at IS NULL OR scheduled_start_at IS NULL OR scheduled_end_at >= scheduled_start_at)
);

CREATE TABLE IF NOT EXISTS private_line.line_campaign_delivery (
  delivery_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES private_line.line_campaign(campaign_id),
  lead_id uuid NOT NULL REFERENCES private_line.lead(lead_id),
  conversation_id uuid NOT NULL REFERENCES private_line.conversation(conversation_id),
  idempotency_digest text NOT NULL UNIQUE CHECK (private_line.safe_hex_digest(idempotency_digest)),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','leased','sent','failed','reconciliation_required','cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_owner_digest text CHECK (private_line.safe_hex_digest(lease_owner_digest)),
  lease_expires_at timestamptz,
  provider_message_digest text CHECK (private_line.safe_hex_digest(provider_message_digest)),
  last_error_class text CHECK (last_error_class IS NULL OR private_line.safe_id(last_error_class)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS private_line_campaign_delivery_queue_idx
  ON private_line.line_campaign_delivery (status, created_at)
  WHERE status IN ('queued','failed');

CREATE TABLE IF NOT EXISTS private_line.line_campaign_delivery_attempt (
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES private_line.line_campaign_delivery(delivery_id),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  provider_status text NOT NULL CHECK (provider_status IN ('sent','failed','reconciliation_required')),
  provider_status_code integer,
  error_class text CHECK (error_class IS NULL OR private_line.safe_id(error_class)),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_id, attempt_number)
);

CREATE OR REPLACE VIEW private_line.advisor_document_safe AS
SELECT
  l.lead_id,
  d.document_id,
  d.document_category,
  d.status,
  d.mime_type,
  d.byte_size,
  d.created_at,
  d.updated_at
FROM private_line.document d
JOIN private_line.lead l ON l.conversation_id = d.conversation_id;

CREATE OR REPLACE VIEW private_line.line_campaign_safe AS
SELECT
  c.campaign_id,
  c.campaign_code,
  c.title,
  c.status,
  c.journey,
  c.content_id,
  c.tool_id,
  c.copy_text,
  c.copy_version,
  c.segment,
  c.scheduled_start_at,
  c.scheduled_end_at,
  c.approved_at,
  c.created_at,
  c.updated_at,
  count(d.delivery_id)::integer AS recipient_count,
  count(d.delivery_id) FILTER (WHERE d.status='queued')::integer AS queued_count,
  count(d.delivery_id) FILTER (WHERE d.status='sent')::integer AS sent_count,
  count(d.delivery_id) FILTER (WHERE d.status='failed')::integer AS failed_count,
  count(d.delivery_id) FILTER (WHERE d.status='reconciliation_required')::integer AS reconciliation_count
FROM private_line.line_campaign c
LEFT JOIN private_line.line_campaign_delivery d ON d.campaign_id=c.campaign_id
GROUP BY c.campaign_id;

CREATE OR REPLACE FUNCTION private_line.admin_read_advisor_inbox_filtered(payload jsonb, p_limit integer DEFAULT 100)
RETURNS TABLE(
  lead_id uuid,
  advisor_case_id uuid,
  customer_code text,
  stage text,
  journey text,
  material_received boolean,
  conversation_status text,
  unread_count integer,
  last_activity_at timestamptz,
  priority text,
  assigned_advisor text,
  follow_up_at timestamptz,
  case_state text,
  tags text[],
  latest_message_type text,
  latest_message_status text,
  latest_message_needs_human boolean,
  updated_at timestamptz,
  origin text,
  campaign_id text,
  content_id text,
  need text,
  tool_id text,
  saved_result_ref text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_advisor_inbox_filtered$
DECLARE
  v_stage text := NULLIF(payload->>'stage','');
  v_journey text := NULLIF(payload->>'journey','');
  v_priority text := NULLIF(payload->>'priority','');
  v_assigned text := NULLIF(payload->>'assigned_advisor','');
  v_case_state text := NULLIF(payload->>'case_state','');
  v_tag text := NULLIF(payload->>'tag','');
  v_q text := NULLIF(lower(trim(payload->>'q')),'');
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['stage','journey','priority','assigned_advisor','case_state','tag','q']::text[]) THEN
    RAISE EXCEPTION 'unsafe advisor filter';
  END IF;
  IF v_stage IS NOT NULL AND v_stage NOT IN ('New','Qualified','Expert Review','Solution','Quote','Implementation','Won','Lost') THEN RAISE EXCEPTION 'invalid stage'; END IF;
  IF v_priority IS NOT NULL AND v_priority NOT IN ('low','normal','high','urgent') THEN RAISE EXCEPTION 'invalid priority'; END IF;
  IF v_case_state IS NOT NULL AND v_case_state NOT IN ('active','waiting','completed') THEN RAISE EXCEPTION 'invalid case state'; END IF;
  IF v_journey IS NOT NULL AND NOT private_line.safe_id(v_journey) THEN RAISE EXCEPTION 'invalid journey'; END IF;
  IF v_tag IS NOT NULL AND NOT private_line.safe_id(v_tag) THEN RAISE EXCEPTION 'invalid tag'; END IF;
  IF v_q IS NOT NULL AND v_q !~ '^[a-z0-9_.:-]{1,80}$' THEN RAISE EXCEPTION 'invalid search'; END IF;

  RETURN QUERY
  SELECT
    l.lead_id, ac.advisor_case_id, c.customer_code, l.stage, l.journey, l.material_received,
    conv.status, conv.unread_count, conv.last_activity_at, ac.priority, ac.assigned_advisor, ac.follow_up_at,
    COALESCE(cp.case_state,'active'),
    COALESCE((SELECT array_agg(t.tag ORDER BY t.tag) FROM private_line.advisor_case_tag t WHERE t.lead_id=l.lead_id), ARRAY[]::text[]),
    latest.message_type, latest.status, latest.needs_human,
    GREATEST(l.updated_at, conv.updated_at, COALESCE(ac.updated_at,l.updated_at), COALESCE(lc.updated_at,l.updated_at), COALESCE(cp.updated_at,l.updated_at)),
    COALESCE(lc.origin,l.source_origin), lc.campaign_id, lc.content_id, lc.need, lc.tool_id, lc.saved_result_ref
  FROM private_line.lead l
  JOIN private_line.customer c ON c.customer_id=l.customer_id
  JOIN private_line.conversation conv ON conv.conversation_id=l.conversation_id
  LEFT JOIN private_line.advisor_case ac ON ac.lead_id=l.lead_id
  LEFT JOIN private_line.advisor_case_profile cp ON cp.lead_id=l.lead_id
  LEFT JOIN private_line.lead_context lc ON lc.lead_id=l.lead_id
  LEFT JOIN LATERAL (
    SELECT m.message_type,m.status,m.needs_human
    FROM private_line.message m
    WHERE m.conversation_id=l.conversation_id
    ORDER BY m.received_at DESC,m.created_at DESC LIMIT 1
  ) latest ON true
  WHERE (v_stage IS NULL OR l.stage=v_stage)
    AND (v_journey IS NULL OR l.journey=v_journey)
    AND (v_priority IS NULL OR ac.priority=v_priority)
    AND (v_assigned IS NULL OR lower(COALESCE(ac.assigned_advisor,''))=lower(v_assigned))
    AND (v_case_state IS NULL OR COALESCE(cp.case_state,'active')=v_case_state)
    AND (v_tag IS NULL OR EXISTS(SELECT 1 FROM private_line.advisor_case_tag t WHERE t.lead_id=l.lead_id AND t.tag=v_tag))
    AND (
      v_q IS NULL
      OR lower(COALESCE(lc.origin,''))=v_q
      OR lower(COALESCE(lc.campaign_id,''))=v_q
      OR lower(COALESCE(lc.content_id,''))=v_q
      OR lower(COALESCE(lc.tool_id,''))=v_q
      OR lower(COALESCE(l.journey,''))=v_q
    )
  ORDER BY COALESCE(conv.last_activity_at,l.updated_at) DESC,l.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),100);
END
$admin_read_advisor_inbox_filtered$;

CREATE OR REPLACE FUNCTION private_line.admin_update_case_operations(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_update_case_operations$
DECLARE
  v_lead uuid := (payload->>'lead_id')::uuid;
  v_actor text := payload->>'actor_digest';
  v_assigned text := NULLIF(payload->>'assigned_advisor','');
  v_priority text := NULLIF(payload->>'priority','');
  v_follow_up timestamptz := NULLIF(payload->>'follow_up_at','')::timestamptz;
  v_state text := NULLIF(payload->>'case_state','');
  v_tag_add text := NULLIF(payload->>'tag_add','');
  v_tag_remove text := NULLIF(payload->>'tag_remove','');
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['lead_id','actor_digest','assigned_advisor','priority','follow_up_at','case_state','tag_add','tag_remove']::text[]) THEN RAISE EXCEPTION 'unsafe case operation'; END IF;
  IF v_actor IS NULL OR NOT private_line.safe_hex_digest(v_actor) THEN RAISE EXCEPTION 'invalid actor'; END IF;
  IF NOT EXISTS(SELECT 1 FROM private_line.advisor_case WHERE lead_id=v_lead) THEN RAISE EXCEPTION 'case not found'; END IF;
  IF v_priority IS NOT NULL AND v_priority NOT IN ('low','normal','high','urgent') THEN RAISE EXCEPTION 'invalid priority'; END IF;
  IF v_state IS NOT NULL AND v_state NOT IN ('active','waiting','completed') THEN RAISE EXCEPTION 'invalid state'; END IF;
  IF v_tag_add IS NOT NULL AND NOT private_line.safe_id(v_tag_add) THEN RAISE EXCEPTION 'invalid tag'; END IF;
  IF v_tag_remove IS NOT NULL AND NOT private_line.safe_id(v_tag_remove) THEN RAISE EXCEPTION 'invalid tag'; END IF;

  IF payload ? 'assigned_advisor' THEN
    UPDATE private_line.advisor_case SET assigned_advisor=v_assigned,updated_at=now() WHERE lead_id=v_lead;
    INSERT INTO private_line.advisor_case_event(lead_id,event_type,actor_digest,safe_detail)
    VALUES(v_lead,'assignment',v_actor,jsonb_build_object('assigned',COALESCE(v_assigned,'unassigned')));
  END IF;
  IF v_priority IS NOT NULL THEN
    UPDATE private_line.advisor_case SET priority=v_priority,updated_at=now() WHERE lead_id=v_lead;
    INSERT INTO private_line.advisor_case_event(lead_id,event_type,actor_digest,safe_detail)
    VALUES(v_lead,'priority',v_actor,jsonb_build_object('priority',v_priority));
  END IF;
  IF payload ? 'follow_up_at' THEN
    UPDATE private_line.advisor_case SET follow_up_at=v_follow_up,updated_at=now() WHERE lead_id=v_lead;
    INSERT INTO private_line.advisor_case_event(lead_id,event_type,actor_digest,safe_detail)
    VALUES(v_lead,'follow_up',v_actor,jsonb_build_object('follow_up_bucket',CASE WHEN v_follow_up IS NULL THEN 'none' WHEN v_follow_up < now() THEN 'overdue' WHEN v_follow_up < now()+interval '1 day' THEN 'today' WHEN v_follow_up < now()+interval '7 day' THEN 'week' ELSE 'later' END));
  END IF;
  IF v_state IS NOT NULL THEN
    INSERT INTO private_line.advisor_case_profile(lead_id,case_state,updated_at) VALUES(v_lead,v_state,now())
    ON CONFLICT(lead_id) DO UPDATE SET case_state=EXCLUDED.case_state,updated_at=now();
    INSERT INTO private_line.advisor_case_event(lead_id,event_type,actor_digest,safe_detail)
    VALUES(v_lead,'state',v_actor,jsonb_build_object('case_state',v_state));
  END IF;
  IF v_tag_add IS NOT NULL THEN
    INSERT INTO private_line.advisor_case_tag(lead_id,tag) VALUES(v_lead,v_tag_add) ON CONFLICT DO NOTHING;
    INSERT INTO private_line.advisor_case_event(lead_id,event_type,actor_digest,safe_detail)
    VALUES(v_lead,'tag_added',v_actor,jsonb_build_object('tag',v_tag_add));
  END IF;
  IF v_tag_remove IS NOT NULL THEN
    DELETE FROM private_line.advisor_case_tag WHERE lead_id=v_lead AND tag=v_tag_remove;
    INSERT INTO private_line.advisor_case_event(lead_id,event_type,actor_digest,safe_detail)
    VALUES(v_lead,'tag_removed',v_actor,jsonb_build_object('tag',v_tag_remove));
  END IF;
  RETURN QUERY SELECT 'updated'::text;
END
$admin_update_case_operations$;

CREATE OR REPLACE FUNCTION private_line.admin_add_private_note(payload jsonb)
RETURNS TABLE(outcome text, note_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_add_private_note$
DECLARE
  v_lead uuid := (payload->>'lead_id')::uuid;
  v_actor text := payload->>'actor_digest';
  v_note uuid;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['lead_id','actor_digest','content_ciphertext_b64','content_nonce_b64','content_auth_tag_b64','content_key_version']::text[]) THEN RAISE EXCEPTION 'unsafe note payload'; END IF;
  IF v_actor IS NULL OR NOT private_line.safe_hex_digest(v_actor) THEN RAISE EXCEPTION 'invalid actor'; END IF;
  IF NOT EXISTS(SELECT 1 FROM private_line.lead WHERE lead_id=v_lead) THEN RAISE EXCEPTION 'lead not found'; END IF;
  INSERT INTO private_line.advisor_private_note(lead_id,content_ciphertext_b64,content_nonce_b64,content_auth_tag_b64,content_key_version,actor_digest)
  VALUES(v_lead,payload->>'content_ciphertext_b64',payload->>'content_nonce_b64',payload->>'content_auth_tag_b64',(payload->>'content_key_version')::smallint,v_actor)
  RETURNING advisor_private_note.note_id INTO v_note;
  INSERT INTO private_line.advisor_case_event(lead_id,event_type,actor_digest,safe_detail) VALUES(v_lead,'note_added',v_actor,'{}'::jsonb);
  RETURN QUERY SELECT 'created'::text,v_note;
END
$admin_add_private_note$;

CREATE OR REPLACE FUNCTION private_line.admin_read_private_notes(p_lead_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE(note_id uuid, content_ciphertext_b64 text, content_nonce_b64 text, content_auth_tag_b64 text, content_key_version smallint, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_private_notes$
  SELECT n.note_id,n.content_ciphertext_b64,n.content_nonce_b64,n.content_auth_tag_b64,n.content_key_version,n.created_at
  FROM private_line.advisor_private_note n
  WHERE n.lead_id=p_lead_id AND n.deleted_at IS NULL
  ORDER BY n.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),100)
$admin_read_private_notes$;

CREATE OR REPLACE FUNCTION private_line.admin_read_case_timeline(p_lead_id uuid, p_limit integer DEFAULT 100)
RETURNS TABLE(event_id uuid, event_type text, safe_detail jsonb, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_case_timeline$
  SELECT event_id,event_type,safe_detail,created_at
  FROM private_line.advisor_case_event
  WHERE lead_id=p_lead_id
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200)
$admin_read_case_timeline$;

CREATE OR REPLACE FUNCTION private_line.admin_upsert_line_campaign(payload jsonb)
RETURNS TABLE(outcome text,campaign_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_upsert_line_campaign$
DECLARE
  v_id uuid := NULLIF(payload->>'campaign_id','')::uuid;
  v_code text := payload->>'campaign_code';
  v_actor text := payload->>'actor_digest';
  v_result uuid;
  v_segment jsonb := COALESCE(payload->'segment','{}'::jsonb);
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['campaign_id','campaign_code','title','journey','content_id','tool_id','copy_text','segment','scheduled_start_at','scheduled_end_at','actor_digest']::text[]) THEN RAISE EXCEPTION 'unsafe campaign payload'; END IF;
  IF v_actor IS NULL OR NOT private_line.safe_hex_digest(v_actor) OR v_code IS NULL OR NOT private_line.safe_id(v_code) THEN RAISE EXCEPTION 'invalid campaign identity'; END IF;
  IF NOT private_line.safe_json_keys_only(v_segment, ARRAY['journey','stage','material_received','priority','case_state','origin','campaign_id','content_id','tool_id','tag','recency_bucket']::text[]) THEN RAISE EXCEPTION 'unsafe segment'; END IF;
  IF v_id IS NULL THEN
    INSERT INTO private_line.line_campaign(campaign_code,title,journey,content_id,tool_id,copy_text,segment,scheduled_start_at,scheduled_end_at,created_by_digest)
    VALUES(v_code,payload->>'title',NULLIF(payload->>'journey',''),NULLIF(payload->>'content_id',''),NULLIF(payload->>'tool_id',''),payload->>'copy_text',v_segment,NULLIF(payload->>'scheduled_start_at','')::timestamptz,NULLIF(payload->>'scheduled_end_at','')::timestamptz,v_actor)
    RETURNING line_campaign.campaign_id INTO v_result;
  ELSE
    UPDATE private_line.line_campaign SET
      title=payload->>'title',journey=NULLIF(payload->>'journey',''),content_id=NULLIF(payload->>'content_id',''),tool_id=NULLIF(payload->>'tool_id',''),
      copy_text=payload->>'copy_text',copy_version=copy_version+1,segment=v_segment,
      scheduled_start_at=NULLIF(payload->>'scheduled_start_at','')::timestamptz,scheduled_end_at=NULLIF(payload->>'scheduled_end_at','')::timestamptz,
      status='draft',approved_by_digest=NULL,approved_at=NULL,updated_at=now()
    WHERE line_campaign.campaign_id=v_id AND status IN ('draft','paused');
    IF NOT FOUND THEN RAISE EXCEPTION 'campaign not editable'; END IF;
    v_result:=v_id;
  END IF;
  RETURN QUERY SELECT 'saved'::text,v_result;
END
$admin_upsert_line_campaign$;

CREATE OR REPLACE FUNCTION private_line.admin_approve_line_campaign(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_approve_line_campaign$
DECLARE
  v_id uuid := (payload->>'campaign_id')::uuid;
  v_actor text := payload->>'actor_digest';
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['campaign_id','actor_digest']::text[]) OR v_actor IS NULL OR NOT private_line.safe_hex_digest(v_actor) THEN RAISE EXCEPTION 'unsafe approval'; END IF;
  UPDATE private_line.line_campaign SET status='approved',approved_by_digest=v_actor,approved_at=now(),updated_at=now()
  WHERE campaign_id=v_id AND status IN ('draft','paused');
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not approvable'; END IF;
  RETURN QUERY SELECT 'approved'::text;
END
$admin_approve_line_campaign$;

CREATE OR REPLACE FUNCTION private_line.admin_enqueue_line_campaign(payload jsonb)
RETURNS TABLE(outcome text,queued_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_enqueue_line_campaign$
DECLARE
  v_id uuid := (payload->>'campaign_id')::uuid;
  v_actor text := payload->>'actor_digest';
  v_segment jsonb;
  v_count integer;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['campaign_id','actor_digest']::text[]) OR v_actor IS NULL OR NOT private_line.safe_hex_digest(v_actor) THEN RAISE EXCEPTION 'unsafe enqueue'; END IF;
  SELECT segment INTO v_segment FROM private_line.line_campaign WHERE campaign_id=v_id AND status='approved' FOR UPDATE;
  IF v_segment IS NULL THEN RAISE EXCEPTION 'campaign not approved'; END IF;

  INSERT INTO private_line.line_campaign_delivery(campaign_id,lead_id,conversation_id,idempotency_digest)
  SELECT
    v_id,l.lead_id,l.conversation_id,
    md5(v_id::text||':'||l.lead_id::text)||md5('ccpun:'||v_id::text||':'||l.lead_id::text)
  FROM private_line.lead l
  LEFT JOIN private_line.advisor_case ac ON ac.lead_id=l.lead_id
  LEFT JOIN private_line.advisor_case_profile cp ON cp.lead_id=l.lead_id
  LEFT JOIN private_line.lead_context lc ON lc.lead_id=l.lead_id
  WHERE ((v_segment->>'journey') IS NULL OR l.journey=v_segment->>'journey')
    AND ((v_segment->>'stage') IS NULL OR l.stage=v_segment->>'stage')
    AND ((v_segment->>'material_received') IS NULL OR l.material_received=(v_segment->>'material_received')::boolean)
    AND ((v_segment->>'priority') IS NULL OR ac.priority=v_segment->>'priority')
    AND ((v_segment->>'case_state') IS NULL OR COALESCE(cp.case_state,'active')=v_segment->>'case_state')
    AND ((v_segment->>'origin') IS NULL OR COALESCE(lc.origin,l.source_origin)=v_segment->>'origin')
    AND ((v_segment->>'campaign_id') IS NULL OR lc.campaign_id=v_segment->>'campaign_id')
    AND ((v_segment->>'content_id') IS NULL OR lc.content_id=v_segment->>'content_id')
    AND ((v_segment->>'tool_id') IS NULL OR lc.tool_id=v_segment->>'tool_id')
    AND ((v_segment->>'tag') IS NULL OR EXISTS(SELECT 1 FROM private_line.advisor_case_tag t WHERE t.lead_id=l.lead_id AND t.tag=v_segment->>'tag'))
    AND (
      (v_segment->>'recency_bucket') IS NULL
      OR (v_segment->>'recency_bucket'='day' AND l.updated_at>=now()-interval '1 day')
      OR (v_segment->>'recency_bucket'='week' AND l.updated_at>=now()-interval '7 days')
      OR (v_segment->>'recency_bucket'='month' AND l.updated_at>=now()-interval '30 days')
    )
    AND l.stage NOT IN ('Lost')
  ON CONFLICT(campaign_id,lead_id) DO NOTHING;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  UPDATE private_line.line_campaign SET status='active',updated_at=now() WHERE campaign_id=v_id;
  RETURN QUERY SELECT 'queued'::text,v_count;
END
$admin_enqueue_line_campaign$;


CREATE OR REPLACE FUNCTION private_line.admin_claim_line_campaign_delivery(payload jsonb)
RETURNS TABLE(
  delivery_id uuid,
  campaign_id uuid,
  lead_id uuid,
  attempt_number integer,
  recipient_ciphertext_b64 text,
  recipient_nonce_b64 text,
  recipient_auth_tag_b64 text,
  recipient_key_version smallint,
  copy_text text,
  copy_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_claim_line_campaign_delivery$
DECLARE
  v_worker text := payload->>'worker_digest';
  v_delivery uuid := NULLIF(payload->>'delivery_id','')::uuid;
  v_claimed uuid;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['worker_digest','delivery_id']::text[]) THEN RAISE EXCEPTION 'unsafe campaign claim'; END IF;
  IF v_worker IS NULL OR NOT private_line.safe_hex_digest(v_worker) THEN RAISE EXCEPTION 'invalid worker'; END IF;

  SELECT d.delivery_id INTO v_claimed
  FROM private_line.line_campaign_delivery d
  JOIN private_line.line_campaign c ON c.campaign_id=d.campaign_id
  WHERE (v_delivery IS NULL OR d.delivery_id=v_delivery)
    AND d.status IN ('queued','failed')
    AND d.attempt_count < 3
    AND c.status='active'
    AND (c.scheduled_start_at IS NULL OR c.scheduled_start_at<=now())
    AND (c.scheduled_end_at IS NULL OR c.scheduled_end_at>=now())
  ORDER BY d.created_at ASC
  LIMIT 1
  FOR UPDATE OF d SKIP LOCKED;

  IF v_claimed IS NULL THEN RETURN; END IF;

  UPDATE private_line.line_campaign_delivery d
  SET status='leased',lease_owner_digest=v_worker,lease_expires_at=now()+interval '2 minutes',
      attempt_count=d.attempt_count+1,updated_at=now()
  WHERE d.delivery_id=v_claimed;

  RETURN QUERY
  SELECT d.delivery_id,d.campaign_id,d.lead_id,d.attempt_count,
         pi.external_ref_ciphertext_b64,pi.external_ref_nonce_b64,pi.external_ref_auth_tag_b64,pi.key_version,
         c.copy_text,c.copy_version
  FROM private_line.line_campaign_delivery d
  JOIN private_line.conversation conv ON conv.conversation_id=d.conversation_id
  JOIN private_line.provider_identity pi ON pi.identity_id=conv.identity_id
  JOIN private_line.line_campaign c ON c.campaign_id=d.campaign_id
  WHERE d.delivery_id=v_claimed AND d.lease_owner_digest=v_worker;
END
$admin_claim_line_campaign_delivery$;

CREATE OR REPLACE FUNCTION private_line.admin_checkpoint_line_campaign_delivery(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_checkpoint_line_campaign_delivery$
DECLARE
  v_delivery uuid := (payload->>'delivery_id')::uuid;
  v_worker text := payload->>'worker_digest';
  v_result text := payload->>'result';
  v_attempt integer;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['delivery_id','worker_digest','result','provider_message_digest','provider_status_code','error_class']::text[]) THEN RAISE EXCEPTION 'unsafe campaign checkpoint'; END IF;
  IF v_worker IS NULL OR NOT private_line.safe_hex_digest(v_worker) OR v_result NOT IN ('sent','failed','reconciliation_required') THEN RAISE EXCEPTION 'invalid campaign checkpoint'; END IF;

  SELECT attempt_count INTO v_attempt
  FROM private_line.line_campaign_delivery
  WHERE delivery_id=v_delivery AND status='leased' AND lease_owner_digest=v_worker AND lease_expires_at>now()
  FOR UPDATE;
  IF v_attempt IS NULL THEN RAISE EXCEPTION 'campaign lease mismatch'; END IF;

  UPDATE private_line.line_campaign_delivery
  SET status=v_result,
      provider_message_digest=NULLIF(payload->>'provider_message_digest',''),
      last_error_class=NULLIF(payload->>'error_class',''),
      lease_owner_digest=NULL,lease_expires_at=NULL,updated_at=now()
  WHERE delivery_id=v_delivery;

  INSERT INTO private_line.line_campaign_delivery_attempt(delivery_id,attempt_number,provider_status,provider_status_code,error_class)
  VALUES(v_delivery,v_attempt,v_result,NULLIF(payload->>'provider_status_code','')::integer,NULLIF(payload->>'error_class',''))
  ON CONFLICT(delivery_id,attempt_number) DO UPDATE SET
    provider_status=EXCLUDED.provider_status,
    provider_status_code=EXCLUDED.provider_status_code,
    error_class=EXCLUDED.error_class,
    attempted_at=now();

  RETURN QUERY SELECT v_result;
END
$admin_checkpoint_line_campaign_delivery$;

CREATE OR REPLACE FUNCTION private_line.admin_read_line_campaigns(p_limit integer DEFAULT 100)
RETURNS SETOF private_line.line_campaign_safe
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_line_campaigns$
  SELECT * FROM private_line.line_campaign_safe ORDER BY updated_at DESC LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),100)
$admin_read_line_campaigns$;

REVOKE ALL ON TABLE private_line.advisor_document_safe FROM PUBLIC;
REVOKE ALL ON TABLE private_line.advisor_document_safe FROM ccpun_line_ingress;
REVOKE ALL ON TABLE private_line.line_campaign_safe FROM PUBLIC;
REVOKE ALL ON TABLE private_line.line_campaign_safe FROM ccpun_line_ingress;

REVOKE ALL ON FUNCTION private_line.admin_read_advisor_inbox_filtered(jsonb,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_advisor_inbox_filtered(jsonb,integer) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_update_case_operations(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_update_case_operations(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_add_private_note(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_add_private_note(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_private_notes(uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_private_notes(uuid,integer) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_case_timeline(uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_case_timeline(uuid,integer) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_upsert_line_campaign(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_upsert_line_campaign(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_approve_line_campaign(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_approve_line_campaign(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_enqueue_line_campaign(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_enqueue_line_campaign(jsonb) FROM ccpun_line_ingress;

REVOKE ALL ON FUNCTION private_line.admin_claim_line_campaign_delivery(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_claim_line_campaign_delivery(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_checkpoint_line_campaign_delivery(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_checkpoint_line_campaign_delivery(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_line_campaigns(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_line_campaigns(integer) FROM ccpun_line_ingress;

REVOKE ALL PRIVILEGES ON TABLE
  private_line.advisor_case_profile,
  private_line.advisor_case_tag,
  private_line.advisor_case_event,
  private_line.advisor_private_note,
  private_line.line_campaign,
  private_line.line_campaign_delivery,
  private_line.line_campaign_delivery_attempt
FROM ccpun_admin_runtime;

GRANT SELECT ON TABLE private_line.advisor_document_safe TO ccpun_admin_runtime;
GRANT SELECT ON TABLE private_line.line_campaign_safe TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_advisor_inbox_filtered(jsonb,integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_update_case_operations(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_add_private_note(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_private_notes(uuid,integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_case_timeline(uuid,integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_upsert_line_campaign(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_approve_line_campaign(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_enqueue_line_campaign(jsonb) TO ccpun_admin_runtime;

GRANT EXECUTE ON FUNCTION private_line.admin_claim_line_campaign_delivery(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_checkpoint_line_campaign_delivery(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_line_campaigns(integer) TO ccpun_admin_runtime;
-- checksum-source-end

INSERT INTO private_line.schema_migration(version,checksum) VALUES('20260918_line_safe_knowledge_crm_campaign_v1_uat','sha256:099a8968a8ec6fbb1fee589b410f3f071e762dd86ef3b1906b903fed5029e68d') ON CONFLICT(version) DO NOTHING;
COMMIT;

BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_key_rotation_v2_production' AND checksum='sha256:3884446394a191afdfbde544f4b6e887fd996732d6705956ac7fc0efda7fc21d') THEN RAISE EXCEPTION 'previous LINE migration missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.system_identity WHERE singleton=true AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w' AND database_name='neondb' AND migration_version='20260917_private_line_runtime_v1_production') THEN RAISE EXCEPTION 'base system identity changed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_attribution_privacy_ops_v1'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_attribution_privacy_ops_v1_production';
  IF existing_checksum IS NOT NULL AND existing_checksum <> 'sha256:4d8552c0f3a44407733a7a396a36909e4cc87c657e8d0c39a8d5e818e7f5875b' THEN RAISE EXCEPTION 'attribution/privacy migration checksum mismatch'; END IF;
END
$guard$;
-- checksum-source-begin
CREATE TABLE IF NOT EXISTS private_line.business_event (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'view','cta','line_continue','material_received','lead_qualified','advisor_review',
    'solution_or_quote','implementation_started','implementation_complete','won','lost','revenue_attributed'
  )),
  lead_id uuid REFERENCES private_line.lead(lead_id),
  advisor_case_id uuid REFERENCES private_line.advisor_case(advisor_case_id),
  source_event_key text NOT NULL UNIQUE CHECK (source_event_key ~ '^[a-z0-9][a-z0-9_.:-]{0,159}$'),
  origin text CHECK (origin IS NULL OR private_line.safe_id(origin)),
  journey text CHECK (journey IS NULL OR private_line.safe_id(journey)),
  content_id text CHECK (content_id IS NULL OR private_line.safe_id(content_id)),
  campaign_id text CHECK (campaign_id IS NULL OR private_line.safe_id(campaign_id)),
  tool_id text CHECK (tool_id IS NULL OR private_line.safe_id(tool_id)),
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS private_line_business_event_lead_idx
  ON private_line.business_event (lead_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS private_line_business_event_type_idx
  ON private_line.business_event (event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS private_line.lead_attribution_link (
  lead_id uuid NOT NULL REFERENCES private_line.lead(lead_id),
  journey_event_id uuid NOT NULL REFERENCES private_line.web_journey_event(journey_event_id),
  actor_digest text NOT NULL CHECK (private_line.safe_hex_digest(actor_digest)),
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, journey_event_id),
  UNIQUE (journey_event_id)
);

CREATE TABLE IF NOT EXISTS private_line.lead_implementation (
  lead_id uuid PRIMARY KEY REFERENCES private_line.lead(lead_id),
  status text NOT NULL CHECK (status IN ('planned','in_progress','complete','cancelled')),
  partner_code text CHECK (partner_code IS NULL OR private_line.safe_id(partner_code)),
  started_at timestamptz,
  completed_at timestamptz,
  updated_by_digest text NOT NULL CHECK (private_line.safe_hex_digest(updated_by_digest)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE IF NOT EXISTS private_line.lead_revenue (
  revenue_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES private_line.lead(lead_id),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  idempotency_digest text NOT NULL UNIQUE CHECK (private_line.safe_hex_digest(idempotency_digest)),
  attributed_at timestamptz NOT NULL,
  created_by_digest text NOT NULL CHECK (private_line.safe_hex_digest(created_by_digest)),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS private_line_lead_revenue_lead_idx
  ON private_line.lead_revenue (lead_id, attributed_at DESC);

CREATE TABLE IF NOT EXISTS private_line.privacy_request (
  privacy_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES private_line.customer(customer_id),
  lead_id uuid REFERENCES private_line.lead(lead_id),
  request_type text NOT NULL CHECK (request_type IN ('export','delete')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','verified','prepared','approved','executed','cancelled','failed')),
  actor_digest text NOT NULL CHECK (private_line.safe_hex_digest(actor_digest)),
  verification_digest text CHECK (verification_digest IS NULL OR private_line.safe_hex_digest(verification_digest)),
  requested_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  prepared_at timestamptz,
  approved_at timestamptz,
  executed_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz,
  CHECK (customer_id IS NOT NULL OR lead_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS private_line_privacy_request_status_idx
  ON private_line.privacy_request (status, requested_at DESC);

CREATE TABLE IF NOT EXISTS private_line.retention_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  policy_mode text NOT NULL DEFAULT 'manual_review' CHECK (policy_mode='manual_review'),
  automatic_delete_enabled boolean NOT NULL DEFAULT false CHECK (automatic_delete_enabled=false),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO private_line.retention_policy(singleton,policy_mode,automatic_delete_enabled)
VALUES(true,'manual_review',false)
ON CONFLICT(singleton) DO UPDATE SET
  policy_mode='manual_review',
  automatic_delete_enabled=false,
  updated_at=now();

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
  v_history uuid;
  v_event_type text;
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
  INSERT INTO private_line.lead_stage_history(lead_id,from_stage,to_stage,actor_digest)
  VALUES(v_lead,v_from,v_to,v_actor)
  RETURNING lead_stage_history_id INTO v_history;

  v_event_type := CASE
    WHEN v_to='Qualified' THEN 'lead_qualified'
    WHEN v_to='Expert Review' THEN 'advisor_review'
    WHEN v_to IN ('Solution','Quote') THEN 'solution_or_quote'
    WHEN v_to='Won' THEN 'won'
    WHEN v_to='Lost' THEN 'lost'
    ELSE NULL
  END;

  IF v_event_type IS NOT NULL THEN
    INSERT INTO private_line.business_event(
      event_type,lead_id,advisor_case_id,source_event_key,origin,journey,content_id,campaign_id,tool_id,occurred_at
    )
    SELECT
      v_event_type,l.lead_id,ac.advisor_case_id,'stage:'||v_history::text,
      COALESCE(lc.origin,l.source_origin),l.journey,lc.content_id,lc.campaign_id,lc.tool_id,now()
    FROM private_line.lead l
    LEFT JOIN private_line.advisor_case ac ON ac.lead_id=l.lead_id
    LEFT JOIN private_line.lead_context lc ON lc.lead_id=l.lead_id
    WHERE l.lead_id=v_lead
    ON CONFLICT(source_event_key) DO NOTHING;
  END IF;

  RETURN QUERY SELECT 'updated'::text, v_lead;
END
$admin_update_lead_stage$;

CREATE OR REPLACE FUNCTION private_line.admin_bind_lead_attribution(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_bind_lead_attribution$
DECLARE
  v_lead uuid := NULLIF(payload->>'lead_id','')::uuid;
  v_journey_event uuid := NULLIF(payload->>'journey_event_id','')::uuid;
  v_actor text := payload->>'actor_digest';
  v_inserted integer := 0;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['lead_id','journey_event_id','actor_digest']::text[]) THEN
    RAISE EXCEPTION 'unsafe attribution payload';
  END IF;
  IF v_lead IS NULL OR v_journey_event IS NULL OR v_actor IS NULL OR NOT private_line.safe_hex_digest(v_actor) THEN
    RAISE EXCEPTION 'invalid attribution payload';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM private_line.lead WHERE lead_id=v_lead) THEN RAISE EXCEPTION 'lead not found'; END IF;
  IF NOT EXISTS(SELECT 1 FROM private_line.web_journey_event WHERE journey_event_id=v_journey_event) THEN RAISE EXCEPTION 'journey event not found'; END IF;

  INSERT INTO private_line.lead_attribution_link(lead_id,journey_event_id,actor_digest)
  VALUES(v_lead,v_journey_event,v_actor)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted=ROW_COUNT;

  IF v_inserted=1 THEN
    INSERT INTO private_line.business_event(
      event_type,lead_id,advisor_case_id,source_event_key,origin,journey,content_id,campaign_id,tool_id,occurred_at
    )
    SELECT
      CASE e.event_type WHEN 'content_cta' THEN 'cta' WHEN 'line_continue' THEN 'line_continue' ELSE NULL END,
      l.lead_id,ac.advisor_case_id,'journey:'||e.journey_event_id::text,
      COALESCE(e.attribution->>'traffic_source',lc.origin,l.source_origin),
      e.journey,e.content_id,e.campaign_id,e.tool_id,e.created_at
    FROM private_line.web_journey_event e
    JOIN private_line.lead l ON l.lead_id=v_lead
    LEFT JOIN private_line.advisor_case ac ON ac.lead_id=l.lead_id
    LEFT JOIN private_line.lead_context lc ON lc.lead_id=l.lead_id
    WHERE e.journey_event_id=v_journey_event
      AND e.event_type IN ('content_cta','line_continue')
    ON CONFLICT(source_event_key) DO NOTHING;

    INSERT INTO private_line.business_event(
      event_type,lead_id,advisor_case_id,source_event_key,origin,journey,content_id,campaign_id,tool_id,occurred_at
    )
    SELECT
      'material_received',l.lead_id,ac.advisor_case_id,'material:'||l.lead_id::text,
      COALESCE(lc.origin,l.source_origin),l.journey,lc.content_id,lc.campaign_id,lc.tool_id,l.updated_at
    FROM private_line.lead l
    LEFT JOIN private_line.advisor_case ac ON ac.lead_id=l.lead_id
    LEFT JOIN private_line.lead_context lc ON lc.lead_id=l.lead_id
    WHERE l.lead_id=v_lead AND l.material_received=true
    ON CONFLICT(source_event_key) DO NOTHING;
  END IF;

  RETURN QUERY SELECT CASE WHEN v_inserted=1 THEN 'linked'::text ELSE 'duplicate'::text END;
END
$admin_bind_lead_attribution$;

CREATE OR REPLACE FUNCTION private_line.admin_record_implementation(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_record_implementation$
DECLARE
  v_lead uuid := NULLIF(payload->>'lead_id','')::uuid;
  v_status text := payload->>'status';
  v_partner text := NULLIF(payload->>'partner_code','');
  v_actor text := payload->>'actor_digest';
  v_event_key text := payload->>'event_key';
  v_now timestamptz := now();
  v_event_type text;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['lead_id','status','partner_code','actor_digest','event_key']::text[]) THEN
    RAISE EXCEPTION 'unsafe implementation payload';
  END IF;
  IF v_lead IS NULL OR v_status NOT IN ('planned','in_progress','complete','cancelled')
     OR v_actor IS NULL OR NOT private_line.safe_hex_digest(v_actor)
     OR v_event_key IS NULL OR v_event_key !~ '^[a-z0-9][a-z0-9_.:-]{0,159}$'
     OR (v_partner IS NOT NULL AND NOT private_line.safe_id(v_partner)) THEN
    RAISE EXCEPTION 'invalid implementation payload';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM private_line.lead WHERE lead_id=v_lead) THEN RAISE EXCEPTION 'lead not found'; END IF;

  INSERT INTO private_line.lead_implementation(lead_id,status,partner_code,started_at,completed_at,updated_by_digest,updated_at)
  VALUES(
    v_lead,v_status,v_partner,
    CASE WHEN v_status IN ('in_progress','complete') THEN v_now ELSE NULL END,
    CASE WHEN v_status='complete' THEN v_now ELSE NULL END,
    v_actor,v_now
  )
  ON CONFLICT(lead_id) DO UPDATE SET
    status=EXCLUDED.status,
    partner_code=COALESCE(EXCLUDED.partner_code,private_line.lead_implementation.partner_code),
    started_at=COALESCE(private_line.lead_implementation.started_at,EXCLUDED.started_at),
    completed_at=CASE WHEN EXCLUDED.status='complete' THEN COALESCE(private_line.lead_implementation.completed_at,EXCLUDED.completed_at) ELSE private_line.lead_implementation.completed_at END,
    updated_by_digest=EXCLUDED.updated_by_digest,
    updated_at=v_now;

  v_event_type := CASE
    WHEN v_status='in_progress' THEN 'implementation_started'
    WHEN v_status='complete' THEN 'implementation_complete'
    ELSE NULL
  END;
  IF v_event_type IS NOT NULL THEN
    INSERT INTO private_line.business_event(event_type,lead_id,advisor_case_id,source_event_key,origin,journey,content_id,campaign_id,tool_id,occurred_at)
    SELECT
      v_event_type,l.lead_id,ac.advisor_case_id,v_event_key,COALESCE(lc.origin,l.source_origin),l.journey,
      lc.content_id,lc.campaign_id,lc.tool_id,v_now
    FROM private_line.lead l
    LEFT JOIN private_line.advisor_case ac ON ac.lead_id=l.lead_id
    LEFT JOIN private_line.lead_context lc ON lc.lead_id=l.lead_id
    WHERE l.lead_id=v_lead
    ON CONFLICT(source_event_key) DO NOTHING;
  END IF;

  RETURN QUERY SELECT 'recorded'::text;
END
$admin_record_implementation$;

CREATE OR REPLACE FUNCTION private_line.admin_attribute_revenue(payload jsonb)
RETURNS TABLE(outcome text,revenue_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_attribute_revenue$
DECLARE
  v_lead uuid := NULLIF(payload->>'lead_id','')::uuid;
  v_amount bigint := NULLIF(payload->>'amount_minor','')::bigint;
  v_currency text := payload->>'currency';
  v_idem text := payload->>'idempotency_digest';
  v_actor text := payload->>'actor_digest';
  v_revenue uuid;
  v_now timestamptz := now();
BEGIN
  IF NOT private_line.safe_json_keys_only(payload, ARRAY['lead_id','amount_minor','currency','idempotency_digest','actor_digest']::text[]) THEN
    RAISE EXCEPTION 'unsafe revenue payload';
  END IF;
  IF v_lead IS NULL OR v_amount IS NULL OR v_amount<0 OR v_currency !~ '^[A-Z]{3}$'
     OR v_idem IS NULL OR NOT private_line.safe_hex_digest(v_idem)
     OR v_actor IS NULL OR NOT private_line.safe_hex_digest(v_actor) THEN
    RAISE EXCEPTION 'invalid revenue payload';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM private_line.lead WHERE lead_id=v_lead) THEN RAISE EXCEPTION 'lead not found'; END IF;

  INSERT INTO private_line.lead_revenue(lead_id,amount_minor,currency,idempotency_digest,attributed_at,created_by_digest)
  VALUES(v_lead,v_amount,v_currency,v_idem,v_now,v_actor)
  ON CONFLICT(idempotency_digest) DO NOTHING
  RETURNING lead_revenue.revenue_id INTO v_revenue;

  IF v_revenue IS NULL THEN
    SELECT r.revenue_id INTO v_revenue FROM private_line.lead_revenue r WHERE r.idempotency_digest=v_idem;
    RETURN QUERY SELECT 'duplicate'::text,v_revenue;
    RETURN;
  END IF;

  INSERT INTO private_line.business_event(event_type,lead_id,advisor_case_id,source_event_key,origin,journey,content_id,campaign_id,tool_id,occurred_at)
  SELECT
    'revenue_attributed',l.lead_id,ac.advisor_case_id,'revenue:'||v_idem,COALESCE(lc.origin,l.source_origin),l.journey,
    lc.content_id,lc.campaign_id,lc.tool_id,v_now
  FROM private_line.lead l
  LEFT JOIN private_line.advisor_case ac ON ac.lead_id=l.lead_id
  LEFT JOIN private_line.lead_context lc ON lc.lead_id=l.lead_id
  WHERE l.lead_id=v_lead
  ON CONFLICT(source_event_key) DO NOTHING;

  RETURN QUERY SELECT 'recorded'::text,v_revenue;
END
$admin_attribute_revenue$;

CREATE OR REPLACE FUNCTION private_line.admin_read_conversion_summary()
RETURNS TABLE(
  line_continue_count bigint,
  lead_count bigint,
  material_received_count bigint,
  qualified_count bigint,
  solution_quote_count bigint,
  implementation_started_count bigint,
  implementation_complete_count bigint,
  won_count bigint,
  lost_count bigint,
  revenue_record_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_conversion_summary$
  SELECT
    (SELECT count(*) FROM private_line.web_journey_event WHERE event_type='line_continue'),
    (SELECT count(*) FROM private_line.lead),
    (SELECT count(*) FROM private_line.lead WHERE material_received=true),
    (SELECT count(*) FROM private_line.lead WHERE stage IN ('Qualified','Expert Review','Solution','Quote','Implementation','Won')),
    (SELECT count(*) FROM private_line.lead WHERE stage IN ('Solution','Quote','Implementation','Won')),
    (SELECT count(*) FROM private_line.lead_implementation WHERE status IN ('in_progress','complete')),
    (SELECT count(*) FROM private_line.lead_implementation WHERE status='complete'),
    (SELECT count(*) FROM private_line.lead WHERE stage='Won'),
    (SELECT count(*) FROM private_line.lead WHERE stage='Lost'),
    (SELECT count(*) FROM private_line.lead_revenue)
$admin_read_conversion_summary$;

CREATE OR REPLACE FUNCTION private_line.admin_read_revenue_by_currency()
RETURNS TABLE(currency text,revenue_minor numeric,revenue_record_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_revenue_by_currency$
  SELECT currency,sum(amount_minor)::numeric,count(*)::bigint
  FROM private_line.lead_revenue
  GROUP BY currency
  ORDER BY currency
$admin_read_revenue_by_currency$;

CREATE OR REPLACE FUNCTION private_line.admin_read_content_intelligence(p_limit integer DEFAULT 100)
RETURNS TABLE(
  origin text,
  journey text,
  content_id text,
  campaign_id text,
  tool_id text,
  lead_count bigint,
  material_received_count bigint,
  qualified_count bigint,
  implementation_complete_count bigint,
  won_count bigint,
  revenue_record_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_content_intelligence$
  SELECT
    COALESCE(lc.origin,l.source_origin,'unknown') AS origin,
    l.journey,
    lc.content_id,
    lc.campaign_id,
    lc.tool_id,
    count(DISTINCT l.lead_id)::bigint,
    count(DISTINCT l.lead_id) FILTER (WHERE l.material_received)::bigint,
    count(DISTINCT l.lead_id) FILTER (WHERE l.stage IN ('Qualified','Expert Review','Solution','Quote','Implementation','Won'))::bigint,
    count(DISTINCT l.lead_id) FILTER (WHERE li.status='complete')::bigint,
    count(DISTINCT l.lead_id) FILTER (WHERE l.stage='Won')::bigint,
    count(DISTINCT r.revenue_id)::bigint
  FROM private_line.lead l
  LEFT JOIN private_line.lead_context lc ON lc.lead_id=l.lead_id
  LEFT JOIN private_line.lead_implementation li ON li.lead_id=l.lead_id
  LEFT JOIN private_line.lead_revenue r ON r.lead_id=l.lead_id
  GROUP BY COALESCE(lc.origin,l.source_origin,'unknown'),l.journey,lc.content_id,lc.campaign_id,lc.tool_id
  ORDER BY count(DISTINCT l.lead_id) DESC,COALESCE(lc.origin,l.source_origin,'unknown'),l.journey
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200)
$admin_read_content_intelligence$;

CREATE OR REPLACE FUNCTION private_line.admin_create_privacy_request(payload jsonb)
RETURNS TABLE(outcome text,privacy_request_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_create_privacy_request$
DECLARE
  v_customer uuid := NULLIF(payload->>'customer_id','')::uuid;
  v_lead uuid := NULLIF(payload->>'lead_id','')::uuid;
  v_type text := payload->>'request_type';
  v_actor text := payload->>'actor_digest';
  v_id uuid;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload,ARRAY['customer_id','lead_id','request_type','actor_digest']::text[]) THEN
    RAISE EXCEPTION 'unsafe privacy request';
  END IF;
  IF (v_customer IS NULL AND v_lead IS NULL) OR v_type NOT IN ('export','delete')
     OR v_actor IS NULL OR NOT private_line.safe_hex_digest(v_actor) THEN
    RAISE EXCEPTION 'invalid privacy request';
  END IF;
  IF v_customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM private_line.customer WHERE customer_id=v_customer) THEN RAISE EXCEPTION 'customer not found'; END IF;
  IF v_lead IS NOT NULL AND NOT EXISTS(SELECT 1 FROM private_line.lead WHERE lead_id=v_lead) THEN RAISE EXCEPTION 'lead not found'; END IF;

  INSERT INTO private_line.privacy_request(customer_id,lead_id,request_type,actor_digest)
  VALUES(v_customer,v_lead,v_type,v_actor)
  RETURNING private_line.privacy_request.privacy_request_id INTO v_id;
  RETURN QUERY SELECT 'requested'::text,v_id;
END
$admin_create_privacy_request$;

CREATE OR REPLACE FUNCTION private_line.admin_transition_privacy_request(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_transition_privacy_request$
DECLARE
  v_id uuid := NULLIF(payload->>'privacy_request_id','')::uuid;
  v_to text := payload->>'status';
  v_actor text := payload->>'actor_digest';
  v_verify text := NULLIF(payload->>'verification_digest','');
  v_from text;
  v_type text;
  v_allowed boolean := false;
BEGIN
  IF NOT private_line.safe_json_keys_only(payload,ARRAY['privacy_request_id','status','actor_digest','verification_digest']::text[]) THEN
    RAISE EXCEPTION 'unsafe privacy transition';
  END IF;
  IF v_id IS NULL OR v_to NOT IN ('verified','prepared','approved','executed','cancelled','failed')
     OR v_actor IS NULL OR NOT private_line.safe_hex_digest(v_actor)
     OR (v_verify IS NOT NULL AND NOT private_line.safe_hex_digest(v_verify)) THEN
    RAISE EXCEPTION 'invalid privacy transition';
  END IF;

  SELECT status,request_type INTO v_from,v_type FROM private_line.privacy_request WHERE privacy_request_id=v_id FOR UPDATE;
  IF v_from IS NULL THEN RAISE EXCEPTION 'privacy request not found'; END IF;
  IF v_type='delete' AND v_to='executed' THEN RAISE EXCEPTION 'delete execution requires separate irreversible human gate'; END IF;

  v_allowed := CASE v_from
    WHEN 'requested' THEN v_to IN ('verified','cancelled','failed')
    WHEN 'verified' THEN v_to IN ('prepared','cancelled','failed')
    WHEN 'prepared' THEN v_to IN ('approved','cancelled','failed')
    WHEN 'approved' THEN v_to IN ('executed','cancelled','failed')
    ELSE false
  END;
  IF NOT v_allowed THEN RAISE EXCEPTION 'invalid privacy transition'; END IF;

  UPDATE private_line.privacy_request
  SET status=v_to,
      verification_digest=CASE WHEN v_to='verified' THEN v_verify ELSE verification_digest END,
      verified_at=CASE WHEN v_to='verified' THEN now() ELSE verified_at END,
      prepared_at=CASE WHEN v_to='prepared' THEN now() ELSE prepared_at END,
      approved_at=CASE WHEN v_to='approved' THEN now() ELSE approved_at END,
      executed_at=CASE WHEN v_to='executed' THEN now() ELSE executed_at END,
      cancelled_at=CASE WHEN v_to='cancelled' THEN now() ELSE cancelled_at END,
      failed_at=CASE WHEN v_to='failed' THEN now() ELSE failed_at END
  WHERE privacy_request_id=v_id;

  RETURN QUERY SELECT v_to;
END
$admin_transition_privacy_request$;

CREATE OR REPLACE FUNCTION private_line.admin_prepare_privacy_request(p_request_id uuid)
RETURNS TABLE(
  request_type text,
  status text,
  conversation_count bigint,
  message_count bigint,
  document_count bigint,
  lead_count bigint,
  advisor_case_count bigint,
  business_event_count bigint,
  implementation_count bigint,
  revenue_record_count bigint,
  destructive_execution_available boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_prepare_privacy_request$
DECLARE
  v_customer uuid;
  v_lead uuid;
  v_type text;
  v_status text;
BEGIN
  SELECT customer_id,lead_id,request_type,status INTO v_customer,v_lead,v_type,v_status
  FROM private_line.privacy_request WHERE privacy_request_id=p_request_id;
  IF v_type IS NULL THEN RAISE EXCEPTION 'privacy request not found'; END IF;
  IF v_status NOT IN ('verified','prepared','approved') THEN RAISE EXCEPTION 'privacy request not verified'; END IF;
  IF v_status='verified' THEN
    UPDATE private_line.privacy_request SET status='prepared',prepared_at=COALESCE(prepared_at,now()) WHERE privacy_request_id=p_request_id;
    v_status := 'prepared';
  END IF;

  RETURN QUERY
  WITH scoped_leads AS (
    SELECT l.lead_id,l.conversation_id,l.customer_id
    FROM private_line.lead l
    WHERE (v_lead IS NOT NULL AND l.lead_id=v_lead)
       OR (v_lead IS NULL AND v_customer IS NOT NULL AND l.customer_id=v_customer)
  ),
  scoped_conversations AS (
    SELECT DISTINCT conversation_id FROM scoped_leads WHERE conversation_id IS NOT NULL
  )
  SELECT
    v_type,
    v_status,
    (SELECT count(*) FROM scoped_conversations),
    (SELECT count(*) FROM private_line.message m WHERE m.conversation_id IN (SELECT conversation_id FROM scoped_conversations)),
    (SELECT count(*) FROM private_line.document d WHERE d.conversation_id IN (SELECT conversation_id FROM scoped_conversations)),
    (SELECT count(*) FROM scoped_leads),
    (SELECT count(*) FROM private_line.advisor_case ac WHERE ac.lead_id IN (SELECT lead_id FROM scoped_leads)),
    (SELECT count(*) FROM private_line.business_event e WHERE e.lead_id IN (SELECT lead_id FROM scoped_leads)),
    (SELECT count(*) FROM private_line.lead_implementation li WHERE li.lead_id IN (SELECT lead_id FROM scoped_leads)),
    (SELECT count(*) FROM private_line.lead_revenue r WHERE r.lead_id IN (SELECT lead_id FROM scoped_leads)),
    false;
END
$admin_prepare_privacy_request$;

CREATE OR REPLACE FUNCTION private_line.admin_read_privacy_requests(p_limit integer DEFAULT 100)
RETURNS TABLE(
  privacy_request_id uuid,
  request_type text,
  status text,
  requested_at timestamptz,
  verified_at timestamptz,
  prepared_at timestamptz,
  approved_at timestamptz,
  executed_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_privacy_requests$
  SELECT privacy_request_id,request_type,status,requested_at,verified_at,prepared_at,approved_at,executed_at,cancelled_at,failed_at
  FROM private_line.privacy_request
  ORDER BY requested_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200)
$admin_read_privacy_requests$;

CREATE OR REPLACE FUNCTION private_line.admin_read_line_ops_health()
RETURNS TABLE(
  outbound_queued bigint,
  outbound_failed bigint,
  outbound_reconciliation bigint,
  campaign_queued bigint,
  campaign_reconciliation bigint,
  privacy_pending bigint,
  business_event_count bigint,
  latest_business_event_at timestamptz,
  retention_mode text,
  automatic_delete_enabled boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_line_ops_health$
  SELECT
    (SELECT count(*) FROM private_line.outbound_message WHERE status='queued'),
    (SELECT count(*) FROM private_line.outbound_message WHERE status='failed'),
    (SELECT count(*) FROM private_line.outbound_message WHERE status='reconciliation_required'),
    (SELECT count(*) FROM private_line.line_campaign_delivery WHERE status='queued'),
    (SELECT count(*) FROM private_line.line_campaign_delivery WHERE status='reconciliation_required'),
    (SELECT count(*) FROM private_line.privacy_request WHERE status IN ('requested','verified','prepared','approved')),
    (SELECT count(*) FROM private_line.business_event),
    (SELECT max(occurred_at) FROM private_line.business_event),
    (SELECT policy_mode FROM private_line.retention_policy WHERE singleton=true),
    (SELECT automatic_delete_enabled FROM private_line.retention_policy WHERE singleton=true)
$admin_read_line_ops_health$;

REVOKE ALL PRIVILEGES ON TABLE
  private_line.business_event,
  private_line.lead_attribution_link,
  private_line.lead_implementation,
  private_line.lead_revenue,
  private_line.privacy_request,
  private_line.retention_policy
FROM ccpun_admin_runtime;
REVOKE ALL PRIVILEGES ON TABLE
  private_line.business_event,
  private_line.lead_attribution_link,
  private_line.lead_implementation,
  private_line.lead_revenue,
  private_line.privacy_request,
  private_line.retention_policy
FROM ccpun_line_ingress;

REVOKE ALL ON FUNCTION private_line.admin_update_lead_stage(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_update_lead_stage(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_bind_lead_attribution(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_bind_lead_attribution(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_record_implementation(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_record_implementation(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_attribute_revenue(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_attribute_revenue(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_conversion_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_conversion_summary() FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_revenue_by_currency() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_revenue_by_currency() FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_content_intelligence(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_content_intelligence(integer) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_create_privacy_request(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_create_privacy_request(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_transition_privacy_request(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_transition_privacy_request(jsonb) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_prepare_privacy_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_prepare_privacy_request(uuid) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_privacy_requests(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_privacy_requests(integer) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_line_ops_health() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_line_ops_health() FROM ccpun_line_ingress;

GRANT EXECUTE ON FUNCTION private_line.admin_update_lead_stage(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_bind_lead_attribution(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_record_implementation(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_attribute_revenue(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_conversion_summary() TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_revenue_by_currency() TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_content_intelligence(integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_create_privacy_request(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_transition_privacy_request(jsonb) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_prepare_privacy_request(uuid) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_privacy_requests(integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_line_ops_health() TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum) VALUES('20260918_line_attribution_privacy_ops_v1_production','sha256:4d8552c0f3a44407733a7a396a36909e4cc87c657e8d0c39a8d5e818e7f5875b') ON CONFLICT(version) DO NOTHING;
COMMIT;

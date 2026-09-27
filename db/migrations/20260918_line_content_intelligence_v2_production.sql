BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.schema_migration WHERE version='20260918_line_delivery_activation_v1_production' AND checksum='sha256:0ae7539cbc55299979f1821984875181e66259efec4ddc16cc3e549a056eabfa') THEN RAISE EXCEPTION 'delivery activation missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_line.system_identity WHERE singleton=true AND project_id='lively-bar-43618798' AND branch_id='br-long-resonance-b3ys5xrv' AND endpoint_id='ep-broad-butterfly-b3ro7u8w' AND database_name='neondb' AND migration_version='20260917_private_line_runtime_v1_production') THEN RAISE EXCEPTION 'base system identity changed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_content_intelligence_v2'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_content_intelligence_v2_production';
  IF existing_checksum IS NOT NULL AND existing_checksum <> 'sha256:084d1063b0d0fbc1c48762ea8de88994210f7d063f244874c2b17c5ff55147af' THEN RAISE EXCEPTION 'content intelligence checksum mismatch'; END IF;
END
$guard$;
-- checksum-source-begin
CREATE TABLE IF NOT EXISTS private_line.safe_knowledge_event (
  safe_knowledge_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id text NOT NULL CHECK (private_line.safe_id(question_id)),
  journey text NOT NULL REFERENCES private_line.journey_definition(journey),
  stage text NOT NULL CHECK (private_line.safe_id(stage)),
  outcome text NOT NULL CHECK (outcome IN ('approved_answer','related_content','human_handoff')),
  reason text CHECK (reason IS NULL OR reason IN ('human_requested','personalized','no_approved_answer','source_unavailable')),
  request_content_id text CHECK (request_content_id IS NULL OR private_line.safe_id(request_content_id)),
  source_slug text CHECK (source_slug IS NULL OR private_line.safe_id(source_slug)),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (outcome='human_handoff' AND reason IS NOT NULL)
    OR (outcome<>'human_handoff' AND reason IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS private_line_safe_knowledge_event_rollup_idx
  ON private_line.safe_knowledge_event (question_id, journey, outcome, occurred_at DESC);

CREATE OR REPLACE FUNCTION private_line.ingress_record_safe_knowledge_event(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $ingress_record_safe_knowledge_event$
DECLARE
  v_question text := payload->>'question_id';
  v_journey text := payload->>'journey';
  v_stage text := payload->>'stage';
  v_outcome text := payload->>'outcome';
  v_reason text := NULLIF(payload->>'reason','');
  v_request_content text := NULLIF(payload->>'request_content_id','');
  v_source_slug text := NULLIF(payload->>'source_slug','');
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR NOT private_line.safe_json_keys_only(
      payload,
      ARRAY['question_id','journey','stage','outcome','reason','request_content_id','source_slug']::text[]
    )
  THEN
    RAISE EXCEPTION 'unsafe Safe Knowledge event';
  END IF;

  IF v_question IS NULL OR NOT private_line.safe_id(v_question)
    OR v_journey IS NULL OR NOT private_line.safe_id(v_journey)
    OR v_stage IS NULL OR NOT private_line.safe_id(v_stage)
    OR v_outcome IS NULL
    OR v_outcome NOT IN ('approved_answer','related_content','human_handoff')
    OR (v_reason IS NOT NULL AND v_reason NOT IN ('human_requested','personalized','no_approved_answer','source_unavailable'))
    OR (v_request_content IS NOT NULL AND NOT private_line.safe_id(v_request_content))
    OR (v_source_slug IS NOT NULL AND NOT private_line.safe_id(v_source_slug))
    OR (v_outcome='human_handoff' AND v_reason IS NULL)
    OR (v_outcome<>'human_handoff' AND v_reason IS NOT NULL)
  THEN
    RAISE EXCEPTION 'invalid Safe Knowledge event';
  END IF;

  INSERT INTO private_line.safe_knowledge_event(
    question_id,journey,stage,outcome,reason,request_content_id,source_slug
  )
  VALUES(
    v_question,v_journey,v_stage,v_outcome,v_reason,v_request_content,v_source_slug
  );

  RETURN QUERY SELECT 'recorded'::text;
END
$ingress_record_safe_knowledge_event$;

CREATE OR REPLACE FUNCTION private_line.admin_read_content_intelligence_v2(p_limit integer DEFAULT 100)
RETURNS TABLE(
  origin text,
  journey text,
  content_id text,
  campaign_id text,
  tool_id text,
  journey_start_count bigint,
  lead_count bigint,
  material_received_count bigint,
  qualified_count bigint,
  qualification_rate numeric,
  implementation_complete_count bigint,
  won_count bigint,
  lost_count bigint,
  revenue_record_count bigint,
  drop_off_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_content_intelligence_v2$
  WITH starts AS (
    SELECT
      COALESCE(NULLIF(e.attribution->>'traffic_source',''),'web') AS origin,
      e.journey,
      e.content_id,
      e.campaign_id,
      e.tool_id,
      count(*)::bigint AS journey_start_count
    FROM private_line.web_journey_event e
    WHERE e.event_type='line_continue'
    GROUP BY COALESCE(NULLIF(e.attribution->>'traffic_source',''),'web'),
             e.journey,e.content_id,e.campaign_id,e.tool_id
  ),
  leads AS (
    SELECT
      COALESCE(lc.origin,l.source_origin,'unknown') AS origin,
      l.journey,
      lc.content_id,
      lc.campaign_id,
      lc.tool_id,
      count(DISTINCT l.lead_id)::bigint AS lead_count,
      count(DISTINCT l.lead_id) FILTER (WHERE l.material_received)::bigint AS material_received_count,
      count(DISTINCT l.lead_id) FILTER (
        WHERE l.stage IN ('Qualified','Expert Review','Solution','Quote','Implementation','Won')
      )::bigint AS qualified_count,
      count(DISTINCT l.lead_id) FILTER (WHERE li.status='complete')::bigint AS implementation_complete_count,
      count(DISTINCT l.lead_id) FILTER (WHERE l.stage='Won')::bigint AS won_count,
      count(DISTINCT l.lead_id) FILTER (WHERE l.stage='Lost')::bigint AS lost_count,
      count(DISTINCT r.revenue_id)::bigint AS revenue_record_count
    FROM private_line.lead l
    LEFT JOIN private_line.lead_context lc ON lc.lead_id=l.lead_id
    LEFT JOIN private_line.lead_implementation li ON li.lead_id=l.lead_id
    LEFT JOIN private_line.lead_revenue r ON r.lead_id=l.lead_id
    GROUP BY COALESCE(lc.origin,l.source_origin,'unknown'),l.journey,lc.content_id,lc.campaign_id,lc.tool_id
  ),
  combined AS (
    SELECT
      COALESCE(s.origin,l.origin) AS origin,
      COALESCE(s.journey,l.journey) AS journey,
      COALESCE(s.content_id,l.content_id) AS content_id,
      COALESCE(s.campaign_id,l.campaign_id) AS campaign_id,
      COALESCE(s.tool_id,l.tool_id) AS tool_id,
      COALESCE(s.journey_start_count,0)::bigint AS journey_start_count,
      COALESCE(l.lead_count,0)::bigint AS lead_count,
      COALESCE(l.material_received_count,0)::bigint AS material_received_count,
      COALESCE(l.qualified_count,0)::bigint AS qualified_count,
      COALESCE(l.implementation_complete_count,0)::bigint AS implementation_complete_count,
      COALESCE(l.won_count,0)::bigint AS won_count,
      COALESCE(l.lost_count,0)::bigint AS lost_count,
      COALESCE(l.revenue_record_count,0)::bigint AS revenue_record_count
    FROM starts s
    FULL OUTER JOIN leads l
      ON s.origin=l.origin
      AND s.journey=l.journey
      AND s.content_id IS NOT DISTINCT FROM l.content_id
      AND s.campaign_id IS NOT DISTINCT FROM l.campaign_id
      AND s.tool_id IS NOT DISTINCT FROM l.tool_id
  )
  SELECT
    c.origin,c.journey,c.content_id,c.campaign_id,c.tool_id,
    c.journey_start_count,c.lead_count,c.material_received_count,c.qualified_count,
    CASE
      WHEN GREATEST(c.journey_start_count,c.lead_count)=0 THEN NULL
      ELSE round(c.qualified_count::numeric / GREATEST(c.journey_start_count,c.lead_count)::numeric,4)
    END AS qualification_rate,
    c.implementation_complete_count,c.won_count,c.lost_count,c.revenue_record_count,
    GREATEST(c.journey_start_count-c.qualified_count,0)::bigint AS drop_off_count
  FROM combined c
  ORDER BY c.journey_start_count DESC,c.lead_count DESC,c.origin,c.journey
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200)
$admin_read_content_intelligence_v2$;

CREATE OR REPLACE FUNCTION private_line.admin_read_content_revenue_by_currency(p_limit integer DEFAULT 200)
RETURNS TABLE(
  origin text,
  journey text,
  content_id text,
  campaign_id text,
  tool_id text,
  currency text,
  revenue_minor numeric,
  revenue_record_count bigint,
  revenue_suppressed boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_content_revenue_by_currency$
  SELECT
    COALESCE(lc.origin,l.source_origin,'unknown') AS origin,
    l.journey,
    lc.content_id,
    lc.campaign_id,
    lc.tool_id,
    r.currency,
    CASE WHEN count(DISTINCT r.revenue_id)>=3 THEN sum(r.amount_minor)::numeric ELSE NULL::numeric END AS revenue_minor,
    count(DISTINCT r.revenue_id)::bigint AS revenue_record_count,
    (count(DISTINCT r.revenue_id)<3) AS revenue_suppressed
  FROM private_line.lead_revenue r
  JOIN private_line.lead l ON l.lead_id=r.lead_id
  LEFT JOIN private_line.lead_context lc ON lc.lead_id=l.lead_id
  GROUP BY COALESCE(lc.origin,l.source_origin,'unknown'),l.journey,lc.content_id,lc.campaign_id,lc.tool_id,r.currency
  ORDER BY count(DISTINCT r.revenue_id) DESC,COALESCE(lc.origin,l.source_origin,'unknown'),l.journey,r.currency
  LIMIT LEAST(GREATEST(COALESCE(p_limit,200),1),500)
$admin_read_content_revenue_by_currency$;

CREATE OR REPLACE FUNCTION private_line.admin_read_safe_question_frequency(p_limit integer DEFAULT 100)
RETURNS TABLE(
  question_id text,
  journey text,
  outcome text,
  reason text,
  request_count bigint,
  last_seen_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_safe_question_frequency$
  SELECT
    e.question_id,e.journey,e.outcome,e.reason,count(*)::bigint,max(e.occurred_at)
  FROM private_line.safe_knowledge_event e
  GROUP BY e.question_id,e.journey,e.outcome,e.reason
  ORDER BY count(*) DESC,e.question_id,e.journey,e.outcome,e.reason NULLS FIRST
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200)
$admin_read_safe_question_frequency$;

CREATE OR REPLACE FUNCTION private_line.admin_read_content_gap_inputs(p_limit integer DEFAULT 100)
RETURNS TABLE(
  question_id text,
  journey text,
  no_approved_answer_count bigint,
  source_unavailable_count bigint,
  total_gap_signal_count bigint,
  last_seen_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $admin_read_content_gap_inputs$
  SELECT
    e.question_id,
    e.journey,
    count(*) FILTER (WHERE e.reason='no_approved_answer')::bigint,
    count(*) FILTER (WHERE e.reason='source_unavailable')::bigint,
    count(*) FILTER (WHERE e.reason IN ('no_approved_answer','source_unavailable'))::bigint,
    max(e.occurred_at) FILTER (WHERE e.reason IN ('no_approved_answer','source_unavailable'))
  FROM private_line.safe_knowledge_event e
  WHERE e.outcome='human_handoff'
    AND e.reason IN ('no_approved_answer','source_unavailable')
  GROUP BY e.question_id,e.journey
  ORDER BY count(*) DESC,e.question_id,e.journey
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200)
$admin_read_content_gap_inputs$;

REVOKE ALL PRIVILEGES ON TABLE private_line.safe_knowledge_event FROM ccpun_admin_runtime;
REVOKE ALL PRIVILEGES ON TABLE private_line.safe_knowledge_event FROM ccpun_line_ingress;

REVOKE ALL ON FUNCTION private_line.ingress_record_safe_knowledge_event(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.ingress_record_safe_knowledge_event(jsonb) FROM ccpun_admin_runtime;
REVOKE ALL ON FUNCTION private_line.admin_read_content_intelligence_v2(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_content_intelligence_v2(integer) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_content_revenue_by_currency(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_content_revenue_by_currency(integer) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_safe_question_frequency(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_safe_question_frequency(integer) FROM ccpun_line_ingress;
REVOKE ALL ON FUNCTION private_line.admin_read_content_gap_inputs(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_line.admin_read_content_gap_inputs(integer) FROM ccpun_line_ingress;

GRANT EXECUTE ON FUNCTION private_line.ingress_record_safe_knowledge_event(jsonb) TO ccpun_line_ingress;
GRANT EXECUTE ON FUNCTION private_line.admin_read_content_intelligence_v2(integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_content_revenue_by_currency(integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_safe_question_frequency(integer) TO ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.admin_read_content_gap_inputs(integer) TO ccpun_admin_runtime;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum) VALUES('20260918_line_content_intelligence_v2_production','sha256:084d1063b0d0fbc1c48762ea8de88994210f7d063f244874c2b17c5ff55147af') ON CONFLICT(version) DO NOTHING;
COMMIT;

BEGIN;

DO $guard$
BEGIN
  IF current_database()<>'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private_line.schema_migration
    WHERE version='20260918_line_privacy_retention_v2_uat'
      AND checksum='sha256:ce3a55a27969b4effecb70af0bc8f5e4de4f9dc023fbd32fc91ded69a08005f8'
  ) THEN RAISE EXCEPTION 'latest LINE UAT privacy/retention migration missing'; END IF;
END
$guard$;

SELECT outcome
FROM private_line.record_safe_web_journey_event(jsonb_build_object(
  'anonymous_id_digest', repeat('6',64),
  'journey','motor_quote_review',
  'entrypoint','article',
  'event_type','line_continue',
  'content_id','uat_e2e_motor_content',
  'tool_id','uat_e2e_quote_tool',
  'campaign_id','uat_e2e_campaign',
  'attribution',jsonb_build_object('traffic_source','uat')
));

SELECT outcome
FROM private_line.ingest_line_event(jsonb_build_object(
  'event_digest',repeat('1',64),
  'event_type','message',
  'occurred_at',now()::text,
  'is_redelivery',false,
  'source_type','user',
  'identity',jsonb_build_object(
    'lookup_digest',repeat('2',64),
    'ciphertext_b64','c3ludGhldGljLWlk',
    'nonce_b64','c3ludGhldGljLW5vbmNl',
    'auth_tag_b64','c3ludGhldGljLXRhZw==',
    'key_version',2
  ),
  'message',jsonb_build_object(
    'provider_message_digest',repeat('3',64),
    'provider_message_ciphertext_b64','c3ludGhldGljLW1lc3NhZ2UtaWQ=',
    'provider_message_nonce_b64','c3ludGhldGljLW5vbmNl',
    'provider_message_auth_tag_b64','c3ludGhldGljLXRhZw==',
    'provider_message_key_version',2,
    'message_type','file',
    'content',NULL,
    'material_received',true
  ),
  'needs_human',true
));

UPDATE private_line.lead l
SET journey='motor_quote_review',source_origin='uat',updated_at=now()
FROM private_line.conversation c
JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id
WHERE l.conversation_id=c.conversation_id
  AND pi.external_ref_digest=repeat('2',64);

INSERT INTO private_line.lead_context(
  lead_id,origin,campaign_id,content_id,need,journey,tool_id,saved_result_ref,question_ids,attribution
)
SELECT
  l.lead_id,'uat','uat_e2e_campaign','uat_e2e_motor_content','quote_review',
  'motor_quote_review','uat_e2e_quote_tool',NULL,
  ARRAY['motor_2plus_vs_3plus']::text[],
  jsonb_build_object('traffic_source','uat')
FROM private_line.lead l
JOIN private_line.conversation c ON c.conversation_id=l.conversation_id
JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id
WHERE pi.external_ref_digest=repeat('2',64)
ON CONFLICT(lead_id) DO UPDATE SET
  origin=EXCLUDED.origin,
  campaign_id=EXCLUDED.campaign_id,
  content_id=EXCLUDED.content_id,
  need=EXCLUDED.need,
  journey=EXCLUDED.journey,
  tool_id=EXCLUDED.tool_id,
  question_ids=EXCLUDED.question_ids,
  attribution=EXCLUDED.attribution,
  updated_at=now();

SELECT outcome
FROM private_line.admin_bind_lead_attribution(jsonb_build_object(
  'lead_id',(
    SELECT l.lead_id::text
    FROM private_line.lead l
    JOIN private_line.conversation c ON c.conversation_id=l.conversation_id
    JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id
    WHERE pi.external_ref_digest=repeat('2',64)
    LIMIT 1
  ),
  'journey_event_id',(
    SELECT e.journey_event_id::text
    FROM private_line.web_journey_event e
    WHERE e.content_id='uat_e2e_motor_content'
      AND e.campaign_id='uat_e2e_campaign'
      AND e.event_type='line_continue'
    ORDER BY e.created_at DESC
    LIMIT 1
  ),
  'actor_digest',repeat('4',64)
));

SELECT outcome FROM private_line.ingress_record_safe_knowledge_event(jsonb_build_object(
  'question_id','motor_2plus_vs_3plus',
  'journey','motor_quote_review',
  'stage','quote_available',
  'outcome','related_content',
  'reason',NULL,
  'request_content_id','uat_e2e_motor_content',
  'source_slug','car-insurance-types'
));

SELECT outcome FROM private_line.admin_update_lead_stage(jsonb_build_object(
  'lead_id',(SELECT l.lead_id::text FROM private_line.lead l JOIN private_line.conversation c ON c.conversation_id=l.conversation_id JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id WHERE pi.external_ref_digest=repeat('2',64) LIMIT 1),
  'stage','Qualified','actor_digest',repeat('4',64)
));
SELECT outcome FROM private_line.admin_update_lead_stage(jsonb_build_object(
  'lead_id',(SELECT l.lead_id::text FROM private_line.lead l JOIN private_line.conversation c ON c.conversation_id=l.conversation_id JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id WHERE pi.external_ref_digest=repeat('2',64) LIMIT 1),
  'stage','Expert Review','actor_digest',repeat('4',64)
));
SELECT outcome FROM private_line.admin_update_lead_stage(jsonb_build_object(
  'lead_id',(SELECT l.lead_id::text FROM private_line.lead l JOIN private_line.conversation c ON c.conversation_id=l.conversation_id JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id WHERE pi.external_ref_digest=repeat('2',64) LIMIT 1),
  'stage','Solution','actor_digest',repeat('4',64)
));
SELECT outcome FROM private_line.admin_update_lead_stage(jsonb_build_object(
  'lead_id',(SELECT l.lead_id::text FROM private_line.lead l JOIN private_line.conversation c ON c.conversation_id=l.conversation_id JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id WHERE pi.external_ref_digest=repeat('2',64) LIMIT 1),
  'stage','Implementation','actor_digest',repeat('4',64)
));

SELECT outcome FROM private_line.admin_record_implementation(jsonb_build_object(
  'lead_id',(SELECT l.lead_id::text FROM private_line.lead l JOIN private_line.conversation c ON c.conversation_id=l.conversation_id JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id WHERE pi.external_ref_digest=repeat('2',64) LIMIT 1),
  'status','complete',
  'partner_code','synthetic_partner',
  'actor_digest',repeat('4',64),
  'event_key','impl:uat_e2e_complete'
));

SELECT outcome FROM private_line.admin_update_lead_stage(jsonb_build_object(
  'lead_id',(SELECT l.lead_id::text FROM private_line.lead l JOIN private_line.conversation c ON c.conversation_id=l.conversation_id JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id WHERE pi.external_ref_digest=repeat('2',64) LIMIT 1),
  'stage','Won','actor_digest',repeat('4',64)
));

SELECT outcome
FROM private_line.admin_attribute_revenue(jsonb_build_object(
  'lead_id',(SELECT l.lead_id::text FROM private_line.lead l JOIN private_line.conversation c ON c.conversation_id=l.conversation_id JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id WHERE pi.external_ref_digest=repeat('2',64) LIMIT 1),
  'amount_minor','10000',
  'currency','THB',
  'idempotency_digest',repeat('5',64),
  'actor_digest',repeat('4',64)
));

SELECT
  EXISTS(
    SELECT 1 FROM private_line.web_journey_event
    WHERE content_id='uat_e2e_motor_content'
      AND tool_id='uat_e2e_quote_tool'
      AND event_type='line_continue'
  ) AS website_to_line_journey_ok,
  EXISTS(
    SELECT 1
    FROM private_line.lead l
    JOIN private_line.lead_context lc ON lc.lead_id=l.lead_id
    JOIN private_line.advisor_case ac ON ac.lead_id=l.lead_id
    JOIN private_line.conversation c ON c.conversation_id=l.conversation_id
    JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id
    WHERE pi.external_ref_digest=repeat('2',64)
      AND l.journey='motor_quote_review'
      AND l.material_received=true
      AND l.stage='Won'
      AND lc.origin='uat'
      AND lc.content_id='uat_e2e_motor_content'
      AND lc.tool_id='uat_e2e_quote_tool'
      AND ac.status='closed'
  ) AS qualification_lead_advisor_ok,
  EXISTS(
    SELECT 1
    FROM private_line.lead_implementation li
    JOIN private_line.lead l ON l.lead_id=li.lead_id
    JOIN private_line.conversation c ON c.conversation_id=l.conversation_id
    JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id
    WHERE pi.external_ref_digest=repeat('2',64)
      AND li.status='complete'
  ) AS implementation_ok,
  EXISTS(
    SELECT 1
    FROM private_line.lead_revenue r
    JOIN private_line.lead l ON l.lead_id=r.lead_id
    JOIN private_line.conversation c ON c.conversation_id=l.conversation_id
    JOIN private_line.provider_identity pi ON pi.identity_id=c.identity_id
    WHERE pi.external_ref_digest=repeat('2',64)
      AND r.currency='THB'
      AND r.amount_minor=10000
  ) AS revenue_ok,
  EXISTS(
    SELECT 1
    FROM private_line.admin_read_content_intelligence_v2(200) ci
    WHERE ci.origin='uat'
      AND ci.journey='motor_quote_review'
      AND ci.content_id='uat_e2e_motor_content'
      AND ci.tool_id='uat_e2e_quote_tool'
      AND ci.journey_start_count=1
      AND ci.lead_count=1
      AND ci.material_received_count=1
      AND ci.qualified_count=1
      AND ci.implementation_complete_count=1
      AND ci.won_count=1
      AND ci.revenue_record_count=1
      AND ci.drop_off_count=0
  ) AS aggregate_content_intelligence_ok,
  EXISTS(
    SELECT 1
    FROM private_line.admin_read_content_revenue_by_currency(200) cr
    WHERE cr.origin='uat'
      AND cr.journey='motor_quote_review'
      AND cr.content_id='uat_e2e_motor_content'
      AND cr.currency='THB'
      AND cr.revenue_record_count=1
      AND cr.revenue_suppressed=true
      AND cr.revenue_minor IS NULL
  ) AS small_group_revenue_suppressed_ok,
  EXISTS(
    SELECT 1
    FROM private_line.admin_read_safe_question_frequency(100) q
    WHERE q.question_id='motor_2plus_vs_3plus'
      AND q.journey='motor_quote_review'
      AND q.outcome='related_content'
      AND q.request_count=1
  ) AS approved_question_frequency_ok,
  EXISTS(
    SELECT 1
    FROM private_line.document_storage_object dso
    JOIN private_line.document d ON d.document_id=dso.document_id
    JOIN private_line.message m ON m.message_id=d.message_id
    WHERE m.provider_message_digest=repeat('3',64)
      AND dso.status='pending_fetch'
  ) AS attachment_lifecycle_created_ok;

ROLLBACK;

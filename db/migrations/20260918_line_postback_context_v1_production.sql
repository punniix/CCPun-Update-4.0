BEGIN;
DO $guard$
DECLARE existing_checksum text;
BEGIN
  IF current_database()<>'neondb' THEN RAISE EXCEPTION 'wrong database'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM private_line.schema_migration
    WHERE version='20260918_line_private_conversation_v1_production'
      AND checksum='sha256:d208639906275865acb686cb0d0039e14a9feb3dcd7a2156702f45b061c34344'
  ) THEN RAISE EXCEPTION 'LINE private conversation v1 missing'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM private_line.system_identity
    WHERE singleton=true
      AND project_id='lively-bar-43618798'
      AND branch_id='br-long-resonance-b3ys5xrv'
      AND endpoint_id='ep-broad-butterfly-b3ro7u8w'
      AND database_name='neondb'
  ) THEN RAISE EXCEPTION 'LINE runtime identity changed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private_line:20260918_line_postback_context_v1'));
  SELECT checksum INTO existing_checksum FROM private_line.schema_migration WHERE version='20260918_line_postback_context_v1_production';
  IF existing_checksum IS NOT NULL AND existing_checksum<>'sha256:e3f015b5d8cba805d9856333bfedffa1a33cd7f6a87892f69e634fe1f7a6f5ca' THEN
    RAISE EXCEPTION 'LINE postback context checksum mismatch';
  END IF;
END
$guard$;
-- checksum-source-begin
CREATE OR REPLACE FUNCTION private_line.ingress_apply_line_postback_context(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $ingress_apply_line_postback_context$
DECLARE
  v_identity_digest text;
  v_journey text;
  v_stage text;
  v_needs_human boolean;
  v_customer_id uuid;
  v_conversation_id uuid;
  v_lead_id uuid;
  v_material_received boolean := false;
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR NOT private_line.safe_json_keys_only(payload,ARRAY['identity_digest','journey','stage','needs_human']::text[])
  THEN RAISE EXCEPTION 'invalid LINE postback context payload'; END IF;

  v_identity_digest := payload->>'identity_digest';
  v_journey := payload->>'journey';
  v_stage := payload->>'stage';
  v_needs_human := COALESCE((payload->>'needs_human')::boolean,false);

  IF NOT private_line.safe_hex_digest(v_identity_digest)
    OR NOT private_line.safe_id(v_journey)
    OR NOT private_line.safe_id(v_stage)
    OR v_needs_human <> (v_journey='human_handoff')
  THEN RAISE EXCEPTION 'invalid LINE postback context'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM private_line.rich_menu_item rmi
    WHERE rmi.action_type='postback'
      AND rmi.postback_data='journey='||v_journey||'&stage='||v_stage
    UNION ALL
    SELECT 1 FROM private_line.quick_reply_template qrt
    WHERE qrt.postback_data='journey='||v_journey||'&stage='||v_stage
  ) THEN
    RAISE EXCEPTION 'unapproved LINE postback context';
  END IF;

  SELECT pi.customer_id,c.conversation_id
  INTO v_customer_id,v_conversation_id
  FROM private_line.provider_identity pi
  JOIN private_line.conversation c ON c.identity_id=pi.identity_id
  WHERE pi.provider='line' AND pi.external_ref_digest=v_identity_digest;

  IF v_customer_id IS NULL OR v_conversation_id IS NULL THEN
    RETURN QUERY SELECT 'identity_missing'::text;
    RETURN;
  END IF;

  SELECT COALESCE(bool_or(l.material_received),false)
  INTO v_material_received
  FROM private_line.lead l
  WHERE l.customer_id=v_customer_id AND l.stage NOT IN ('Won','Lost');

  INSERT INTO private_line.safe_journey_state(
    customer_id,journey,stage,material_received,needs_human
  ) VALUES (
    v_customer_id,v_journey,v_stage,v_material_received,v_needs_human
  )
  ON CONFLICT(customer_id) DO UPDATE SET
    journey=EXCLUDED.journey,
    stage=EXCLUDED.stage,
    needs_human=EXCLUDED.needs_human,
    material_received=private_line.safe_journey_state.material_received OR EXCLUDED.material_received,
    updated_at=now();

  IF v_needs_human THEN
    SELECT l.lead_id INTO v_lead_id
    FROM private_line.lead l
    WHERE l.customer_id=v_customer_id AND l.stage NOT IN ('Won','Lost')
    ORDER BY l.updated_at DESC
    LIMIT 1;

    IF v_lead_id IS NULL THEN
      INSERT INTO private_line.lead(
        customer_id,conversation_id,journey,stage,material_received
      ) VALUES (
        v_customer_id,v_conversation_id,'human_handoff','New',v_material_received
      ) RETURNING lead_id INTO v_lead_id;
    END IF;

    INSERT INTO private_line.advisor_case(lead_id,conversation_id)
    VALUES(v_lead_id,v_conversation_id)
    ON CONFLICT(lead_id) DO UPDATE SET
      status='open',
      updated_at=now();
  ELSE
    SELECT l.lead_id INTO v_lead_id
    FROM private_line.lead l
    WHERE l.customer_id=v_customer_id
      AND l.stage='New'
      AND l.journey='human_handoff'
    ORDER BY l.updated_at DESC
    LIMIT 1;

    IF v_lead_id IS NOT NULL THEN
      UPDATE private_line.lead
      SET journey=v_journey,updated_at=now()
      WHERE lead_id=v_lead_id;
    END IF;
  END IF;

  RETURN QUERY SELECT 'applied'::text;
END
$ingress_apply_line_postback_context$;

CREATE OR REPLACE FUNCTION private_line.ingress_apply_line_message_context(payload jsonb)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_line
AS $ingress_apply_line_message_context$
DECLARE
  v_identity_digest text;
  v_customer_id uuid;
  v_journey text;
  v_lead_id uuid;
BEGIN
  IF jsonb_typeof(payload)<>'object'
    OR NOT private_line.safe_json_keys_only(payload,ARRAY['identity_digest']::text[])
  THEN RAISE EXCEPTION 'invalid LINE message context payload'; END IF;

  v_identity_digest := payload->>'identity_digest';
  IF NOT private_line.safe_hex_digest(v_identity_digest) THEN
    RAISE EXCEPTION 'invalid LINE message identity';
  END IF;

  SELECT pi.customer_id INTO v_customer_id
  FROM private_line.provider_identity pi
  WHERE pi.provider='line' AND pi.external_ref_digest=v_identity_digest;

  IF v_customer_id IS NULL THEN
    RETURN QUERY SELECT 'identity_missing'::text;
    RETURN;
  END IF;

  SELECT sjs.journey INTO v_journey
  FROM private_line.safe_journey_state sjs
  WHERE sjs.customer_id=v_customer_id;

  IF v_journey IS NULL OR v_journey='human_handoff' THEN
    RETURN QUERY SELECT 'no_context'::text;
    RETURN;
  END IF;

  SELECT l.lead_id INTO v_lead_id
  FROM private_line.lead l
  WHERE l.customer_id=v_customer_id
    AND l.stage='New'
    AND l.journey='human_handoff'
  ORDER BY l.updated_at DESC
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    RETURN QUERY SELECT 'no_new_lead'::text;
    RETURN;
  END IF;

  UPDATE private_line.lead
  SET journey=v_journey,updated_at=now()
  WHERE lead_id=v_lead_id;

  RETURN QUERY SELECT 'applied'::text;
END
$ingress_apply_line_message_context$;

REVOKE ALL ON FUNCTION private_line.ingress_apply_line_postback_context(jsonb) FROM PUBLIC,ccpun_admin_runtime;
REVOKE ALL ON FUNCTION private_line.ingress_apply_line_message_context(jsonb) FROM PUBLIC,ccpun_admin_runtime;
GRANT EXECUTE ON FUNCTION private_line.ingress_apply_line_postback_context(jsonb) TO ccpun_line_ingress;
GRANT EXECUTE ON FUNCTION private_line.ingress_apply_line_message_context(jsonb) TO ccpun_line_ingress;
-- checksum-source-end
INSERT INTO private_line.schema_migration(version,checksum)
VALUES('20260918_line_postback_context_v1_production','sha256:e3f015b5d8cba805d9856333bfedffa1a33cd7f6a87892f69e634fe1f7a6f5ca')
ON CONFLICT(version) DO UPDATE SET checksum=EXCLUDED.checksum;
COMMIT;

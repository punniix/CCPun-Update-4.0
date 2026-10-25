-- Financial planning room (ห้องวางแผนการเงิน) phase 1: households, financial
-- position items and CRM notes. Plain portable Postgres (13+), no extensions.
--
-- Target: the database named by CCPUN_FA_DATABASE_URL (its own Neon database or
-- branch). Never apply this to the Production Neon project without an explicit,
-- task-specific owner approval.
--
-- Before applying, create the runtime login role yourself (outside this file):
--   CREATE ROLE ccpun_fa_runtime LOGIN PASSWORD '<generated, never committed>';
-- Create it with SQL, not the Neon console/API: roles made there join
-- neon_superuser and the guard below refuses them (verified 2026-10-25).
-- The runtime role gets no DELETE privilege on any table. Households and notes
-- are never deleted by the application (decision F3); financial position items
-- are replaced only through ccpun_fa.replace_household_plan().
--
-- Every client value (names, amounts, labels, notes) is AES-256-GCM ciphertext
-- produced by the Admin app (lib/admin/financial-planning/crypto.ts). Postgres
-- only sees IDs, ordering, timestamps, revision and retention dates.
BEGIN;
SET LOCAL statement_timeout = '15s';
SELECT pg_advisory_xact_lock(hashtext('ccpun_fa:20261025_fa_room_v1'));
CREATE SCHEMA IF NOT EXISTS ccpun_fa;
REVOKE ALL ON SCHEMA ccpun_fa FROM PUBLIC;
CREATE TABLE IF NOT EXISTS ccpun_fa.schema_migration (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_fa_runtime') THEN
    RAISE EXCEPTION 'Create the dedicated ccpun_fa_runtime login role first';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_fa_runtime'
    AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = 'ccpun_fa_runtime'::regrole)
  THEN RAISE EXCEPTION 'FA runtime role has excessive privileges or memberships'; END IF;
  -- Includes effective PUBLIC/inherited access: the FA runtime must not reach
  -- another application's data plane in the same database.
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema','ccpun_fa')
      AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'
      AND c.relkind IN ('r','p','v','m','f')
      AND has_table_privilege('ccpun_fa_runtime',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  ) OR EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema','ccpun_fa')
      AND p.prosecdef AND has_schema_privilege('ccpun_fa_runtime',n.oid,'USAGE')
      AND has_function_privilege('ccpun_fa_runtime',p.oid,'EXECUTE')
  ) THEN RAISE EXCEPTION 'FA runtime can access another application data plane'; END IF;
  IF EXISTS (SELECT 1 FROM ccpun_fa.schema_migration
    WHERE version = '20261025_fa_room_v1' AND checksum <> 'sha256:bf95b9b6ad08369dc9965b8efac18da21d8959a59cb165692194b2f26644c8f9')
  THEN RAISE EXCEPTION 'FA migration checksum mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM ccpun_fa.schema_migration WHERE version = '20261025_fa_room_v1')
    AND (to_regclass('ccpun_fa.household') IS NOT NULL OR to_regclass('ccpun_fa.crm_note') IS NOT NULL)
  THEN RAISE EXCEPTION 'FA tables exist without a migration record'; END IF;
END
$guard$;

-- checksum-source-begin
CREATE TABLE IF NOT EXISTS ccpun_fa.household (
  household_id uuid PRIMARY KEY,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  client_status text NOT NULL DEFAULT 'active' CHECK (client_status IN ('active','former')),
  relationship_ended_on date,
  retention_until date,
  profile_ciphertext_b64 text NOT NULL CHECK (length(profile_ciphertext_b64) BETWEEN 4 AND 20000),
  profile_nonce_b64 text NOT NULL CHECK (profile_nonce_b64 ~ '^[A-Za-z0-9+/]{16}$'),
  profile_auth_tag_b64 text NOT NULL CHECK (profile_auth_tag_b64 ~ '^[A-Za-z0-9+/]{22}==$'),
  profile_key_version smallint NOT NULL CHECK (profile_key_version IN (1,2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Decision F3: retained while a client, then at least 2 years after the
  -- relationship ends. Purge is a manual owner decision, never automatic.
  CONSTRAINT household_retention_consistent CHECK (
    (client_status = 'active' AND relationship_ended_on IS NULL AND retention_until IS NULL)
    OR (client_status = 'former' AND relationship_ended_on IS NOT NULL AND retention_until IS NOT NULL
      AND retention_until >= (relationship_ended_on + interval '2 years')::date)
  )
);
CREATE INDEX IF NOT EXISTS household_retention_idx
  ON ccpun_fa.household (retention_until) WHERE client_status = 'former';

CREATE TABLE IF NOT EXISTS ccpun_fa.cashflow_item (
  item_id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES ccpun_fa.household(household_id),
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 199),
  payload_ciphertext_b64 text NOT NULL CHECK (length(payload_ciphertext_b64) BETWEEN 4 AND 4000),
  payload_nonce_b64 text NOT NULL CHECK (payload_nonce_b64 ~ '^[A-Za-z0-9+/]{16}$'),
  payload_auth_tag_b64 text NOT NULL CHECK (payload_auth_tag_b64 ~ '^[A-Za-z0-9+/]{22}==$'),
  payload_key_version smallint NOT NULL CHECK (payload_key_version IN (1,2)),
  UNIQUE (household_id, position)
);
CREATE TABLE IF NOT EXISTS ccpun_fa.asset (
  item_id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES ccpun_fa.household(household_id),
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 199),
  payload_ciphertext_b64 text NOT NULL CHECK (length(payload_ciphertext_b64) BETWEEN 4 AND 4000),
  payload_nonce_b64 text NOT NULL CHECK (payload_nonce_b64 ~ '^[A-Za-z0-9+/]{16}$'),
  payload_auth_tag_b64 text NOT NULL CHECK (payload_auth_tag_b64 ~ '^[A-Za-z0-9+/]{22}==$'),
  payload_key_version smallint NOT NULL CHECK (payload_key_version IN (1,2)),
  UNIQUE (household_id, position)
);
CREATE TABLE IF NOT EXISTS ccpun_fa.liability (
  item_id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES ccpun_fa.household(household_id),
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 199),
  payload_ciphertext_b64 text NOT NULL CHECK (length(payload_ciphertext_b64) BETWEEN 4 AND 4000),
  payload_nonce_b64 text NOT NULL CHECK (payload_nonce_b64 ~ '^[A-Za-z0-9+/]{16}$'),
  payload_auth_tag_b64 text NOT NULL CHECK (payload_auth_tag_b64 ~ '^[A-Za-z0-9+/]{22}==$'),
  payload_key_version smallint NOT NULL CHECK (payload_key_version IN (1,2)),
  UNIQUE (household_id, position)
);
-- Append-only: the runtime can insert and read notes, never edit or delete.
CREATE TABLE IF NOT EXISTS ccpun_fa.crm_note (
  note_id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES ccpun_fa.household(household_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  payload_ciphertext_b64 text NOT NULL CHECK (length(payload_ciphertext_b64) BETWEEN 4 AND 12000),
  payload_nonce_b64 text NOT NULL CHECK (payload_nonce_b64 ~ '^[A-Za-z0-9+/]{16}$'),
  payload_auth_tag_b64 text NOT NULL CHECK (payload_auth_tag_b64 ~ '^[A-Za-z0-9+/]{22}==$'),
  payload_key_version smallint NOT NULL CHECK (payload_key_version IN (1,2))
);
CREATE INDEX IF NOT EXISTS crm_note_household_idx ON ccpun_fa.crm_note (household_id, created_at DESC);

-- Atomic save of profile + financial position with optimistic concurrency.
-- p_items: {"cashflow":[...],"assets":[...],"liabilities":[...]}, each element
-- {"id","ciphertext_b64","nonce_b64","auth_tag_b64","key_version"}.
CREATE OR REPLACE FUNCTION ccpun_fa.replace_household_plan(
  p_household_id uuid, p_expected_revision integer, p_profile jsonb, p_items jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE
  v_revision integer;
BEGIN
  IF p_household_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 1
    OR jsonb_typeof(p_profile) IS DISTINCT FROM 'object' OR jsonb_typeof(p_items) IS DISTINCT FROM 'object'
    OR jsonb_typeof(COALESCE(p_items->'cashflow','[]'::jsonb)) <> 'array'
    OR jsonb_typeof(COALESCE(p_items->'assets','[]'::jsonb)) <> 'array'
    OR jsonb_typeof(COALESCE(p_items->'liabilities','[]'::jsonb)) <> 'array'
  THEN RAISE EXCEPTION 'FA_PLAN_INVALID'; END IF;

  UPDATE ccpun_fa.household SET
    revision = revision + 1,
    profile_ciphertext_b64 = p_profile->>'ciphertext_b64',
    profile_nonce_b64 = p_profile->>'nonce_b64',
    profile_auth_tag_b64 = p_profile->>'auth_tag_b64',
    profile_key_version = (p_profile->>'key_version')::smallint,
    updated_at = now()
  WHERE household_id = p_household_id AND revision = p_expected_revision
  RETURNING revision INTO v_revision;
  IF v_revision IS NULL THEN RAISE EXCEPTION 'FA_REVISION_CONFLICT' USING ERRCODE = '40001'; END IF;

  DELETE FROM ccpun_fa.cashflow_item WHERE household_id = p_household_id;
  DELETE FROM ccpun_fa.asset WHERE household_id = p_household_id;
  DELETE FROM ccpun_fa.liability WHERE household_id = p_household_id;

  INSERT INTO ccpun_fa.cashflow_item(item_id,household_id,position,payload_ciphertext_b64,payload_nonce_b64,payload_auth_tag_b64,payload_key_version)
  SELECT (e->>'id')::uuid, p_household_id, (o - 1)::smallint, e->>'ciphertext_b64', e->>'nonce_b64', e->>'auth_tag_b64', (e->>'key_version')::smallint
  FROM jsonb_array_elements(COALESCE(p_items->'cashflow','[]'::jsonb)) WITH ORDINALITY AS t(e, o);
  INSERT INTO ccpun_fa.asset(item_id,household_id,position,payload_ciphertext_b64,payload_nonce_b64,payload_auth_tag_b64,payload_key_version)
  SELECT (e->>'id')::uuid, p_household_id, (o - 1)::smallint, e->>'ciphertext_b64', e->>'nonce_b64', e->>'auth_tag_b64', (e->>'key_version')::smallint
  FROM jsonb_array_elements(COALESCE(p_items->'assets','[]'::jsonb)) WITH ORDINALITY AS t(e, o);
  INSERT INTO ccpun_fa.liability(item_id,household_id,position,payload_ciphertext_b64,payload_nonce_b64,payload_auth_tag_b64,payload_key_version)
  SELECT (e->>'id')::uuid, p_household_id, (o - 1)::smallint, e->>'ciphertext_b64', e->>'nonce_b64', e->>'auth_tag_b64', (e->>'key_version')::smallint
  FROM jsonb_array_elements(COALESCE(p_items->'liabilities','[]'::jsonb)) WITH ORDINALITY AS t(e, o);

  RETURN v_revision;
END
$function$;
REVOKE ALL ON FUNCTION ccpun_fa.replace_household_plan(uuid,integer,jsonb,jsonb) FROM PUBLIC;

GRANT USAGE ON SCHEMA ccpun_fa TO ccpun_fa_runtime;
GRANT SELECT, INSERT ON ccpun_fa.household TO ccpun_fa_runtime;
GRANT UPDATE (client_status, relationship_ended_on, retention_until, updated_at) ON ccpun_fa.household TO ccpun_fa_runtime;
GRANT SELECT ON ccpun_fa.cashflow_item, ccpun_fa.asset, ccpun_fa.liability TO ccpun_fa_runtime;
GRANT SELECT, INSERT ON ccpun_fa.crm_note TO ccpun_fa_runtime;
GRANT EXECUTE ON FUNCTION ccpun_fa.replace_household_plan(uuid,integer,jsonb,jsonb) TO ccpun_fa_runtime;
-- checksum-source-end
INSERT INTO ccpun_fa.schema_migration(version,checksum) VALUES('20261025_fa_room_v1','sha256:bf95b9b6ad08369dc9965b8efac18da21d8959a59cb165692194b2f26644c8f9') ON CONFLICT (version) DO NOTHING;
COMMIT;

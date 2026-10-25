-- Email phase 1 (owner-approved 2026-10-25): monthly-digest consent for "send my result by email".
-- NOT APPLIED. Apply to the Web UAT Neon database (endpoint ep-mute-frost-aztvz394) first, and to
-- Production only with explicit owner approval, after creating the dedicated login role
-- ccpun_email_runtime through native Neon (no superuser, no memberships) and storing its
-- connection string as CCPUN_EMAIL_DATABASE_URL in the Hostinger Web app (never in Git).
--
-- Stored per address: the email, consent timestamps and the SHA-256 of a pending double-opt-in
-- token. Never stored: calculator figures, names, phone numbers, IP addresses, user agents, or a
-- usable token (unsubscribe links are stateless HMACs; DOI tokens are kept only as hashes).
-- The runtime role has no table privileges: it can only EXECUTE the three functions below.
BEGIN;
SET LOCAL statement_timeout = '15s';
SELECT pg_advisory_xact_lock(hashtext('ccpun_email:20261025_result_email_v1'));

DO $guard$
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'Incorrect email database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_email_runtime') THEN
    RAISE EXCEPTION 'Create the dedicated ccpun_email_runtime role through native Neon first';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_email_runtime'
    AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = 'ccpun_email_runtime'::regrole)
  THEN RAISE EXCEPTION 'Email runtime role has excessive privileges or memberships'; END IF;
END
$guard$;

CREATE SCHEMA IF NOT EXISTS ccpun_email;
REVOKE ALL ON SCHEMA ccpun_email FROM PUBLIC;

CREATE TABLE IF NOT EXISTS ccpun_email.schema_migration (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ccpun_email.subscriber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (char_length(email) BETWEEN 6 AND 254 AND email = lower(email) AND email ~ '^[^@[:space:]<>"]+@[^@[:space:]<>"]+\.[^@[:space:]<>"]+$'),
  digest_requested_at timestamptz NOT NULL,
  digest_confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  doi_token_hash text UNIQUE CHECK (doi_token_hash ~ '^[0-9a-f]{64}$'),
  doi_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((doi_token_hash IS NULL) = (doi_token_expires_at IS NULL))
);
REVOKE ALL ON ALL TABLES IN SCHEMA ccpun_email FROM PUBLIC;

-- Record (or renew) a digest request. A confirmed, still-subscribed address keeps its state and gets
-- no new token; anything else becomes pending with this token hash.
CREATE OR REPLACE FUNCTION ccpun_email.request_digest(p_email text, p_doi_token_hash text, p_expires_at timestamptz)
RETURNS TABLE(subscriber_id uuid, state text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE row_id uuid; confirmed boolean;
BEGIN
  IF p_email IS NULL OR char_length(p_email) NOT BETWEEN 6 AND 254 OR p_email <> lower(p_email)
    OR p_doi_token_hash IS NULL OR p_doi_token_hash !~ '^[0-9a-f]{64}$'
    OR p_expires_at IS NULL OR p_expires_at <= now() OR p_expires_at > now() + interval '8 days'
  THEN RAISE EXCEPTION 'Invalid digest request'; END IF;
  SELECT s.id, (s.digest_confirmed_at IS NOT NULL AND s.unsubscribed_at IS NULL)
    INTO row_id, confirmed FROM ccpun_email.subscriber s WHERE s.email = p_email FOR UPDATE;
  IF row_id IS NOT NULL AND confirmed THEN
    RETURN QUERY SELECT row_id, 'confirmed'::text; RETURN;
  END IF;
  INSERT INTO ccpun_email.subscriber AS s (email, digest_requested_at, doi_token_hash, doi_token_expires_at)
  VALUES (p_email, now(), p_doi_token_hash, p_expires_at)
  ON CONFLICT (email) DO UPDATE SET digest_requested_at = now(), doi_token_hash = excluded.doi_token_hash,
    doi_token_expires_at = excluded.doi_token_expires_at, updated_at = now()
  RETURNING s.id INTO row_id;
  RETURN QUERY SELECT row_id, 'pending'::text;
END
$function$;

-- Double opt-in confirmation by token hash. Re-subscribing after an unsubscribe also lands here.
CREATE OR REPLACE FUNCTION ccpun_email.confirm_digest(p_doi_token_hash text)
RETURNS TABLE(subscriber_id uuid, state text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE row_id uuid; expires timestamptz;
BEGIN
  IF p_doi_token_hash IS NULL OR p_doi_token_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid confirmation'; END IF;
  SELECT s.id, s.doi_token_expires_at INTO row_id, expires FROM ccpun_email.subscriber s
    WHERE s.doi_token_hash = p_doi_token_hash FOR UPDATE;
  IF row_id IS NULL THEN RETURN QUERY SELECT NULL::uuid, 'invalid'::text; RETURN; END IF;
  IF expires <= now() THEN
    UPDATE ccpun_email.subscriber SET doi_token_hash = NULL, doi_token_expires_at = NULL, updated_at = now() WHERE id = row_id;
    RETURN QUERY SELECT row_id, 'expired'::text; RETURN;
  END IF;
  UPDATE ccpun_email.subscriber SET digest_confirmed_at = now(), unsubscribed_at = NULL,
    doi_token_hash = NULL, doi_token_expires_at = NULL, updated_at = now() WHERE id = row_id;
  RETURN QUERY SELECT row_id, 'confirmed'::text;
END
$function$;

-- Unsubscribe by subscriber id (the caller has already verified the HMAC link). Idempotent.
CREATE OR REPLACE FUNCTION ccpun_email.unsubscribe_digest(p_subscriber_id uuid)
RETURNS TABLE(state text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
BEGIN
  IF p_subscriber_id IS NULL THEN RAISE EXCEPTION 'Invalid unsubscribe'; END IF;
  UPDATE ccpun_email.subscriber SET unsubscribed_at = COALESCE(unsubscribed_at, now()),
    doi_token_hash = NULL, doi_token_expires_at = NULL, updated_at = now() WHERE id = p_subscriber_id;
  RETURN QUERY SELECT CASE WHEN FOUND THEN 'unsubscribed' ELSE 'unknown' END::text;
END
$function$;

REVOKE ALL ON FUNCTION ccpun_email.request_digest(text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_email.confirm_digest(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION ccpun_email.unsubscribe_digest(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA ccpun_email TO ccpun_email_runtime;
GRANT EXECUTE ON FUNCTION ccpun_email.request_digest(text, text, timestamptz) TO ccpun_email_runtime;
GRANT EXECUTE ON FUNCTION ccpun_email.confirm_digest(text) TO ccpun_email_runtime;
GRANT EXECUTE ON FUNCTION ccpun_email.unsubscribe_digest(uuid) TO ccpun_email_runtime;

INSERT INTO ccpun_email.schema_migration(version) VALUES ('20261025_result_email_v1') ON CONFLICT DO NOTHING;
COMMIT;

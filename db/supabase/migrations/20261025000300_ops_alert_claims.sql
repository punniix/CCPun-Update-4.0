-- Crash-safe owner alert claims (Codex audit F03, 2026-10-25). Additive only.
--
-- Replaces the claim on ops_daily_job_status.alert_sent_at, which was set
-- BEFORE sending: a process that died between claim and send blocked the alert
-- forever, and "relay answered HTTP 2xx" was recorded as "sent". Admin no longer
-- writes alert_sent_at; the column stays for history and is not dropped.
--
-- One row per alert reference (lane-scoped, no personal data), for example
-- 'production-admin:daily-0600:failed:42' or
-- 'production-admin:daily-0600:missing:2026-10-25'. States:
--   pending  - claimed by one attempt until claim_expires_at. If that attempt
--              crashed, was rejected, or never learned the relay outcome, the
--              claim may be taken again after expiry and the SAME reference is
--              re-sent; the relay de-duplicates on it (idempotency key).
--   accepted - the relay answered 2xx for this reference. This is "relay
--              accepted", NOT "email delivered".
--   sent     - reserved for a later delivery confirmation; nothing sets it yet.
--
-- The rules are mirrored and tested in lib/admin/ops-telemetry/contracts.ts
-- (claimAlertInMemory / markAlertAcceptedInMemory). Expiry uses the database
-- clock (p_now defaults to now(); Admin never passes it).
--
-- Apply after 20261025000200 in each lane's own Supabase project.

BEGIN;
SELECT pg_advisory_xact_lock(hashtext('ccpun_ops:20261025000300_ops_alert_claims'));

CREATE TABLE IF NOT EXISTS public.ops_alert_claims (
  reference text PRIMARY KEY CHECK (reference ~ '^[a-z0-9][a-z0-9:._-]{0,159}$'),
  kind text NOT NULL CHECK (kind IN ('daily-job-failed', 'daily-job-stuck', 'daily-job-missing')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'accepted', 'sent')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  claimed_at timestamptz NOT NULL,
  claim_expires_at timestamptz NOT NULL,
  relay_accepted_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (claim_expires_at > claimed_at),
  CHECK (state = 'pending' OR relay_accepted_at IS NOT NULL),
  CHECK (state <> 'sent' OR sent_at IS NOT NULL)
);

ALTER TABLE public.ops_alert_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ops_deny_client_roles ON public.ops_alert_claims;
CREATE POLICY ops_deny_client_roles ON public.ops_alert_claims AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.ops_alert_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ops_alert_claims TO service_role;

-- Atomic claim. Exactly one concurrent caller gets claimed = true: a new
-- reference is inserted once (the unique key serializes racers), and an
-- existing one is re-claimed only while it is still pending AND its claim has
-- expired (ON CONFLICT DO UPDATE re-checks the WHERE on the locked row).
CREATE OR REPLACE FUNCTION public.ops_claim_alert(p_reference text, p_kind text, p_ttl_seconds integer DEFAULT 600, p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.ops_alert_claims;
  v_claimed boolean := false;
BEGIN
  IF p_now IS NULL THEN
    RAISE EXCEPTION 'OPS_ALERT_NOW_REQUIRED';
  END IF;
  IF p_ttl_seconds IS NULL OR p_ttl_seconds < 60 OR p_ttl_seconds > 86400 THEN
    RAISE EXCEPTION 'OPS_ALERT_TTL_INVALID';
  END IF;
  INSERT INTO public.ops_alert_claims AS c (reference, kind, state, attempts, claimed_at, claim_expires_at, created_at, updated_at)
  VALUES (p_reference, p_kind, 'pending', 1, p_now, p_now + make_interval(secs => p_ttl_seconds), p_now, p_now)
  ON CONFLICT (reference) DO UPDATE SET
    attempts = c.attempts + 1,
    claimed_at = EXCLUDED.claimed_at,
    claim_expires_at = EXCLUDED.claim_expires_at,
    updated_at = EXCLUDED.updated_at
  WHERE c.state = 'pending' AND c.kind = EXCLUDED.kind AND c.claim_expires_at <= EXCLUDED.claimed_at
  RETURNING * INTO v_row;
  IF FOUND THEN
    v_claimed := true;
  ELSE
    SELECT * INTO v_row FROM public.ops_alert_claims WHERE reference = p_reference;
  END IF;
  RETURN jsonb_build_object('claimed', v_claimed, 'state', v_row.state, 'attempts', v_row.attempts);
END;
$$;

-- pending -> accepted once the relay answered 2xx for this reference. Any
-- attempt may record it: relay acceptance of the reference is a fact about the
-- reference, not about which attempt holds the claim.
CREATE OR REPLACE FUNCTION public.ops_mark_alert_accepted(p_reference text, p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_now IS NULL THEN
    RAISE EXCEPTION 'OPS_ALERT_NOW_REQUIRED';
  END IF;
  UPDATE public.ops_alert_claims
  SET state = 'accepted', relay_accepted_at = p_now, updated_at = p_now
  WHERE reference = p_reference AND state = 'pending';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.ops_claim_alert(text, text, integer, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ops_mark_alert_accepted(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_claim_alert(text, text, integer, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.ops_mark_alert_accepted(text, timestamptz) TO service_role;

COMMIT;

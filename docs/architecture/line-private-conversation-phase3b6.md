# LINE Private Conversation + Lead/Journey Foundation — Phase 3B–6

This release extends the Production Phase 2/3A LINE foundation without activating any new provider write. It is designed to deploy safely with transcript and outbound reply **off** until the owner completes the final secret/credential activation batch.

## Runtime boundaries

- Public Web remains write-only for LINE ingestion and safe journey metadata.
- Admin remains the only private read/action surface.
- `ccpun_line_ingress` keeps zero direct table grants. It can execute only the existing ingest function plus the safe website-journey recorder.
- `ccpun_admin_runtime` keeps zero direct private-line base-table grants. It reads reviewed safe views and executes reviewed `SECURITY DEFINER` functions only.
- All new security-definer functions use a fixed `search_path = pg_catalog, private_line` and have `PUBLIC EXECUTE` revoked.
- `private_line.system_identity` stays pinned to the Phase 2 ingress identity. Later migrations add only `schema_migration` ledger rows.

## Admin case detail

`/dashboard/inbox/[leadId]/` uses the internal lead UUID only. No LINE user ID or provider identifier appears in the URL or client-facing safe context.

The page shows safe lead context, stage history, deterministic bot classification, transcript availability, and reply/stage actions. Transcript plaintext is produced server-side only when both conditions are true:

1. `CCPUN_LINE_TRANSCRIPT_ENABLED=true`
2. `CCPUN_LINE_ENCRYPTION_KEY_V1` is present and valid in the Admin server runtime.

Otherwise the transcript is explicitly `disabled` or `key_unavailable`. The Admin never falls back to raw table reads.

Unsent LINE messages remain tombstones. The transcript SQL projection returns no content ciphertext/nonce/tag/key version for `status='unsent'`, so purged content cannot be reconstructed through this surface.

## Outbound reply safety

Admin reply is fail-closed. Provider sending requires all of:

- owner identity + `advisor:reply`;
- same-origin POST;
- bounded text (1–2,000 characters);
- `CCPUN_LINE_OUTBOUND_ENABLED=true`;
- valid `CCPUN_LINE_ENCRYPTION_KEY_V1`;
- `CCPUN_LINE_CHANNEL_ACCESS_TOKEN`.

The reply is encrypted before it enters `private_line.outbound_message`. The durable queue uses a unique idempotency digest, lease owner/expiry, attempt count, delivery-attempt ledger, and explicit `reconciliation_required` state.

The provider adapter calls only `https://api.line.me/v2/bot/message/push`, sends the token only in `Authorization: Bearer`, uses `X-Line-Retry-Key`, has a seven-second timeout, and never automatically retries an ambiguous provider result. Ambiguity is checkpointed for manual reconciliation.

## Lead state model

Allowed stages are exactly:

`New → Qualified → Expert Review → Solution / Quote → Implementation → Won / Lost`

The deterministic transition graph allows controlled branches between Solution and Quote and permits Lost from active stages. Won/Lost are terminal. Every successful mutation records `lead_stage_history` with a one-way actor digest rather than the actor email.

## Journey and bot boundary

The deterministic router has five outputs:

- `approved_answer`
- `show_content`
- `show_tool`
- `qualify`
- `human_handoff`

It has no LLM dependency. Any personalized situation, suitability requirement, recommendation request, quote requirement, explicit human request, or absence of approved answer/content/tool forces `human_handoff`.

Static Rich Menu labels are versioned in code/data only in this release:

- หาเรื่องอ่าน
- เครื่องมือ
- ประกัน
- ลงทุน
- รถ
- คุยกับปัน

No Rich Menu provider creation or assignment happens before the final owner activation batch.

## Website → LINE bridge

`POST /api/line/continue/` accepts only bounded JSON containing allowlisted journey/content/tool/saved-result/campaign identifiers and safe attribution labels. Customer identity, message text, policy/health/financial fields and arbitrary attribution keys are rejected.

The bridge returns a LINE continue link and attempts to store the safe journey event through the existing least-privilege ingress runtime. The link can still be returned when storage is unavailable; the response reports storage readiness instead of pretending it persisted.

## UAT/Production migration chain

The release uses three checksum-locked additive steps:

1. `20260918_line_private_conversation_v1_*` — data model/functions/queue/journey foundation.
2. `20260918_line_private_conversation_security_v1_*` — revokes default PUBLIC function execution and re-grants only intended role capabilities.
3. `20260918_line_private_context_compat_v1_*` — restores the original Phase 3A `advisor_inbox_safe` shape and moves new context into `lead_context_safe`, preserving historical readback compatibility.

All three have UAT/Production parity and lane-specific guards.

## Human Activation Batch — do not perform during development

These owner-only steps are intentionally deferred and must not be pasted into chat:

1. In **Vercel `ccpun-admin` Production**, add `CCPUN_LINE_ENCRYPTION_KEY_V1` using the exact same existing value as `ccpun-web` Production. Do not generate a new value.
2. In **Vercel `ccpun-admin` Production**, add `CCPUN_LINE_CHANNEL_ACCESS_TOKEN` directly from LINE Developers.
3. Only after the two secrets above are present, add/enable:
   - `CCPUN_LINE_TRANSCRIPT_ENABLED=true`
   - `CCPUN_LINE_OUTBOUND_ENABLED=true`
4. Redeploy Admin Production after those owner changes.
5. Later Drive/media phases add a separate interactive Google `drive.file` consent gate; access/refresh tokens are never pasted into chat or persisted by this LINE runtime.
6. Production Admin owner sign-in and real mobile/LINE interactions remain final Human UAT actions.

Until that batch is completed, Production can safely contain this release with transcript/outbound disabled.

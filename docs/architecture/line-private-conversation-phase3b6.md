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
2. the active encryption-key version is explicitly configured and the matching server-only key is present. During V1→V2 rotation, Admin may run with V2 only; any remaining V1 item is shown as `legacy_key_unavailable` until Web securely rotates that customer's ciphertext.

Otherwise the transcript is explicitly `disabled` or `key_unavailable`. The Admin never falls back to raw table reads.

Unsent LINE messages remain tombstones. The transcript SQL projection returns no content ciphertext/nonce/tag/key version for `status='unsent'`, so purged content cannot be reconstructed through this surface.

## Outbound reply safety

Admin reply is fail-closed. Provider sending requires all of:

- owner identity + `advisor:reply`;
- same-origin POST;
- bounded text (1–2,000 characters);
- `CCPUN_LINE_OUTBOUND_ENABLED=true`;
- a valid key for `CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION` (V2 after rotation activation);
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

## Encryption key rotation V1 → V2

The V1 key in `ccpun-web` Production is write-only and must never be revealed, copied through AI, overwritten, or deleted during rotation.

The rotation contract is:

1. The owner creates one new V2 key locally, keeps an owner-held backup, and writes the same V2 value directly to both Production Vercel projects.
2. Dual-key code and the checksum-locked migration deploy while active encryption still defaults to V1.
3. Set the non-secret `CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION=2` in both runtimes. Web retains V1+V2; Admin can operate with V2 only.
4. Set `CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED=true` on Web only. After a successful identity-bearing LINE event, Web can rotate a bounded batch for that exact identity from V1 to V2. There is no global scan endpoint.
5. System Health reads aggregate key-version counts only. V1 retirement is forbidden until `total_v1_count=0`, `unsupported_version_count=0`, `encrypted_unsent_count=0`, and final security/readback verification passes.
6. Never delete V1 merely because V2 is active.

Admin-created V1 outbound/private-note records are intentionally not exposed to Web rotation. If `admin_only_v1_count` is non-zero, V1 retirement stays blocked until a separately reviewed Admin-owned rotation path exists.

## Human Activation Batch

Owner-only values are entered directly at the provider and never pasted into chat:

1. `CCPUN_LINE_ENCRYPTION_KEY_V2` must exist in both Production Vercel projects.
2. `CCPUN_LINE_CHANNEL_ACCESS_TOKEN` must be added directly to `ccpun-admin` Production before outbound LINE sending can be enabled.
3. After provider readiness and key-rotation verification, the non-secret gates may be enabled:
   - `CCPUN_LINE_TRANSCRIPT_ENABLED=true`
   - `CCPUN_LINE_OUTBOUND_ENABLED=true`
4. Later Drive/media phases add a separate interactive Google `drive.file` consent gate; access/refresh tokens are never pasted into chat or persisted by this LINE runtime.
5. Production Admin owner sign-in and real mobile/LINE interactions remain Final Human UAT actions.

Until provider activation is complete, Production can safely contain the release with transcript/outbound provider writes disabled.

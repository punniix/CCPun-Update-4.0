# LINE Private Conversation + Lead/Journey Foundation — Phase 3B–6

This release extends the Production Phase 2/3A LINE foundation. The current product contract is **LINE OA Manager for replies; Admin for Conversation Archive / Customer Timeline / Evidence only**. Direct advisor replies from Admin are retired and fail closed.

## Runtime boundaries

- Public Web remains write-only for LINE ingestion and safe journey metadata.
- Admin remains the only private read/action surface.
- `ccpun_line_ingress` keeps zero direct table grants. It can execute only the existing ingest function plus the safe website-journey recorder.
- `ccpun_admin_runtime` keeps zero direct private-line base-table grants. It reads reviewed safe views and executes reviewed `SECURITY DEFINER` functions only.
- All new security-definer functions use a fixed `search_path = pg_catalog, private_line` and have `PUBLIC EXECUTE` revoked.
- `private_line.system_identity` stays pinned to the Phase 2 ingress identity. Later migrations add only `schema_migration` ledger rows.

## Admin case detail

`/dashboard/inbox/[leadId]/` uses the internal lead UUID only. No LINE user ID or provider identifier appears in the URL or client-facing safe context.

The page shows safe lead context, stage history, deterministic bot classification, owner-only LINE display name, transcript/archive availability, evidence access, and stage actions. It has no active reply box. Transcript plaintext is produced server-side only when both conditions are true:

1. `CCPUN_LINE_TRANSCRIPT_ENABLED=true`
2. the active encryption-key version is explicitly configured and the matching server-only key is present. During V1→V2 rotation, Admin may run with V2 only; any remaining V1 item is shown as `legacy_key_unavailable` until Web securely rotates that customer's ciphertext.

Otherwise the transcript is explicitly `disabled` or `key_unavailable`. The Admin never falls back to raw table reads.

Operational Unsend still purges the live `private_line.message` content fields. Before that can happen, `line_conversation_archive` receives an encrypted evidence copy. The archive record changes to `unsent` and records `unsent_at` without clearing its encrypted message content. Legacy Unsend rows that were already purged before this archive migration remain content-unavailable.

## Conversation Archive / reply boundary

- Customer → OA messages enter in realtime through the signed LINE webhook.
- Human replies remain in LINE OA Manager, not Admin.
- The Admin reply endpoint is retained only as a compatibility boundary and returns HTTP 410.
- `ccpun_admin_runtime` no longer has EXECUTE on `admin_enqueue_line_reply(jsonb)` or `admin_claim_line_outbound(jsonb)`.
- `getLineActivationStatus().outboundEnabled` and the Admin `replyEnabled` status are hard-false.
- Historical LINE OA Manager replies can be added to the archive through an owner-only CSV import. The CSV bytes are not stored; only selected CCPun-sender rows are encrypted and inserted idempotently.
- The LINE Channel Access Token remains useful for owner-only profile lookup, media fetch and Rich Menu operations; it is not an authorization to make Admin a chat-send surface.

The historical outbound queue/provider code remains for migration/audit compatibility, but no active Admin route can enqueue or claim new advisor replies.

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

The current chain adds a fourth checksum-locked step:

1. `20260918_line_private_conversation_v1_*` — data model/functions/queue/journey foundation.
2. `20260918_line_private_conversation_security_v1_*` — revokes default PUBLIC function execution and re-grants only intended role capabilities.
3. `20260918_line_private_context_compat_v1_*` — restores the original Phase 3A `advisor_inbox_safe` shape and moves new context into `lead_context_safe`.
4. `20260918_line_conversation_archive_v1_*` — owner-only encrypted archive, retained Unsend evidence, encrypted LINE profile cache, OA CSV import, evidence access audit, and direct-reply capability revocation.

UAT and Production archive bodies are parity-locked and checksum-guarded.

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

## Current owner activation contract

Owner-only values are entered directly at the provider and never pasted into chat:

1. `CCPUN_LINE_ENCRYPTION_KEY_V2` remains the active encryption key.
2. `CCPUN_LINE_CHANNEL_ACCESS_TOKEN` is retained in `ccpun-admin` for private profile lookup, media fetch and gated Rich Menu operations.
3. `CCPUN_LINE_TRANSCRIPT_ENABLED=true` may remain enabled for owner-only archive reading.
4. `CCPUN_LINE_OUTBOUND_ENABLED` must remain false; the application and database also fail closed if it is accidentally enabled.
5. Drive/media uses a separate interactive Google `drive.file` consent gate; access/refresh tokens are never pasted into chat or persisted by this LINE runtime.
6. LINE OA Manager remains the source of truth for sending human replies. Its exported chat history can be imported later to fill the CCPun side of the archive.

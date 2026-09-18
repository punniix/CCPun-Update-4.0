# LINE Ecosystem Activation Contract — 2026-09-18

## Scope

This contract extends the existing private LINE / Lead / Advisor / Attribution / Revenue plane without creating another CRM, database project, Sanity project, or generic customer-data analytics path.

The release stays additive and preserves the private boundary:

- public Website → signed LINE webhook / safe Website journey bridge;
- private LINE ingress → dedicated ccpun_line_ingress functions only;
- owner Admin → dedicated ccpun_admin_runtime functions and safe views only;
- Sanity → editorial/approved-answer source only;
- customer attachments → LINE content API → memory-only transfer → Google Drive customer folder;
- business analytics → private aggregate functions only;
- AI/MCP/n8n AI → no raw customer path.

## Runtime verification

Web ingress reports only four effective runtime facts to private_line.line_runtime_health:

- active encryption version;
- V1 key present;
- V2 key present;
- lazy key rotation enabled.

No key value, identity, ciphertext, LINE ID, message content or row ID is part of this report. The Admin System Health page reads this singleton through admin_read_document_media_health().

V1 retirement remains blocked until the existing aggregate key-rotation status independently reports zero V1 rows and final verification passes.

## Customer document/media lifecycle

1. LINE attachment ingestion creates the existing private_line.document row.
2. document_storage_object starts at pending_fetch.
3. Admin-only fetch source decrypts the provider message ID in server memory.
4. LINE content bytes are fetched only when the LINE media gate and channel token are present.
5. Bytes transfer in memory to the Drive provider; they are not stored in Neon and never cross AI/MCP.
6. Customer Drive folder/file identities stay in private server-only tables/functions.
7. Upload is deduplicated with deterministic digests plus Drive appProperties.
8. Provider ambiguity enters reconciliation_required; it is not blindly retried.
9. LINE Unsend changes the document to revoke_required; the storage object preserves the provider deletion target even after the base document clears the file ID.
10. Revoke/delete checkpoint clears the storage target only after provider completion.

Drive policy:

- OAuth scope: drive.file;
- authorization: owner-interactive;
- token persistence: memory-only;
- refresh-token persistence: forbidden in this layer;
- folder/file ACL must resolve to owner-only private access;
- anyone/shared ACL fails closed as unsafe_permissions;
- no customer Drive ID is projected into generic safe Admin/AI surfaces.

## LINE provider activation

### Rich Menu

LINE_RICH_MENU_V1 is versioned and deterministic.

Provider sequence:

1. validate definition;
2. create Rich Menu;
3. upload PNG/JPEG;
4. set default Rich Menu.

Provider writes require both CCPUN_LINE_CHANNEL_ACCESS_TOKEN and CCPUN_LINE_RICH_MENU_PROVIDER_ENABLED=true. Without both, the adapter returns not_configured and performs no provider request.

### Outbound

Existing push delivery remains idempotent and gains explicit retry classification:

- rate_limited → retryable;
- provider_unavailable → retryable;
- provider_rejected → permanent/dead-letter;
- decrypt/key/unsupported-key failures → permanent/dead-letter;
- ambiguous provider result → reconciliation, never automatic retry.

Delivery health exposes counts only: queued, leased, sent, retryable failed, dead-letter and reconciliation.

## Content Intelligence v2

Journey start is the existing safe web_journey_event event_type=line_continue. No new identity fingerprinting is introduced.

Aggregate dimensions are origin, journey, content ID, campaign ID and tool ID. Measures are journey starts, leads, material received, qualified, qualification rate, implementation complete, won/lost, revenue record count and drop-off.

Content-level revenue:

- remains private Admin-only;
- stays separated by currency;
- suppresses revenue_minor when the group has fewer than 3 revenue records;
- never enters generic analytics.

Safe Knowledge frequency uses safe_knowledge_event, which contains only predefined question ID, journey, stage, approved outcome/reason, optional safe content ID/source slug and timestamp. It contains no customer, lead, conversation, message, document, identity or financial/health fields.

Content-gap input is deterministic from only no_approved_answer and source_unavailable. No LLM reads conversation text to generate this input.

## Privacy / retention

Retention remains policy_mode=manual_review and automatic_delete_enabled=false. No legal retention period is invented.

The owner may set nullable review thresholds for conversation, document and audit review. These thresholds are review reminders, not automatic deletion timers and not a claim about legal retention.

Attachment Unsend policy is fixed to revoke_then_delete.

### Export preparation

privacy_export_manifest stores count metadata only and hard-locks raw_payload_materialized=false. No raw export payload is copied through AI, MCP or the Admin health surface.

### Delete preparation

privacy_delete_audit_tombstone stores a count manifest, attachment cleanup required/completed counts and content_included=false.

admin_prepare_privacy_delete() never executes a destructive delete and always reports destructive execution unavailable. Irreversible deletion remains a separate Human Gate.

## Ops Health

Owner-only Admin health combines:

- effective Web V2/lazy-rotation status;
- Drive folder safety counts;
- attachment fetch/upload/revoke/reconciliation counts;
- outbound/campaign retryable/dead-letter/reconciliation counts;
- privacy preparation/retention safety;
- provider gate/token-presence booleans;
- aggregate key-rotation state.

Invalid LINE signatures deliberately do not write a database counter: an unauthenticated attacker must not be able to create durable customer-plane writes by sending invalid webhook traffic. Invalid-signature observability is therefore owned by HTTP/runtime telemetry (401 responses) outside the private customer database. The application contract proves signature verification, 401 behavior, no payload reflection and no logs containing private payloads.

Valid webhook dedupe remains database-owned through unique event/message digests.

Backup/restore health is not self-certified by application code. Runtime exposes external_verification_required; actual restore evidence must come from infrastructure/provider verification.

## Security matrix

Deterministic repository tests prove:

| Contract | Required result |
| --- | --- |
| AI raw customer access | 0 |
| MCP raw customer access | 0 |
| n8n AI customer access | 0 |
| Generic analytics PII | 0 |
| PII logs on private LINE paths | 0 |
| Public private-Line DB access | 0 |
| Public Drive customer files | 0 |
| Client-side secret exposure | 0 |
| Duplicate webhook durable rows | 0 |
| Duplicate Drive documents from retry | 0 |

Provider writes are additionally tested to remain explicitly gated.

## Migration order

Apply each migration atomically and run its matching readback before moving to the next:

1. 20260918_line_document_media_activation_v1_<lane>.sql
2. 20260918_line_delivery_activation_v1_<lane>.sql
3. 20260918_line_content_intelligence_v2_<lane>.sql
4. 20260918_line_privacy_retention_v2_<lane>.sql

UAT only, after all four:

5. 20260918_line_journey_e2e_uat_readback.sql

The Journey E2E script starts a transaction and ends with ROLLBACK. It proves Website Content/Tool → LINE journey → material/qualification → Lead → Advisor Case → Implementation → Won → Revenue → Content Intelligence using synthetic values only, without leaving test customer rows behind.

Never run the synthetic E2E writer on Production.

## Human Gates

This release does not authorize or perform:

1. adding/reading the LINE channel access token through AI/MCP;
2. enabling outbound/Rich Menu/media provider writes before the token and explicit gates are configured by the owner;
3. Google Drive OAuth/consent;
4. irreversible customer deletion;
5. V1 key retirement;
6. final human mobile LINE UAT.

## Rollback

Application rollback:

- revert the reviewed merge or restore the previous verified Web/Admin deployment;
- keep provider write gates off.

Database rollback:

- migrations are additive; do not drop tables/functions automatically;
- disable new application consumers and retain additive state for audit/reconciliation;
- destructive schema/data rollback requires separate approval.

Provider rollback:

- Rich Menu/provider writes are not part of automatic migration rollback;
- if a future provider activation becomes ambiguous, reconcile before retry/provider cleanup.

No rollback path may truncate private queues, delete audit history, restore a stale database snapshot over newer customer state, or retire V1 keys.

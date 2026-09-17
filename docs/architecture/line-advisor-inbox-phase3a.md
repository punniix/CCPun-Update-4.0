# LINE Advisor Inbox — Phase 3A

Phase 3A adds a read-only Advisor Inbox to the existing CCPun Admin Control Plane. It does not create a second CRM, a new runtime credential, or a new public surface.

## Route ownership

- `/dashboard/inbox/` — owner-only LINE Advisor Inbox (`advisor:read`).
- `/dashboard/reviews/` — existing SEO human-review workflow moved here without changing its decision model.
- `/api/admin/line/inbox/` — authenticated read-only safe summary API.
- Legacy `/snt-admin/reviews/` resolves to `/dashboard/reviews/`.

## Data boundary

Neon remains the owner of LINE identity, conversations, leads and advisor cases. Phase 3A adds only `private_line.advisor_inbox_safe`.

The safe view exposes:

- internal `lead_id`, `advisor_case_id`, and generated `customer_code`;
- lead stage and journey;
- material-received flag;
- conversation status, unread count and last activity time;
- advisor-case priority and assignment;
- latest message type/status/needs-human signal;
- operational update time.

It does **not** expose message content, LINE/provider identifiers, provider-message identifiers, ciphertext, nonces/auth tags, document/file identifiers, customer contact fields, or financial/health payloads.

`ccpun_admin_runtime` receives `USAGE` on `private_line` plus `SELECT` on the safe view only. It receives no direct grants on the underlying `private_line` base tables. `ccpun_line_ingress` keeps its existing ingest-function boundary and is explicitly denied `SELECT` on the safe view.

The Phase 3A migration adds a new row to `private_line.schema_migration` but does not modify `private_line.system_identity`. The base ingress identity must remain pinned to `20260917_private_line_runtime_v1_*` because `private_line.ingest_line_event(jsonb)` validates that identity.

## Runtime boundary

The Admin reader reuses `CCPUN_ADMIN_DATABASE_URL` and the existing `ccpun_admin_runtime` role. It delegates project/branch/database/role/host/SSL validation to the existing Admin operations runtime guard. No LINE encryption key, identity-HMAC key, Channel Secret, or Channel Access Token is present in the Admin reader.

The reader fails closed and distinguishes an unavailable runtime/view from an empty inbox. It never falls back to raw tables.

## Human boundary

Phase 3A is deliberately read-only. It does not enable:

- transcript/decryption;
- outbound LINE replies;
- case-stage mutation;
- document/media retrieval;
- journey automation;
- AI summaries or recommendations.

Those capabilities require separate private contracts and human-action gates in later phases.

## Release sequence

1. Run deterministic migration parity/security tests and Admin typecheck/tests.
2. Apply the additive migration to UAT Neon first and run the UAT readback.
3. Open an `admin/*` PR and require Foundation/Shadow CI plus Admin Preview.
4. Verify `/dashboard/inbox/` in Admin Preview shows a distinct unavailable/empty/data state and does not expose raw data.
5. After review and merge, apply the same checksum-locked migration to Production Neon and run the Production readback.
6. Verify Production Admin reads only the safe view; Public Web remains unchanged.

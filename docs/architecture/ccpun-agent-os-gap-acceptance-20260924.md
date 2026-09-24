# CCPun Agent OS v1 — Gap and Acceptance Matrix

Date: 2026-09-24 Asia/Bangkok
Work branch: admin/agent-os-foundation-20260924

This matrix separates High-effort architecture/foundation work completed in Chat from straightforward provider/UI/workflow implementation that can be handed to Codex later. It is intentionally explicit so Codex does not re-design the system.

## Status legend

- FOUNDATION DONE — contract / safety rule / core code exists in this branch.
- EXISTING — already present before Agent OS.
- IMPLEMENT NEXT — architecture is locked; remaining work is wiring/UX/provider implementation.
- ACTIVATION GATE — must be verified live before enabling.
- OUT OF SCOPE — do not add in v1.

## Capability matrix

| Capability | Status | Current decision |
| --- | --- | --- |
| Canonical Agent OS architecture | FOUNDATION DONE | docs/architecture/ccpun-agent-os-v1.md |
| Verified current-state receipt | FOUNDATION DONE | docs/architecture/ccpun-agent-os-current-state-20260924.md |
| Generic Runtime Job vocabulary | FOUNDATION DONE | Safe cross-system states and IDs |
| Runtime Job durable ledger migration | FOUNDATION DONE / NOT APPLIED | Source + readback only |
| Append-only runtime event timeline | FOUNDATION DONE / NOT APPLIED | Metadata only |
| Payload-bound idempotency | FOUNDATION DONE | SHA-256 digest, no payload persistence |
| Optimistic row-version updates | FOUNDATION DONE | Stale writers receive conflict |
| n8n safe runtime create/update bridge | FOUNDATION DONE / DISABLED | Dedicated token and feature gate |
| Operations Jobs integration | FOUNDATION DONE | Agent OS becomes third job source |
| Runtime detail API | FOUNDATION DONE | Admin-authenticated metadata only |
| Runtime loading/status UX | FOUNDATION DONE | Polling, elapsed, p50/p90, heartbeat, timeline |
| Fake percentage progress | PROHIBITED | Use real stages or indeterminate state |
| CRM Today / Action Center rules | FOUNDATION DONE | Deterministic, explainable |
| Dashboard CRM summary | FOUNDATION DONE | Permission-aware advisor:read |
| Human Capture safety contract | FOUNDATION DONE | Fact / inference / recommendation separated |
| Universal Capture Inbox UI | IMPLEMENT NEXT | Manual + AI-assisted entry |
| Manual fallback for CRM changes | EXISTING PARTIAL / IMPLEMENT NEXT | Existing case controls reused; generic capture UI pending |
| Historical insight time windows | FOUNDATION DONE | 30/90/180/1y/YTD/all/custom |
| Period-over-period comparison | FOUNDATION DONE | Previous period/year/custom |
| Historical message extraction pipeline | IMPLEMENT NEXT | Must run private/local first |
| Customer Insight aggregate UI | IMPLEMENT NEXT | No raw transcript in generic analytics |
| Local AI privacy routing | FOUNDATION DONE | Local-first, raw conversation prohibited from Cloud |
| Sanitized Cloud AI provider adapter | IMPLEMENT NEXT | Provider not selected in foundation |
| Cloud allowlist-first policy | FOUNDATION DONE | Direct identifiers prohibited |
| n8n workload scheduling policy | FOUNDATION DONE | Local AI concurrency = 1 |
| Heavy-job collision detection | FOUNDATION DONE | No two heavy jobs by default |
| Live n8n schedule mutation | ACTIVATION GATE | Live instance not readable from current Chat tools |
| Google Calendar projection contract | FOUNDATION DONE | CRM is truth; Calendar is projection |
| Google Calendar OAuth + sync workflow | IMPLEMENT NEXT | Requires selected calendar and credential |
| External Calendar edit handling | FOUNDATION DONE | Reconcile, never silently overwrite CRM |
| Apple Shortcut authority policy | FOUNDATION DONE | Scoped token, low-consequence actions only |
| Apple Shortcut file / iOS configuration | IMPLEMENT NEXT | Personal front door only |
| Generic Automation Gateway | FOUNDATION PARTIAL | Command policy + auth patterns done; action handlers remain |
| LINE customer runtime | EXISTING | Direct LINE API/Webhook + private CRM |
| LINE OA MCP policy | FOUNDATION DONE | Read/operator actions allowed; writes gated |
| LINE OA MCP hosted integration | IMPLEMENT NEXT / ACTIVATION GATE | HTTP auth/read-only smoke first |
| Marketing → Qualified → Revenue data model | EXISTING PARTIAL | Attribution/business intelligence already present |
| Closed-loop Growth dashboard | IMPLEMENT NEXT | Reuse existing dimensions |
| CRM retention / renewal queue | IMPLEMENT NEXT | Deterministic rules first |
| Lead AI scoring | NOT REQUIRED | Prefer explainable rules |
| Backup automation | UNPROVEN | Referenced workflow absent from Production branch |
| Restore drill | ACTIVATION GATE | Required before backup ready status |
| New CRM SaaS | OUT OF SCOPE | Reuse Neon private CRM |
| Vector DB | OUT OF SCOPE | No proven need |
| New queue SaaS | OUT OF SCOPE | Reuse Neon/n8n |
| Observability SaaS | OUT OF SCOPE | Reuse Admin/Vercel/n8n |
| Additional Vercel/Neon/Sanity projects | OUT OF SCOPE | No-new-spend contract |

## Required E2E acceptance scenarios

### A. Runtime / n8n

1. n8n creates a Runtime Job with a unique idempotency key and payload digest.
2. Admin shows the job without exposing the payload.
3. Replaying the same idempotency key + same payload digest returns the same durable job.
4. Reusing the idempotency key with a different digest returns conflict.
5. n8n updates stage/heartbeat with expected row version.
6. A stale row version returns conflict without overwriting the current state.
7. Each accepted state update appends one event timeline row.
8. Terminal jobs cannot be reopened by a stale/background update.
9. Admin runtime page polls only while non-terminal.
10. p50/p90 is shown only when at least five historical samples exist.
11. A stale heartbeat is visually distinct from slow but alive.
12. n8nExecutionId can be used to trace the exact execution.

### B. Privacy

1. Generic job ledger rejects unknown/raw payload fields.
2. Runtime event table contains status metadata only.
3. Raw conversation always fails Cloud routing policy.
4. Secrets always fail Cloud routing policy.
5. Health/financial/customer-sensitive context reaches Cloud only after sanitization, exact allowlist and explicit workflow opt-in.
6. AI inference cannot overwrite a confirmed customer fact automatically.
7. Public Sanity datasets receive no customer-private data.

### C. Manual Capture

1. Owner can enter data manually with AI completely unavailable.
2. Local AI may propose destinations/fields.
3. UI labels each proposal as Fact, Inference or Recommendation.
4. Customer-private writes require owner confirmation.
5. Rejected proposals create no CRM mutation.
6. Capture source can be Admin or Shortcut without changing the destination contract.

### D. CRM Today

1. Role without advisor:read sees no CRM Today counts.
2. Role with advisor:read can see safe aggregate action counts.
3. Human-handoff and overdue follow-up appear as urgent.
4. New unread lead and document-ready appear as high priority.
5. Completed cases do not appear.
6. The reason for every suggested action is human-readable.

### E. Historical Customer Intelligence

For each of 30 days, 90 days, 180 days, 1 year, YTD, all retained history and custom, verify the exact time boundary.

Then verify:
1. Previous-period comparison has equal duration.
2. Previous-year comparison shifts calendar year.
3. All never bypasses retention/deletion policy.
4. Raw transcript is not persisted into the generic insight mart.
5. Aggregate insight separates observed signal, interpretation and suggested action.

### F. Calendar

1. CRM Task creates privacy-safe Calendar title.
2. Event contains Admin reference, not health/financial/customer detail.
3. CRM row-version change updates the Calendar projection.
4. External Calendar modification enters reconciliation.
5. Calendar deletion does not automatically delete the CRM task.
6. Calendar outage does not prevent manual CRM follow-up.

### G. Apple Shortcut

1. Missing/disabled Shortcut token fails closed.
2. crm.capture, system.health and similar allowed actions can enter the Gateway.
3. Shortcut cannot request Production deploy, customer destructive delete, secret rotation or database migration.
4. Shortcut loss/revocation does not affect Admin authentication.

### H. LINE MCP

1. Read-only OA status/quota/insight actions can run without customer transcript access.
2. Broadcast/send/provider mutation cannot bypass the CCPun Human Control Plane.
3. MCP receives no private CRM transcript or encryption key.
4. LINE inbound archive remains the existing direct LINE webhook/private CRM path.
5. MCP outage does not break customer inbound messaging.

### I. VPS workload

1. Ollama concurrency remains 1.
2. Two heavy batch jobs that overlap are flagged before activation.
3. Realtime webhook/CRM jobs are not blocked by planned batch scheduling.
4. Interactive Local AI is prioritized ahead of queued batch after the current inference completes.
5. CPU/RAM/queue-age evidence is collected before any VPS upgrade.

### J. Recovery

1. Backup scheduler existence is verified from a live authoritative source.
2. Backup artifact integrity is checked.
3. Restore is rehearsed in an isolated recovery path.
4. Recovery evidence is recorded with date/result.
5. Application rollback never truncates customer queues or audit history.

## Activation order

1. Foundation CI green.
2. Admin Preview build READY.
3. Review PR diff for privacy/route boundary.
4. Rehearse Agent OS runtime migration on a temporary/UAT-safe branch.
5. Run readback and synthetic idempotency/event tests.
6. Apply to active UAT only after explicit approval.
7. Configure Agent OS n8n token in UAT; keep Production gate off.
8. Patch one existing n8n test workflow to emit runtime metadata.
9. Prove Admin live runtime UI end-to-end in UAT.
10. Only then plan Production migration/activation.
11. Calendar, Shortcut, Cloud AI and LINE MCP remain separate activation batches.

## Codex handoff rule

Codex should not redesign the contracts above.

For each remaining task it should:
1. audit the exact current state of that narrow scope;
2. reuse the contracts and existing data owners;
3. make the smallest implementation change;
4. add targeted tests;
5. run existing foundation gates;
6. stop before Production mutation unless explicitly authorized.

If a live system contradicts this foundation, report the contradiction and preserve evidence before changing the architecture.

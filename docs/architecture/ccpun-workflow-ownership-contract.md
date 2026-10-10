# OWNER DECISION OVERRIDE — CCPun Routine-first n8n, 2026-10-10

Target design: every CCPun routine/background/scheduled task is n8n-orchestrated with visible named nodes and safe execution telemetry. Admin handles input, output, validation, authentication and human approval, not hidden background workflow execution. Private compute and narrowly scoped provider executors perform work requested by n8n. Existing production private timers stay the accepted single-owner runtime until a controlled, tested, one-by-one handoff to n8n scheduling; no parallel schedulers. See the Routine-first section at the end for observability and security constraints.

# CCPun Workflow Ownership Contract — Phase 0

Status: design contract for a future isolated UAT implementation. No application, automation or production behavior is changed by this document.

## Goals
- Reuse current CCPun Admin, Neon, Sanity, n8n and private compute foundations.
- Assign one authoritative owner for each durable datum and side effect.
- Keep long-running tasks asynchronous, observable, safely repeatable and reviewable by a human.
- Do not introduce a second workflow publisher or a second canonical CRM.

## Architectural boundaries
1. **Next.js Admin:** human UI, authentication, RBAC, input validation, approval, and operational control.
2. **Neon:** canonical operational job/event state, safe status projections, and private business-data persistence.
3. **Sanity:** editorial/public content ownership and drafts. It must not become a private customer datastore.
4. **n8n:** orchestration of approved public-safe tasks, provider synchronization, routine reports and notifications.
5. **Private compute:** processing for sensitive or high-cost workloads, including OCR and Local AI.
6. **Existing private workers:** retain sole execution ownership for article scheduling, social publication and LINE Rich Menu reconciliation.

## Four deployment lanes
- Web Production and Admin Production use Production-scoped services and credentials.
- Web UAT and Admin UAT use separately provisioned UAT-scoped services and credentials.
- No cross-environment fallback, credential reuse or accidental Production side effects.
- UAT public pages remain non-indexable; Production public content retains its SEO controls.

## Workflow lifecycle
Use an approved, versioned contract for each workflow:
- Stable workflow key and canonical business owner
- Intent, authorized request origin and execution identity
- Data classification and allowed payload fields
- Queue class, correlation ID, idempotency key and maximum attempts
- Durable status transitions and reconciliation when external outcomes are ambiguous
- Human approval for consequential or customer-facing actions
- Safe logs, heartbeat, incident alerts and rollback instructions

Do not treat enabled workflow status as proof of working integration. A workflow is ready only after an authenticated end-to-end acceptance test.

## Privacy for OCR and customer interactions
- Customer-private images and raw conversations must remain in an approved private processing boundary.
- General n8n workflows, generic job records, public content stores and logs must not receive raw sensitive material.
- OCR output is a proposal requiring owner review; no customer record mutation occurs before confirmation.
- Preserve encryption, retention, deletion and audit controls from the existing private CRM architecture.

## Phase 1 acceptance contract (not enabled in Phase 0)
- Reuse the existing durable job/event foundation.
- Start with isolated UAT transport and a public-safe synthetic fixture.
- Verify authorized request, unauthorized rejection, duplicate handling, timeout, bounded retry, provider outage, ambiguity reconciliation and audit receipt.
- Establish truthful monitoring: non-2xx upstream responses must not appear healthy.
- Review any editorial or CRM write boundaries before Production promotion.
- Protect manual fallbacks and allow one-at-a-time rollback.

## Change-control rules
- Keep Production and operational workers unchanged until separate accepted UAT evidence and explicit approval.
- Do not automatically publish content, send customer messages, run private data experiments, or rotate service secrets during design work.
- This public contract contains only architectural rules. Detailed integration inventory, configuration evidence and security findings remain in a private owner-held handoff, not this repository.

## Owner decision — n8n-first OCR orchestration & node-level observability (2026-10-10)

**Locked objective:** Admin serves Input / Output / owner Review. n8n is the mandatory workflow orchestrator for EVERY OCR request; the Private VPS owns only the OCR/Local AI computation which must be started from an n8n Node. Admin must not start OCR compute directly or silently bypass n8n if a workflow is unavailable.

**Why n8n is mandatory:** the owner wants a visible, node-by-node workflow, showing progress, timing, execution history, retries, and understandable error localization. A single opaque Next.js OCR API call fails this product requirement even if it processes correctly.

### Visible n8n workflow steps (logical Nodes)
1. Receive authenticated job trigger from the Admin server; reference only, not raw image.
2. Validate job environment, scope, request identity, idempotency and data classification.
3. Claim the canonical Neon job (through a narrow authenticated API).
4. Invoke Private OCR on the VPS with short-lived scoped file handle via n8n HTTP Request Node. Image bytes stay in private temporary encrypted staging, not in n8n node payload.
5. Poll/wait for OCR completion with bounded timeout; record per-stage duration, attempts, classification and worker version.
6. Validate output status/quality and branch on low confidence / failure. Raw OCR text remains in protected encrypted storage; n8n sees only safe result metadata.
7. Record durable job status and safe error receipts via authenticated callback; mark AWAITING_REVIEW when ready.
8. Admin reads owner-authorized private results, displays/edits text and receives human approval. CRM write happens only after approval via audited private API.
9. n8n marks completion or safe reconciliation outcome with correlation and execution references; stale retries cannot duplicate CRM writes.

### Observable diagnostics, without private leakage
- Each n8n Node has a descriptive name, responsibility, expected input/output schema and explicit failure branch.
- Show per-job jobId/correlationId, workflow version, n8n execution ID, stage, state, timestamp, duration, attempts, HTTP status, normalized error category and retry outcome.
- n8n execution data/history may be retained only when ALL node inputs and outputs are proven scrubbed of sensitive payloads, secrets and raw private OCR data. Apply short retention and access control. Otherwise use safe metadata receipts in Neon and keep raw n8n executions unavailable.
- Never log screenshot bytes, transcript text, customer identifier, health/financial data, signed download capability URLs or credentials. Use opaque references that cannot be reused after expiry.
- Treat upstream HTTP 401/403/429/5xx and timed-out OCR Node as actual failed/degraded states, never an n8n green Succeeded without a verified success receipt.

### Failure and security gates
- If n8n is down, the job remains QUEUED/DEGRADED in Neon; Admin displays the problem but NEVER executes OCR directly.
- Keep Production/UAT n8n webhooks, credentials and private staging isolated.
- Require an approved short-lived private transfer/staging mechanism before implementing; the Admin may perform secure input validation/staging, but no OCR processing.
- UAT acceptance must show the exact n8n Node execution path and readable safe logs across success, bad input, 401, worker crash, timeout, duplicate submission, retry and human approval.
- Current CCPun Private Chat Screenshot OCR workflow stays inactive until UAT acceptance. No existing Production pipeline is changed by this planning correction.

## Routine-first n8n target contract (owner clarified 2026-10-10)

- All routine work belongs to an n8n orchestration workflow: OCR, Local AI, content scheduling, approved social publication, LINE Rich Menu reconciliation, customer follow-up, exports, reporting, metrics collection, monitoring and scheduled backup coordination.
- Each workflow shall expose comprehensible named nodes, execution identifiers, per-node timing, sanitized inputs/outputs, retry/error branches and a verified final provider receipt. Unauthorized or failed upstream responses may never be reported as healthy success.
- Admin is the input/output, status summary and human-approval control surface. It must not host shadow schedulers or perform OCR inference in API handlers.
- Private VPS remains the processor for OCR and sensitive Local AI. Routine execution is dispatched by n8n using scoped job references and a restricted gateway, not raw customer data transported through n8n.
- Real-time authentication, signed third-party webhook verification, synchronous CRM mutations and human approvals remain protected server APIs. Their event-driven routine follow-ups enter n8n asynchronously, and realtime security boundaries stay operational when n8n is unavailable.
- Production private Article Scheduler, Social and LINE Rich Menu timers are the current single-executor baseline, not an exemption from the target routine-first design. They must be replaced only through a tested isolated UAT workflow and exclusive cutover; never schedule the same side effect from both VPS and n8n.
- Execution history may contain only allowlisted safe metadata. Raw screenshots, customer chat, health/financial data, credentials and signed private download links stay out of n8n logs and cloud sinks.
- n8n outages leave queued routine work visible and retryable through the durable job ledger; do not silently invoke a hidden Admin/VPS alternative coordinator.
- No automatic Production code changes, credential rotation, published content changes or executor cutover are authorized by this documentation.

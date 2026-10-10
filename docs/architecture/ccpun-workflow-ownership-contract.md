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

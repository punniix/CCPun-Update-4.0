# CCPun Ecosystem Control Plane Manifest

Last evidence refresh: 2026-09-19. This manifest records the ownership and mutation boundaries used by the `v4-production` promotion. It supplements `platform-data-architecture.md`; it does not authorize destructive cleanup, provider activation, customer messaging, or private-data export.

## Canonical ownership

| Domain object | Canonical owner | Notes |
|---|---|---|
| Customer | Neon `private_line` | Extend the existing customer and provider-identity model; do not create a second CRM. |
| Lead | Neon `private_line` | A navigation or anonymous journey event is not a lead. Lead creation requires the existing identity/message qualification boundary. |
| Conversation and raw message | Neon `private_line` | Private data. Never publish to Sanity, logs, CI artifacts, public automation, or cloud AI by default. |
| Advisory case | Neon `private_line` | Existing advisor-case model remains the system of record. |
| Consent / contact permission | Neon `private_line` | Append-only evidence events; current permission is derived state. |
| Journey definition | Neon `private_line` for executable definitions | Editorial explanation and public journey content may remain in Sanity. Stable IDs are `life_health_policy_review`, `motor_quote_review`, `investment_before_you_act`, and `human_handoff`. |
| Journey instance | Neon `private_line` | Customer-specific lifecycle state is private operational data. |
| Content and editorial SEO | Sanity | Draft/publish workflow, article content, author/category data, and content-attached SEO fields. |
| Editorial curation | Sanity | Article-card order and non-sensitive presentation curation remain here. |
| Provider desired state | Neon `ccpun_admin` Control Plane | Single authoritative writer. Persisted legacy Sanity fields are ignored, not deleted. |
| Provider command / approval / operation | Neon `ccpun_admin` Control Plane | Versioned commands, idempotency, lease, human approval, reconciliation and audit. |
| Provider actual state | Neon `ccpun_admin` Control Plane | Recorded only from normalized provider readback; never inferred from desired state. |
| Analytics | Neon | Private/customer analytics stay private; social/provider metrics stay in the existing operational schemas. Publish only intentionally non-sensitive aggregates. |
| AI-derived insight | Neon private plane (future capability) | Separate from confirmed facts, source-linked, validated, reviewable and never allowed to overwrite confirmed customer data directly. |
| Code and migrations | GitHub | Reviewed source is the promotion artifact. |
| Runtime configuration | Vercel | Lane-scoped values only; the Public Web must not receive provider or private DB credentials. |

## Control contract

Admin, ChatGPT and Codex use the same authenticated command boundary:

1. Auth.js human session and owner authorization.
2. Same-origin request validation.
3. Typed command containing resource, expected version and idempotency key.
4. Human approval for consequential provider changes.
5. Durable desired state and command audit in Neon.
6. A single reconciler claims a bounded lease.
7. Provider mutation begins only after the operation is frozen with a pre-mutation actual-state snapshot.
8. Full normalized provider readback verifies the outcome.
9. Ambiguous outcomes remain `reconciliation_required`; they are never blindly replayed.
10. Rollback restores the approved previous provider reference. `hold` only stops reconciliation and is not rollback.

Agents receive neither provider secrets nor database-owner credentials. n8n/Make may orchestrate authenticated commands, but neither is a source of truth.

## Runtime boundaries

| Surface | Allowed responsibility | Prohibited responsibility |
|---|---|---|
| Vercel Web | Public pages, FHC, Critical Illness Planning, Investment Allocation, public content reads and bounded anonymous journey events | LINE Channel Access Token, DB owner credentials, customer/admin reads, provider writes |
| Vercel Admin | Human Control Plane, safe private read models, authenticated commands and bounded cron reconciliation | Anonymous mutation, owner credential fallback, direct un-audited provider write |
| Sanity | Editorial content, content SEO, article-card curation and non-sensitive configuration | CRM, raw conversations, permissions, provider desired/actual state, command audit |
| Neon | Private customer/operational state, Control Plane state, audit and analytics | Editorial body authoring |
| n8n | Private orchestration and future privacy-scoped local-AI workflow | Durable truth, independent customer/provider state |

## Business capability boundaries

- Life/Health supports AIA plus planning tools and content.
- Non-life supports Fairdee; motor is the acquisition focus while pet, home, travel and accident remain first-class architecture categories.
- Investment is platform-neutral across Phillip, Maybank, Webull, existing Finnomena capabilities and SEC Thailand Open Data. No broker is the canonical customer or portfolio model.
- Tax remains planning context/content in this release; no generic tax calculator is introduced.
- Public tools and their formulas are unchanged by this architecture promotion.
- CCPun Website 4.3 visual, accessibility, mobile-first and performance contracts remain unchanged.

## Promotion and rollback

Promotion order is: evidence refresh → temporary-branch migration proof → UAT migration/readback → CI and Preview verification → Production migration/readback → reviewed SHA merge → Vercel deployment → live read-only QA → runtime-error review. Provider activation is a separate human-approved command and is never a deployment side effect.

Database changes in this release are additive. Rollback is therefore application rollback to the prior reviewed SHA plus `hold` for provider reconciliation. Do not drop new tables, columns, views or legacy Sanity fields during incident response. Forward-fix schema defects after preserving evidence.

## Local AI gate

The repository and current runtime inventory contain no proven private local-model endpoint or private worker boundary. A Local AI pilot is therefore blocked from Production in this wave. When that environment exists, the required flow is scoped private retrieval → local model → schema-validated structured insight → advisor review. Cloud escalation additionally requires data minimization, de-identification, residual-risk review and explicit workflow opt-in; raw PII and raw conversations remain prohibited.

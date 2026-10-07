# CCPun Platform Data Architecture

Last provider-placement re-baseline: 2026-10-07. Data-ownership rules remain authoritative; current runtime placement and release observations are defined by [`ccpun-runtime-baseline-20261007.md`](./ccpun-runtime-baseline-20261007.md).

> **Current runtime placement:** the four canonical browser-facing lanes are Hostinger lanes. Hostinger Cloud Startup is the application/front-plane owner for Web and Admin; the Hostinger VPS is the automation/private-compute plane for n8n, Local AI/Ollama, OCR and approved private workers. Vercel is rollback/history compatibility only and is not a required runtime dependency. `lib/runtime/deployment-lanes.mjs` is the machine-readable lane authority.

This is the canonical data/runtime ownership map after the Web/Admin Vercel retirement. The current operating constraint is **no unnecessary additional infrastructure spend**: reuse the approved Hostinger, Sanity and Neon resources unless a separately approved migration proves a new resource is required.

## Mental model

```text
GitHub = code, tests, migrations and release history
Hostinger Cloud Startup = browser-facing Web/Admin application plane
Hostinger VPS = n8n + Local AI/Ollama + OCR + approved private workers
Sanity = editorial content and publishing workflow
Neon = private operational state
Google Drive = private long-lived documents and source media
Auth.js = application authentication
Vercel = rollback/history compatibility only; no required live dependency
```

One durable datum has one owner. Do not mirror operational state across Sanity and Neon.

## Runtime topology

| Surface | Runtime owner | Source root | Data plane |
|---|---|---|---|
| Public Web Production (`ccpun.com`) | Hostinger Cloud Startup | `apps/web` | published Sanity `kyfxgjnq/production` reads |
| Public Web UAT (`test.ccpun.com`) | Hostinger Cloud Startup | `apps/web` | Sanity `ccb9lnw5/uat` |
| Admin Production (`admin.ccpun.com`) | Hostinger Cloud Startup | `apps/admin` | authenticated Sanity Production + Production Neon |
| Admin UAT (`admin-test.ccpun.com`) | Hostinger Cloud Startup | `apps/admin` | Sanity `ccb9lnw5/uat` + UAT Neon |
| Local UAT | loopback | Admin monorepo | UAT data planes only |
| Local Production Draft lane | loopback | Admin monorepo | separately guarded Production Draft operations |
| Private Local-AI / worker plane | Hostinger VPS | `workers/local-ai` plus reviewed worker entry points | encrypted Neon job queue + private Ollama/OCR/n8n paths |

The retained Vercel projects are not runtime owners. They may remain as bounded rollback evidence until destructive retirement is separately approved. Do not create a new Vercel project or reintroduce Vercel as a dependency to add an Admin feature.

Web and Admin share one repository but deploy as separate Hostinger application roles. Shared changes require regression coverage for every affected role.

## Sanity steady state

| Project | Dataset | Purpose |
|---|---|---|
| `kyfxgjnq` | `production` | live editorial content, Draft/Published workflow and public content SEO fields |
| `ccb9lnw5` | `uat` | Admin Preview/UAT editorial fixtures and safe test content |
| `kyfxgjnq` | `uat` | legacy rollback evidence; runtime denied |
| `ccb9lnw5` | `recovery` | non-routine recovery placeholder/evidence; not a normal runtime lane |

The Sanity trial has ended and the architecture must remain safe on the current Free-plan steady state. On 2026-09-17 the repository's unauthenticated API/CDN privacy probe was rerun successfully: Production exposed published editorial controls while operational documents/drafts/versions were not anonymously readable; active UAT exposed no articles, operational documents, drafts or versions; recovery exposed no editorial or operational content.

The probe is a regression boundary, not permission to store confidential operational data in Sanity. Keep customer data, credentials, private audit history, execution jobs, provider state and other confidential operational records out of Sanity.

Production editorial document types include `article`, `author` and `category`. Existing regulated review/compliance states remain product contracts.

Legacy Sanity `auditLog`, `researchSnapshot`, `seoSuggestion` and provider snapshot documents are rollback/compatibility evidence. Runtime code must not create new operational records of those types. Their schemas may remain registered while compatibility evidence exists, but Studio policy hides system types from normal authoring. Deletion requires a separate inventory, parity check, rollback window and explicit approval.

## Neon steady state

### UAT

- project: `young-term-47483330`
- branch: `br-crimson-mouse-az7ajkv8`
- database: `neondb`
- Admin runtime role: `ccpun_admin_runtime`
- Social runtime role: `ccpun_social_runtime`
- Local-AI worker role: `ccpun_local_ai_runtime` (created `NOLOGIN` until lane activation)

### Production

- project: `lively-bar-43618798`
- branch: `br-long-resonance-b3ys5xrv`
- database: `neondb`
- Admin runtime role: `ccpun_admin_runtime`
- Social runtime role: `ccpun_social_runtime`
- Local-AI worker role: `ccpun_local_ai_runtime` (created `NOLOGIN` until lane activation)

All runtime roles are least-privilege roles. Owner/backfill credentials are migration-only and must not become runtime fallback credentials.

`ccpun_admin` owns private Control Plane state such as audit events, research snapshots, SEO suggestion lifecycle and article scheduling. `ccpun_social` owns social execution/provider state, jobs, retries, sync state, media operational metadata and metrics. Neither owns Article bodies, Authors, Categories or public editorial SEO fields.

`ccpun_admin` also owns the Local-AI job ledger. Inputs are AES-256-GCM envelopes; only the dedicated VPS worker can claim and decrypt them. n8n and Admin read models may consume only validated outputs and non-sensitive job metadata. The exact boundary is defined in `docs/architecture/local-ai-enclave-20260919.md`.

The runtime verifies deployment/data identity and migration ledgers before privileged operations. Unknown or mismatched identities fail closed.

UAT and Production may use lane-specific migration version names, so equality of ledger strings is not the parity contract. **Required runtime capabilities are the parity contract**: if Production code depends on a table, column, view or migration capability, UAT must support that capability before that feature is considered Preview-ready.

As of the 2026-09-19 promotion, UAT and Production each expose 34 `ccpun_social` relations. Table column signatures and normalized view-definition hashes match across the two projects. UAT now supports the clean Marketing Mart capability used by Production; Admin System Health must still fail closed to `raw-preview-fallback` or `blocked` if a future capability check detects drift.

The original guarded Marketing Mart source contained a parser-incompatible procedural block. The recovered UAT migration preserves the clean-data contract in tool-compatible SQL and was applied only after prerequisite/checksum guards and temporary-branch proof. Future changes must continue through the explicit UAT-first migration approval flow; direct unreviewed DDL remains prohibited.

## Authentication

Auth.js + Google OAuth + CCPun allowlist/RBAC is the application authentication authority for `admin.ccpun.com`.

Neon Auth is not an application runtime dependency. Existing empty Neon Auth tables/integration artifacts are treated as retirement candidates only; do not disable or delete them until a full consumer audit and rollback plan are complete.

## Runtime authority

`lib/runtime/deployment-lanes.mjs`, `lib/runtime/deployment-identity.ts` and the Admin environment/data-plane guards own the fail-closed provider/lane boundary. Hostinger identity is explicit; stale Vercel project variables must never be used to make a Hostinger lane valid. Admin operational runtimes additionally require exact Neon identity checks.

Meaningful lanes:

| Environment | Meaning |
|---|---|
| `production-admin` | Hostinger Admin Production |
| `admin-uat` | Hostinger Admin UAT |
| `local-production` | loopback Production Draft lane |
| `local-uat` | loopback UAT lane |
| `production` | Hostinger public Web Production |
| `web-uat` | Hostinger Web UAT |
| `development` | bounded local/development compatibility lane |
| `lab` / `uat` | legacy compatibility labels that fail closed |

### Admin UAT authorization

A deployed Admin UAT runtime must match the approved Hostinger Admin role and immutable UAT data plane:

- `CCPUN_DEPLOYMENT_PROVIDER=hostinger`;
- `CCPUN_DEPLOYMENT_ROLE=admin`;
- `CCPUN_APP_ENV=admin-uat`;
- exact reviewed Git ref/SHA for that UAT release;
- exact Sanity `ccb9lnw5/uat`;
- exact UAT Neon identity and least-privilege role when Neon is required;
- no fake `VERCEL_PROJECT_ID` or `VERCEL_ENV`.

Local feature branches remain local until explicitly packaged into the Admin UAT lane. Wrong provider/role/Sanity/Neon identities fail closed.

### Admin Production authorization

Production remains stricter:

- `CCPUN_DEPLOYMENT_PROVIDER=hostinger`;
- `CCPUN_DEPLOYMENT_ROLE=admin`;
- `CCPUN_APP_ENV=production-admin`;
- Git ref exactly `v4-production` and exact reviewed release SHA;
- Sanity exactly `kyfxgjnq/production`;
- exact configured Production Neon identity/runtime role;
- no Vercel project/environment identity in the accepted Hostinger runtime.

## Credential contract

- Public Web has no Admin write credentials or private operational DB credentials.
- Production and UAT credentials are distinct and scoped to their lanes.
- Read credentials never fall back to write credentials.
- Owner/backfill DB credentials never become runtime fallbacks.
- Credential values do not appear in source, reports or logs.
- Runtime code must not discover or select a higher-privilege credential automatically.
- Do not bulk-rename or delete provider variables, including retained Vercel rollback variables, without a consumer inventory.

## Data ownership

| Data | Owner |
|---|---|
| Published/Draft editorial content | Sanity |
| Public SEO fields attached to content | Sanity |
| Private research snapshots | Neon `ccpun_admin` |
| Control Plane audit | Neon `ccpun_admin` |
| SEO suggestion lifecycle | Neon `ccpun_admin` |
| Article scheduling operational state | Neon `ccpun_admin` |
| Social copy/human editorial approval where already modeled | Sanity |
| Social execution, provider IDs, retries, metrics and sync cursors | Neon `ccpun_social` |
| Private strategy/research documents | Google Drive |
| Long-lived source media | Google Drive |
| Authentication/session authority | Auth.js |
| Application code and migration source | GitHub |
| Deployment/runtime configuration | Hostinger for canonical Web/Admin; VPS service configuration for private workers; Vercel retained only as rollback/history compatibility |
| Local model weights and ephemeral inference memory | Hostinger VPS Private Local-AI Enclave |
| Local-AI encrypted job state and validated output | Neon `ccpun_admin` |

## No-new-spend contract

Normal Admin feature development must reuse the current resources. Do not automatically provision:

- another hosting project/service when the approved Hostinger lane can carry the feature safely;
- another Sanity project/dataset for each feature;
- another Neon project/branch for each PR;
- another auth service;
- another queue/worker/storage service when current Hostinger VPS, n8n, Neon and Drive capabilities suffice.

Admin UAT releases share the existing UAT data planes. Synthetic or namespaced test records should be used when parallel work could collide.

## Extension contract

New or forked Admin features must follow `docs/architecture/admin-platform-extension-contract.md`. In particular, external SDK code must adapt to CCPun Auth/RBAC, API routes and data owners rather than importing upstream deployment/auth/database assumptions wholesale.

## Change order

1. verify the current Production and UAT baseline;
2. make the smallest hardening/feature change on a dedicated `admin/*` branch;
3. pass Admin architecture, TypeScript, security and provider boundary tests;
4. test database schema changes on UAT/temporary branches first;
5. verify Sanity anonymous privacy when Sanity-facing code changes;
6. verify Admin Preview and auth/RBAC behavior;
7. apply provider/database mutations only through the approved migration path;
8. promote Production only after gates pass;
9. perform live smoke and runtime-error checks;
10. preserve a rollback path for consequential changes.

Nothing in this document authorizes deletion of legacy data, disabling Neon Auth, deleting environment variables or changing Production database schema without the appropriate migration/approval gate.

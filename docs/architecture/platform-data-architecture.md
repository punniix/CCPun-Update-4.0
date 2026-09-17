# CCPun Platform Data Architecture

Last read-only verification: 2026-09-17.

This is the canonical data/runtime ownership map after the Web/Admin Vercel cutover. The current operating constraint is **no additional infrastructure spend**: keep the existing Vercel projects, Sanity Free resources and Neon projects unless a separately approved migration proves a new resource is required.

## Mental model

```text
GitHub = code, tests and migration source
Vercel Web = public runtime
Vercel Admin = private Control Plane runtime
Sanity = editorial content and publishing workflow
Neon = private operational state
Google Drive = private long-lived documents and source media
Auth.js = application authentication
```

One durable datum has one owner. Do not mirror operational state across Sanity and Neon.

## Runtime topology

| Surface | Runtime | Source root | Data plane |
|---|---|---|---|
| Public Web Production | Vercel `ccpun-web` (`prj_dxwjITkd0av5QiJQv2snUlIASUWu`) | `apps/web` | published Sanity `kyfxgjnq/production` reads |
| Admin Production | Vercel `ccpun-admin` (`prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN`) | `apps/admin` | authenticated Sanity Production + Production Neon |
| Admin Preview/UAT | Vercel `ccpun-admin` Preview | `apps/admin` | Sanity `ccb9lnw5/uat` + UAT Neon |
| Local UAT | loopback | Admin monorepo | UAT data planes only |
| Local Production Draft lane | loopback | Admin monorepo | separately guarded Production Draft operations |

Both Vercel projects use the same GitHub repository and deploy independently. Do not create a third Vercel project or split the repository to add an Admin tool.

Public Web is considered stable after the 2026-09-17 runtime cutover. Admin development should not change public behavior unless a genuinely shared contract requires it; shared changes still require Web regression coverage.

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

### Production

- project: `lively-bar-43618798`
- branch: `br-long-resonance-b3ys5xrv`
- database: `neondb`
- Admin runtime role: `ccpun_admin_runtime`
- Social runtime role: `ccpun_social_runtime`

Both runtime roles are least-privilege application roles. Owner/backfill credentials are migration-only and must not become runtime fallback credentials.

`ccpun_admin` owns private Control Plane state such as audit events, research snapshots, SEO suggestion lifecycle and article scheduling. `ccpun_social` owns social execution/provider state, jobs, retries, sync state, media operational metadata and metrics. Neither owns Article bodies, Authors, Categories or public editorial SEO fields.

The runtime verifies deployment/data identity and migration ledgers before privileged operations. Unknown or mismatched identities fail closed.

UAT and Production may use lane-specific migration version names, so equality of ledger strings is not the parity contract. **Required runtime capabilities are the parity contract**: if Production code depends on a table, column, view or migration capability, UAT must support that capability before the code is considered Preview-ready.

As of the 2026-09-17 audit, `ccpun_admin` capabilities are aligned for current Control Plane usage, while UAT `ccpun_social` is behind Production Marketing Mart capabilities. Catch-up must be tested through the repository migrations on a temporary branch and applied to UAT before future social/marketing features rely on those views.

## Authentication

Auth.js + Google OAuth + CCPun allowlist/RBAC is the application authentication authority for `admin.ccpun.com`.

Neon Auth is not an application runtime dependency. Existing empty Neon Auth tables/integration artifacts are treated as retirement candidates only; do not disable or delete them until a full consumer audit and rollback plan are complete.

## Runtime authority

`lib/admin/environment.ts` owns the fail-closed Vercel/Sanity environment boundary. Admin social runtime adds exact Neon identity checks.

Meaningful lanes:

| Environment | Meaning |
|---|---|
| `production-admin` | private Admin Production |
| `admin-uat` | Admin Vercel Preview/UAT |
| `local-production` | loopback Production Draft lane |
| `local-uat` | loopback UAT lane |
| `production` | public Web Production |
| `web-uat` / `development` | bounded Web/development compatibility lanes |
| `lab` / `uat` | legacy compatibility labels that fail closed |

### Admin Preview authorization

Admin UAT authorization is based on the immutable data plane rather than a historical feature-branch allowlist:

- exact Admin Vercel project;
- Preview environment when Vercel environment is supplied;
- a present Git branch that is not `v4-production`;
- exact Sanity `ccb9lnw5/uat`;
- exact UAT Neon identity and least-privilege role when Neon is required.

This allows future `admin/*` feature branches to use the same safe UAT plane without code changes.

### Admin Production authorization

Production remains stricter:

- `CCPUN_APP_ENV=production-admin`;
- `VERCEL_ENV=production`;
- exact Admin Vercel project identity;
- Git branch exactly `v4-production`;
- Sanity exactly `kyfxgjnq/production`;
- exact configured Production Neon identity/runtime role.

## Credential contract

- Public Web has no Admin write credentials or private operational DB credentials.
- Production and UAT credentials are distinct and scoped to their lanes.
- Read credentials never fall back to write credentials.
- Owner/backfill DB credentials never become runtime fallbacks.
- Credential values do not appear in source, reports or logs.
- Runtime code must not discover or select a higher-privilege credential automatically.
- Do not bulk-rename or delete Vercel variables without a consumer inventory.

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
| Deployment/runtime configuration | Vercel |

## No-new-spend contract

Normal Admin feature development must reuse the current resources. Do not automatically provision:

- another Vercel project;
- another Sanity project/dataset for each feature;
- another Neon project/branch for each PR;
- another auth service;
- another queue/worker/storage service when current Vercel/Neon/Workflow/Drive capabilities suffice.

Admin Preview branches share the existing UAT data planes. Synthetic or namespaced test records should be used when parallel work could collide.

## Extension contract

New or forked Admin features must follow `docs/architecture/admin-platform-extension-contract.md`. In particular, external SDK code must adapt to CCPun Auth/RBAC, API routes and data owners rather than importing upstream deployment/auth/database assumptions wholesale.

## Change order

1. verify the current Production and UAT baseline;
2. make the smallest hardening/feature change on a dedicated branch;
3. pass Admin architecture, TypeScript, security and provider boundary tests;
4. test database schema changes on UAT/temporary branches first;
5. verify Sanity anonymous privacy when Sanity-facing code changes;
6. verify Admin Preview and auth/RBAC behavior;
7. apply provider/database mutations only through the approved migration path;
8. promote Production only after gates pass;
9. perform live smoke and runtime-error checks;
10. preserve a rollback path for consequential changes.

Nothing in this document authorizes deletion of legacy data, disabling Neon Auth, deleting environment variables or changing Production database schema without the appropriate migration/approval gate.

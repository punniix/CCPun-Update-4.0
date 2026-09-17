# CCPun Admin Platform Extension Contract

Verified baseline: 2026-09-17.

This contract defines how new tools, SDKs and forked features are added to `admin.ccpun.com`. It exists to keep the Control Plane easy to extend without creating another runtime, auth system, database authority or paid infrastructure dependency.

## Scope

The extension surface is the existing Admin Vercel project and `apps/admin`. Public `ccpun.com` is frozen for this work except for regression checks when a genuinely shared package changes.

No extension may create a third Vercel project, a new Sanity project, a new Neon project, a second authentication authority, or another source of truth merely for convenience. The steady-state target uses the current Sanity Free, Neon Free and Vercel resources.

## Runtime ownership

| Concern | Owner |
|---|---|
| Admin UI and server runtime | `apps/admin` on Vercel `ccpun-admin` |
| Admin APIs | `/api/admin/<module>/*` |
| Authentication | Auth.js + Google OAuth + CCPun allowlist/RBAC |
| Editorial content, Draft/Published lifecycle and public Article SEO fields | Sanity |
| Private Control Plane operational state | Neon `ccpun_admin` |
| Social execution, provider state, retries, sync and metrics | Neon `ccpun_social` |
| Private long-lived strategy/research files and source media | Google Drive |
| Code, migrations and contracts | GitHub |

An extension must choose one owner for every durable datum. Mirroring the same state into Sanity and Neon is not an integration strategy.

## Route and API contract

- Admin UI belongs under an existing Control Plane area or a new explicitly registered Admin area.
- New APIs use `/api/admin/<module>/*`.
- Do not create new `/api/snt-admin/*` routes. The existing rewrite is compatibility-only.
- Private pages and APIs remain `noindex` and non-cacheable where applicable.
- Admin-only changes must build `ccpun-admin` and allow `ccpun-web` to skip. A true shared change must build both.

## Auth and permission contract

- Auth.js is the only application authentication authority.
- Google OAuth authenticates the human; CCPun RBAC authorizes the action.
- Neon Auth is not an application runtime dependency.
- Every state-changing endpoint requires authentication, permission checks and exact-origin protection.
- Unauthenticated Admin APIs return `401`; authenticated callers without permission return `403`.
- Forked code must not bring its own user/session tables into the application path without a separately approved architecture migration.

## Data contract

### Sanity

Use Sanity for editorial content that belongs to the website publishing workflow: Articles, Authors, Categories, Draft/Published content, social copy/approval content where already modeled, and public SEO fields attached to content.

Do not put secrets, customer records, provider credentials, execution jobs, private audit history or other confidential operational state in Sanity. Legacy Sanity `auditLog`, `researchSnapshot`, `seoSuggestion` and provider snapshot documents are compatibility/rollback evidence; new runtime writes must not target them.

### Neon

Use `ccpun_admin` for private Control Plane state such as audit events, research snapshots, suggestion lifecycle and scheduling. Use `ccpun_social` for social publication/execution/provider state and metrics.

A database change must:

1. live in `db/migrations`;
2. be additive where possible and checksum/idempotency guarded;
3. be tested against UAT before Production;
4. preserve least-privilege runtime roles;
5. never require owner/backfill credentials at runtime;
6. expose a deterministic readiness/capability check when runtime code depends on the change.

Do not create one Neon branch per feature or PR. Admin Preview uses the existing UAT data plane. Test records must be synthetic or safely namespaced when parallel work can collide.

## Environment boundary

### Admin Preview / UAT

New Control Plane work uses the `admin/*` branch convention plus the immutable UAT data plane. Historical feature branches may remain accepted only where a legacy module explicitly lists them for compatibility.

A new Admin feature is UAT-authorized only when all applicable conditions hold:

- branch starts with `admin/`;
- Vercel environment is Preview when supplied;
- Vercel project is the exact `ccpun-admin` project;
- Sanity is exactly `ccb9lnw5/uat`;
- Neon, when required, is the exact UAT project/branch/endpoint/database and least-privilege runtime role.

`v4-production`, unrelated branch prefixes, wrong Vercel projects and wrong Sanity/Neon lanes fail closed. A future branch such as `admin/openquok-sdk-v0-0-13` therefore works without adding another branch-specific allowlist entry.

### Admin Production

Production remains intentionally stricter:

- `CCPUN_APP_ENV=production-admin`;
- `VERCEL_ENV=production`;
- exact `ccpun-admin` Vercel project identity;
- Git branch exactly `v4-production`;
- Sanity exactly `kyfxgjnq/production`;
- exact configured Production Neon identity and runtime role.

Unknown or mismatched lanes fail closed.

## External SDK / fork intake

Before copying code from an upstream project such as openquok:

1. inventory packages, licenses, routes, environment variables, data models, background jobs and side effects;
2. identify what is reusable logic versus upstream infrastructure assumptions;
3. map every upstream durable datum to Sanity, `ccpun_admin`, `ccpun_social`, Drive or no persistence;
4. keep external SDK/provider code behind a server-only adapter boundary;
5. do not copy upstream auth, database bootstrap, deployment topology or secret management blindly;
6. validate UAT with synthetic/read-only data first;
7. add RBAC, audit and idempotency before enabling writes;
8. require explicit human approval for high-impact actions such as publish, deploy, provider write, schema change or Production content mutation;
9. add failure/retry/reconciliation behavior for ambiguous external results;
10. prove the Admin-only Vercel build and live smoke before Production promotion.

No upstream feature may automatically provision a paid Vercel, Sanity, Neon or third-party resource.

## Admin tool write-safety pattern

A new tool that changes durable state should normally provide:

- deterministic input validation;
- preview or dry-run for consequential bulk changes;
- explicit authorization for the final action;
- idempotency or duplicate protection;
- sanitized audit record with actor, object, request ID and timestamp;
- bounded timeout and sanitized error category for external providers;
- reconciliation state instead of blind retry when an external result is ambiguous.

Read-only analytical tools may use a lighter flow, but still require auth/RBAC and bounded provider/database access.

## Secrets

- Server secrets live only in `ccpun-admin` and never in Public Web client bundles.
- `NEXT_PUBLIC_*` values are not secrets.
- Read credentials never fall back to write credentials.
- Runtime code never auto-discovers a more privileged credential.
- New environment variable names require a consumer and an owner; avoid aliases unless needed for a controlled migration.

## Required checks before merging an Admin extension

- Admin TypeScript/build passes.
- `tests/admin/*.test.ts` passes.
- environment/data-plane boundary tests pass.
- Sanity Free anonymous privacy boundary passes when Sanity-facing code changes.
- database capability/readiness tests pass when Neon-facing code changes.
- Admin Preview is READY and unauthenticated API boundaries still return the expected `401/403` behavior.
- Admin remains noindex.
- Admin-only change does not unnecessarily build or modify Public Web.
- Production smoke and runtime-error check are performed after promotion.

## Non-goals

This contract does not authorize deleting legacy Sanity documents, disabling Neon Auth, deleting environment variables, changing Production database schema, or consolidating providers. Those changes require consumer evidence and their own migration/rollback gate.

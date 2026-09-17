# CCPun Admin App

`apps/admin` is the deployable root for `admin.ccpun.com`. New Control Plane tools belong here and must follow `docs/architecture/admin-platform-extension-contract.md`.

## Install

Install from the monorepo root because the current workspace intentionally shares the repository lockfile and runtime dependency graph:

```bash
npm ci
```

Do not run a separate package manager or create a second lockfile under `apps/admin`.

## Local UAT

Load the required Admin secrets in the local environment, then from the repository root run:

```bash
npm run dev:uat --workspace @ccpun/admin
```

This binds the isolated Admin app to `127.0.0.1:3100` and pins the non-secret lane identifiers to Sanity `ccb9lnw5/uat`. Runtime guards still require the correct credentials/data-plane identity; missing or mismatched values fail closed.

Do not point local UAT at Production Sanity or Production Neon.

## Checks

From the repository root:

```bash
npm run typecheck --workspace @ccpun/admin
npm run test --workspace @ccpun/admin
npm run check --workspace @ccpun/admin
npm run build --workspace @ccpun/admin
```

The repository Foundation CI remains the final merge gate because it also protects shared/public regressions.

## New tool placement

- UI: an Admin route/module owned by `apps/admin` / `features/admin`.
- API: `/api/admin/<module>/*`.
- Auth: existing Auth.js + Google OAuth + CCPun RBAC.
- Editorial/public-safe content: Sanity.
- Private Control Plane state: Neon `ccpun_admin`.
- Social execution/provider state: Neon `ccpun_social`.
- External SDK/provider calls: server-only adapter; never expose credentials to client code.

Do not add another auth stack, database authority, Vercel project or per-feature Sanity/Neon project.

## Preview behavior

An Admin feature branch is authorized by the exact UAT data plane rather than an old branch allowlist. Vercel Preview must use the Admin project, Sanity UAT and, when required, the exact UAT Neon identity. `v4-production` is denied from the UAT lane.

Use an `admin/` branch prefix for Admin-only work so Vercel can skip the Public Web survivor. Admin verification files that do not change either runtime (for example the dedicated Sanity Free privacy workflow) are explicitly classified as neutral; generic or unknown workflow changes remain fail-safe and build both projects.

## Before integrating an upstream fork

Inventory its license, dependencies, routes, environment variables, data schema, background work and write side effects first. Reuse its feature logic through CCPun adapters; do not copy its auth, database bootstrap or deployment topology by default.

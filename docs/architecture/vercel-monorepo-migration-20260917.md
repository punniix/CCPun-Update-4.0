# CCPun Vercel Monorepo Isolation — 2026-09-17

## Mission

Keep exactly the existing `ccpun-web` and `ccpun-admin` Vercel projects while turning this repository into two independently deployable Next.js applications with explicit shared contracts.

This is a coordinated architecture migration, not a product rewrite.

## Locked production baseline

Migration base: `v4-production@040b7de4090e91db186cd65c8a2b58362f8e9880` after PR #148.

Rollback anchors recorded before physical separation:

- Web Production: `dpl_LywxJimMerpijD39GYvZ2nKjm63c`, commit `040b7de4090e91db186cd65c8a2b58362f8e9880`, domains `ccpun.com` and `www.ccpun.com`.
- Admin Production: `dpl_GJiLCATNsyV9PzDw2Z8k68fYjRkc`, commit `723e691dfe6b707ab9a3e1d1737a0553b923eef0`, domain `admin.ccpun.com`.

Baseline smoke after PR #148:

- Public Home, Blog, FHC, CI and approved Critical Illness article return HTTP 200.
- Public `robots.txt` and sitemap index return HTTP 200.
- Admin root resolves to the Production Admin login boundary, remains `noindex`, and keeps Google/allowlist copy.
- No Web or Admin `error`/`fatal` runtime logs were observed in the post-cutover 30-minute baseline window.

The PR #148 Production push also created an unnecessary Admin Git deployment (`dpl_6Wrdhv4qSX9sLS64VQidLtkFEgWp`) even though Admin Production remained on its previous promoted deployment. This is direct evidence of the build coupling this migration removes.

## Invariants

- Exactly two Vercel projects remain: `ccpun-web` and `ccpun-admin`.
- No separate GitHub repository.
- Node remains 24.x.
- Public URLs, canonicals, redirects, sitemap, robots and structured-data ownership do not change as a side effect.
- FHC and CI formulas do not change; frozen parity references keep their regression role.
- Admin Google Login, allowlist, permission checks, `401` vs `403`, audit logging and noindex boundaries remain fail-closed.
- Sanity remains editorial content Source of Truth; structured application state remains in Neon/Postgres.
- n8n remains the preferred multi-step workflow/orchestration layer where appropriate.
- No secret value is written to source, logs or documentation.

## Target direction

Use npm workspaces, not Turborepo by default:

```text
apps/web      -> ccpun-web
apps/admin    -> ccpun-admin
packages/*    -> only code with consumers in both applications
```

The exact package set is determined by the live dependency graph. Do not create empty packages merely to match a diagram.

Deployment invariant after cutover:

- Web-only change -> Web BUILD, Admin SKIP.
- Admin-only change -> Web SKIP, Admin BUILD.
- Shared-package/tooling change that affects both -> both BUILD.

## Gated stages

1. Audit current route/import/env/Vercel ownership.
2. Build two physical application roots and move rather than rewrite working systems.
3. Extract only genuine shared contracts/packages.
4. Add import-boundary and affected-build regression gates.
5. Validate both applications in CI and Vercel Preview.
6. Audit Vercel project settings and environment-variable metadata without exposing values.
7. Update the existing projects to their application roots and least-privilege environment scopes.
8. Prove Web-only/Admin-only/shared build routing.
9. Merge and coordinate Production cutover with both rollback deployments retained.
10. Run live route/security/tool/SEO smoke and runtime observability before completion.

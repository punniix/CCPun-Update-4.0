# CCPun Vercel Monorepo Isolation — 2026-09-17

## Mission

Keep exactly the existing `ccpun-web` and `ccpun-admin` Vercel projects while turning this repository into two independently deployable Next.js applications with explicit runtime, security, and deployment ownership.

This is a coordinated architecture migration, not a product rewrite. Folder aesthetics are secondary to predictable ownership and a reversible cutover.

## Locked production baseline

PR #149 is merged. The current migration baseline is:

- `v4-production@0e3de0c59bfe859e5d31b20f79dbc62736e5c25d`
- Web Production rollback deployment: `dpl_D5J8HUed5fX6fQpVrtmw7oJ7QYpo`
- Admin Production rollback deployment: `dpl_8RXShYdbSvDQWJpf6m6vpGcqFvFV`

Both rollback deployments represent the same source SHA and were healthy after the post-#149 Foundation and Production verification. Keep them available until the runtime cutover has passed live smoke and observability.

## Invariants

- Exactly two Vercel projects remain: `ccpun-web` and `ccpun-admin`.
- No separate GitHub repository and no third Vercel project.
- Node remains 24.x.
- Public URLs, canonicals, redirects, sitemap, robots and structured-data ownership do not change as a side effect.
- FHC and Critical Illness Planning formulas do not change; frozen/parity references retain their regression role.
- Admin Google Login, allowlist, permission checks, `401` vs `403`, audit logging and noindex boundaries remain fail-closed.
- Sanity remains the editorial content Source of Truth; structured application state remains in Neon/Postgres.
- n8n remains the preferred multi-step workflow/orchestration layer where appropriate.
- No secret value is written to source, logs or documentation.
- Provider settings are changed only as a coordinated Web/Admin cutover. Do not partially cut over one project when the other cannot be verified.

## Repository architecture validated in PR #150

The migration branch is `architecture/vercel-runtime-cutover-20260917` and PR #150 remains Draft until provider cutover gates are complete.

Application roots:

```text
apps/web      -> ccpun-web
apps/admin    -> ccpun-admin
packages/*    -> only genuinely shared contracts/code
```

The app roots intentionally consume some repository-level shared source. This is a smallest-safe separation rather than a rewrite of working modules merely to move them into packages.

### Runtime boundary contract

`scripts/check-app-runtime-boundaries.mjs` now fails CI when the Web application graph:

- imports `lib/admin/*`, `features/admin/*` or `cms/sanity/admin/*`,
- references Sanity write credentials, or
- depends on the Admin-only `workflow` runtime.

Latest validated isolated app-root graph before provider cutover:

- Web roots: 19
- Admin roots: 91
- Web reachable files: 97
- Admin reachable files: 249
- shared reachable files: 34
- Web -> Admin runtime leaks: 0
- Web -> Sanity write credential leaks: 0

The root hybrid application remains temporarily compatible with the pre-cutover Vercel projects. In particular, the root `app/robots.ts` still retains the Admin noindex compatibility path. The isolated `apps/web` graph does not depend on that Admin runtime.

### Shared content boundary

Public content reads use neutral Sanity lane/read helpers. Sanity write credentials remain Admin-owned. The Web application does not consume Admin Sanity credential helpers.

### Workflow ownership

`workflow` remains Admin-only because Article Scheduler uses that runtime. Web does not load the Workflow integration.

## Affected-build routing

The shared decision engine is `scripts/vercel-ignore-build.mjs`.

Required behavior:

- Web-only change -> Web BUILD, Admin SKIP.
- Admin-only change -> Web SKIP, Admin BUILD.
- Shared/boundary/tooling change affecting both -> both BUILD.
- Missing or ambiguous diff evidence -> both BUILD fail-safe.

Both isolated application roots contain an app-level `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "node ../../scripts/vercel-ignore-build.mjs"
}
```

`tests/vercel-app-root-config.test.mjs` verifies both app-root configs and that the shared ignore script resolves from each Root Directory. Existing affected-build regression tests continue to cover Web-only, Admin-only and shared-change routing.

## Repository QA status before provider cutover

Validated on PR #150 head `aedda05541a19c01f0ed3f51c7879229667e87b3` before this documentation update:

- Sanity privacy boundary: PASS.
- Web shadow typecheck: PASS.
- Web shadow production build: PASS.
- Admin shadow typecheck: PASS.
- Admin shadow production build: PASS.
- App-root Vercel config regression: PASS.
- Foundation code/SEO/analytics/Admin contracts: PASS.
- FHC/CI calculation regression: PASS.
- FHC/CI exhaustive browser QA: PASS.
- deterministic sitemap contract: PASS.
- Homepage LCP contract: PASS.
- SEO topic-hub static contract: PASS.
- SEO/Home HTTP contracts: PASS.
- production-parity Next build on non-production content lane: PASS.
- Production legacy URL ledger: intentionally skipped on the PR lane and must run on the Production push lane.

Latest pre-cutover Git-integrated previews for this head were READY on both existing projects:

- Web Preview: `dpl_HQNXZo9MLtcYu7EeE4qVzbFBoFDA`
- Admin Preview: `dpl_D7ngt9HjxfivhZTtNeshWM7qcg6d`

Those previews were still built with the existing hybrid provider settings. They prove buildability but are not the final Root Directory cutover smoke.

## Target Vercel provider mapping

### ccpun-web

- existing project only: `prj_dxwjITkd0av5QiJQv2snUlIASUWu`
- Root Directory: `apps/web`
- Framework: Next.js
- Node: 24.x
- Production Branch: `v4-production`
- Source files outside Root Directory: enabled
- affected-build command: app-root `vercel.json`
- domains remain `ccpun.com`, `www.ccpun.com`, and existing aliases

### ccpun-admin

- existing project only: `prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN`
- Root Directory: `apps/admin`
- Framework: Next.js
- Node: 24.x
- Production Branch: `v4-production`
- Source files outside Root Directory: enabled
- affected-build command: app-root `vercel.json`
- domain remains `admin.ccpun.com` and existing aliases

Both application `tsconfig.json` files resolve shared source from the repository root, and the Web Next/Turbopack configuration also treats the repository as its source root. Therefore `sourceFilesOutsideRootDirectory` is a required provider setting after Root Directory cutover.

Keep install/build/output commands on the platform defaults unless a verified live provider setting requires an explicit override. Do not invent commands during cutover.

## Live provider audit before cutover

The Vercel connection verifies that both locked project IDs still exist and are the projects receiving current Git previews. No new project is required.

The repository `VERCEL_TOKEN` can currently inspect `ccpun-admin` but returns 404 for every attempted `ccpun-web` metadata/environment lookup. This is a credential-scope limitation, not evidence that the Web project is missing.

Verified current Admin provider state before cutover:

- Framework: `nextjs`
- Node: `24.x`
- Root Directory: unset (`null`)
- Build command: platform default
- Install command: platform default
- Output directory: platform default
- Ignored Build Step project setting: unset (`null`)
- Source files outside Root Directory: enabled
- Git repository: `punniix/CCPun-Update-4.0`
- Production Branch: `main`

The Admin Production Branch therefore has provider drift relative to the locked CCPun Production branch `v4-production`. Correct it as part of the coordinated cutover, not as an isolated change.

The exact Web Root Directory/Production Branch/source-outside-root settings must be read with an authorized Vercel identity immediately before mutation. Do not infer them from the Admin project.

## Environment ownership and least privilege

Do not rotate, delete, or rename secrets merely because the application roots move. First separate project exposure; clean up legacy duplicates only after consumer verification.

### Web-only / public runtime

Examples of current source-owned Web configuration:

- `NEXT_PUBLIC_CI_PLANNING_PAGE_VERSION`
- `NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED`
- public analytics identifiers used by Web, including `NEXT_PUBLIC_GA_ID` and `NEXT_PUBLIC_META_PIXEL_ID`

### Admin-only server/configuration

Current Admin-owned source contracts include:

- `AUTH_SECRET`, `AUTH_URL` and authentication provider credentials
- `CCPUN_ADMIN_DATABASE_URL`
- `CCPUN_ADMIN_OWNER_EMAILS`
- `CCPUN_ARTICLE_SCHEDULING_ENABLED`
- `CCPUN_GA4_PROPERTY_ID`
- Google data/Drive administration configuration
- `CCPUN_GSC_SITE_URL`
- media-library configuration
- Neon project/branch/database configuration used by the Control Plane
- SEO Intelligence configuration
- social provider/database/operations configuration
- Vercel Control Plane read configuration
- `SANITY_API_WRITE_TOKEN`
- `SANITY_PRODUCTION_API_WRITE_TOKEN`
- `SANITY_PRODUCTION_RESEARCH_WRITE_TOKEN`
- `SANITY_STUDIO_PROJECT_ID`
- `SANITY_STUDIO_DATASET`

Web must not receive Admin write credentials merely because both projects use the same repository.

### Shared server-side read/configuration

Current shared source contracts include:

- `CCPUN_APP_ENV`
- `CCPUN_UAT_MODE`
- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`
- `SANITY_API_READ_TOKEN`
- `SANITY_PRODUCTION_API_READ_TOKEN`
- deployment/project identity required by fail-closed lane guards

A shared source contract does not automatically mean the same secret value or environment scope must exist in both projects. Scope each value to the runtime that actually needs it.

### Public-safe metadata

`NEXT_PUBLIC_*` variables are browser-exposed by design. Their semantics must remain non-secret. Vercel-generated deployment metadata and public project/dataset identifiers are configuration, not credentials.

### Secrets

Treat at minimum the following classes as secrets:

- Auth secrets and OAuth provider client secrets
- database URLs/passwords
- OAuth refresh tokens
- social provider access tokens
- Sanity read/write tokens
- Vercel read tokens

Never move a secret into a `NEXT_PUBLIC_*` variable.

### Legacy/unverified live variables

The Admin project currently contains 203 environment entries across scopes and repeated keys. It also carries multiple database/provider variable variants. Entry count alone does not prove they are unused; do not delete them in this migration without an exact consumer audit.

Examples requiring later cleanup review rather than immediate deletion include the many `CCPUN_SOCIAL_DATABASE_*` Neon/Postgres variants and release/source compatibility variables. Preserve first, verify consumers, then retire deliberately.

## Data and automation ownership

- Sanity remains Source of Truth for Articles, editorial content, FAQ, SEO copy and human-curated research/explanation.
- Neon/Postgres remains for structured application state such as tool/application state, SEC data, future journeys/leads/conversions and operational records.
- Vercel is application runtime/deployment infrastructure, not business-data Source of Truth.
- n8n remains the primary multi-step orchestration layer where appropriate. Do not recreate workflow automation in Vercel Functions/Cron without a runtime reason.

## Pre-cutover observability baseline

Use this baseline to distinguish existing errors from migration regressions.

### Web

Within the pre-cutover 24-hour runtime view, Web showed an Auth.js `MissingSecret: Please define a secret` signal on `/middleware`, grouped at 32 occurrences in the Vercel error view. This is consistent with the hybrid Public deployment still carrying Admin-auth middleware ownership. After Root Directory cutover, explicitly verify this Web auth/middleware error no longer appears.

Top observed Web status counts in the same baseline included HTTP 200, 304 and 308 traffic; no dominant 5xx group was visible in the top-status summary.

### Admin

The Admin baseline included:

- one Auth.js PKCE `InvalidCheck` signal on `/api/auth/[...nextauth]`, and
- one observed HTTP 502 on `POST /api/admin/social/export/sheets/` from an older Production deployment.

These are pre-cutover observations. They are not by themselves #150 regressions, but a material increase after cutover is a rollback/diagnostic signal.

## Coordinated provider cutover runbook

Do not execute the provider mutation until both projects can be read and changed with an authorized Vercel identity.

1. Record the exact current provider settings for both project IDs, especially Root Directory, Production Branch, source-files-outside-root, build/install/output and ignored-build configuration.
2. Confirm rollback deployments `dpl_D5J8HUed5fX6fQpVrtmw7oJ7QYpo` and `dpl_8RXShYdbSvDQWJpf6m6vpGcqFvFV` remain available.
3. Set `ccpun-web` Root Directory to `apps/web` and enable source files outside Root Directory.
4. Set `ccpun-admin` Root Directory to `apps/admin` and keep source files outside Root Directory enabled.
5. Set both Production Branch values to `v4-production`.
6. Confirm both projects read the app-level `vercel.json` affected-build command. Do not duplicate a conflicting provider-level Ignored Build Step command.
7. Preserve existing domains and aliases.
8. Apply environment least privilege without deleting unknown variables: remove a credential from the other runtime only after the isolated app has proven it is not a consumer.
9. Trigger/observe isolated Preview builds for both app roots.
10. Smoke Web Preview: Home, Blog list, Article, Categories, FHC, Critical Illness Planning, sitemap, robots, canonicals, redirects, consent/analytics and representative mobile/LCP-sensitive pages.
11. Smoke Admin Preview: login/allowlist, Dashboard, Content, Article management/preview, Research, Social, Analytics, Operations, Settings and Studio.
12. Prove affected-build routing with real commits or equivalent provider diff evidence: Web-only skips Admin; Admin-only skips Web; shared change builds both.
13. Keep PR #150 Draft until the provider-state and Preview gates above pass.
14. Obtain explicit Production merge/cutover approval under repository governance.
15. Merge to `v4-production`, observe Web deployment and the verified Admin promotion/deployment path, then run the Production legacy URL ledger and live smoke.
16. Inspect runtime errors, 4xx/5xx, auth failures, Sanity errors, Neon/database errors and unexpected webhook/API failures before declaring completion.

A deployment being `READY` is necessary but not sufficient.

## Rollback

If the provider-root or Production cutover causes a material regression:

1. Restore each project's exact pre-cutover Root Directory, Production Branch, source-outside-root and build-routing settings captured in step 1 above.
2. Promote/restore the known-good Web deployment `dpl_D5J8HUed5fX6fQpVrtmw7oJ7QYpo`.
3. Promote/restore the known-good Admin deployment `dpl_8RXShYdbSvDQWJpf6m6vpGcqFvFV`.
4. Verify `ccpun.com`, `www.ccpun.com` and `admin.ccpun.com` still point to the intended projects.
5. Re-run Home/Blog/tools/SEO smoke on Web and auth/Control Plane smoke on Admin.
6. Re-check runtime/error logs before reopening the migration.

Do not delete rollback deployments immediately after a successful cutover.

## Definition of done

Repository-side gates already demonstrated in PR #150:

- [x] PR #148/#149 baseline resolved.
- [x] isolated `apps/web` and `apps/admin` application roots exist.
- [x] Web app graph has zero Admin runtime imports.
- [x] Web app graph has zero Sanity write-token references.
- [x] Workflow runtime is Admin-only.
- [x] affected-build routing is covered by tests and app-root Vercel config.
- [x] Web/Admin shadow typecheck and builds pass.
- [x] FHC/CI formula and exhaustive browser regressions pass.
- [x] SEO/sitemap/LCP/HTTP and production-parity build gates pass on the PR lane.
- [x] rollback anchors and pre-cutover observability baseline are documented.

Provider/Production gates still required before completion:

- [ ] read and record exact Web provider settings with an authorized credential.
- [ ] Web Root Directory is `apps/web`.
- [ ] Admin Root Directory is `apps/admin`.
- [ ] both projects use Production Branch `v4-production`.
- [ ] source files outside Root Directory is enabled where required.
- [ ] environment exposure is least-privilege without deleting unverified secrets.
- [ ] final app-root Preview QA passes.
- [ ] Web-only change skips Admin build.
- [ ] Admin-only change skips Web build.
- [ ] shared change builds both.
- [ ] explicit Production merge/cutover approval is obtained.
- [ ] Production Web smoke passes.
- [ ] Production Admin smoke passes.
- [ ] Production legacy URL ledger passes.
- [ ] no material new runtime/auth/Sanity/Neon/API error signal appears.

Do not mark the migration complete while any provider/Production gate remains open.

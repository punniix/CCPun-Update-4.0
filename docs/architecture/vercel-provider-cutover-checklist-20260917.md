# CCPun Vercel Provider Cutover Checklist — 2026-09-17

Use this checklist only for PR #150 (`architecture/vercel-runtime-cutover-20260917`) after repository CI is green.

## Safety rules

- Use exactly the existing Vercel projects `ccpun-web` and `ccpun-admin`.
- Do not create a third Vercel project.
- Do not split the GitHub repository.
- Do not change domains or aliases.
- Do not delete, rotate, rename or copy environment secrets during the Root Directory cutover.
- Keep the Production rollback deployments available:
  - Web: `dpl_D5J8HUed5fX6fQpVrtmw7oJ7QYpo`
  - Admin: `dpl_8RXShYdbSvDQWJpf6m6vpGcqFvFV`
- Do not merge PR #150 before both projects have been changed and verified together.

## Locked project identities

- Web project: `ccpun-web` / `prj_dxwjITkd0av5QiJQv2snUlIASUWu`
- Admin project: `ccpun-admin` / `prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN`
- Git repository: `punniix/CCPun-Update-4.0`
- Production branch: `v4-production`
- Node: `24.x`
- Framework: Next.js

## Before editing settings

For each project, record or screenshot the current values of:

- Root Directory
- Production Branch
- Framework preset
- Node version
- Build Command
- Install Command
- Output Directory
- Source files outside Root Directory
- Ignored Build Step / ignore command, if a project-level override exists

If the Web project cannot be inspected with the same Vercel identity used for Admin, stop. Do not cut over only one project.

## Web project

Open `ccpun-web` in Vercel.

Set:

- Root Directory: `apps/web`
- Production Branch: `v4-production`
- Framework Preset: `Next.js`
- Node.js Version: `24.x`
- Include source files outside Root Directory / source files outside Root Directory: enabled

Leave these on their existing Auto/default values unless the recorded live setting proves an explicit override is already required:

- Build Command
- Install Command
- Output Directory
- Development Command

Do not add a separate Ignored Build Step command in the dashboard unless Vercel explicitly overrides the app-root `vercel.json`. The repository app root already contains:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "node ../../scripts/vercel-ignore-build.mjs"
}
```

Save the project settings.

## Admin project

Open `ccpun-admin` in Vercel.

Set:

- Root Directory: `apps/admin`
- Production Branch: `v4-production`
- Framework Preset: `Next.js`
- Node.js Version: `24.x`
- Include source files outside Root Directory / source files outside Root Directory: enabled

Leave Build / Install / Output / Development commands on their existing Auto/default values unless the recorded live setting proves an explicit override is required.

Do not add a separate Ignored Build Step command in the dashboard unless Vercel explicitly overrides the app-root `vercel.json`.

Save the project settings.

## Environment variables during cutover

Do not perform broad environment cleanup in the same mutation.

Required rule:

- Web must not receive Admin-only credentials such as Auth secrets, Admin database credentials, Sanity write tokens, research write tokens or Control Plane provider secrets.
- Admin may retain its existing environment set during the Root Directory cutover to avoid destructive cleanup.
- Shared Sanity read/configuration remains allowed only where the runtime actually consumes it.
- Never move a secret into a `NEXT_PUBLIC_*` key.

After the new app-root Preview deployments are healthy, environment exposure can be reduced incrementally with exact consumer verification.

## Expected Preview/UAT behavior after save

The next Git-integrated Preview must prove:

### Web Preview

- project identity = `ccpun-web`
- runtime environment resolves to `web-uat`
- Sanity lane = `ccb9lnw5/uat`
- no Admin routes, Auth.js Admin middleware, Admin clients or Studio mount
- public Home / Blog / FHC / Critical Illness Planning shells load
- Preview remains noindex

### Admin Preview

- project identity = `ccpun-admin`
- runtime environment resolves to `admin-uat`
- Sanity lane = `ccb9lnw5/uat`
- Production Sanity access fails closed in the UAT lane
- `/login`, `/dashboard`, `/content`, `/seo`, `/social`, `/analytics`, `/operations`, `/settings`, `/studio` remain inside the Admin boundary
- unauthenticated Admin API behavior remains JSON `401`
- Admin remains noindex

Repository regression coverage already proves these lane rules; the provider smoke confirms Vercel is now invoking the intended application roots.

## Build-isolation proof after provider cutover

Do not call the migration complete until live Vercel Git behavior proves all three cases:

1. Web-only change -> Web BUILD, Admin SKIP.
2. Admin-only change -> Web SKIP, Admin BUILD.
3. Shared/boundary/tooling change -> both BUILD.

Unknown or ambiguous change classification must continue to fail safe by building both.

## Production merge/cutover gate

Only after both app-root Previews and build isolation pass:

- re-read both project settings and verify the saved Root Directory / Production Branch values
- confirm domains are unchanged
- confirm no environment secret was deleted or exposed to the wrong project
- mark PR #150 ready only after human review
- merge with the exact expected head SHA

After merge to `v4-production`:

- Web Production must deploy from `apps/web`
- Admin Production must deploy/promote from `apps/admin`
- run the Production legacy URL ledger
- smoke Home, Blog, categories, representative article, FHC, Critical Illness Planning, robots and sitemap
- smoke Admin login/auth boundary, Dashboard, Content, Research, SEO, Social, Analytics, Operations, Settings and Studio
- verify canonical/redirect/sitemap/robots behavior is unchanged
- verify FHC and Critical Illness formulas remain regression-identical
- inspect Web/Admin runtime errors and 4xx/5xx groups
- specifically confirm the pre-cutover Web Auth.js `MissingSecret` middleware cluster no longer appears

## Rollback

If either project fails materially:

1. Stop Production promotion/merge if it has not happened yet.
2. Restore the recorded previous provider settings for both projects if the Root Directory cutover itself is the cause.
3. If Production has already moved, rollback aliases/deployments to:
   - Web `dpl_D5J8HUed5fX6fQpVrtmw7oJ7QYpo`
   - Admin `dpl_8RXShYdbSvDQWJpf6m6vpGcqFvFV`
4. Do not rollback Sanity or Neon data merely because application code/provider configuration is rolled back.
5. Keep PR #150 unmerged/Draft until the root cause is understood and verified.

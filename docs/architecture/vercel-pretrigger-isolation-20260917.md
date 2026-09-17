# Vercel pre-trigger isolation — 2026-09-17

CCPun keeps one GitHub monorepo with two Vercel projects:

- `ccpun-web` -> `apps/web`
- `ccpun-admin` -> `apps/admin`

Deployment isolation now has two layers.

## 1. Pre-trigger branch suppression

Each app-root `vercel.json` uses `git.deploymentEnabled` to reject branch families that are explicitly owned by the other application before an unnecessary Preview deployment is created.

Admin suppresses known Web-only branch families:

- `web/**`
- `ux/**`
- `**/*website-43*`

Web suppresses known Admin-only branch families:

- `admin/**`
- `codex/admin-*`
- `**/*website-42*`

Unlisted branches remain enabled so shared or ambiguous work still builds both applications.

## 2. Ignored Build Step safety net

Both app roots retain `node ../../scripts/vercel-ignore-build.mjs`.

This remains authoritative for:

- Production changed-path classification on `v4-production`
- fail-safe handling of shared or unknown changes
- compatibility with historical branch conventions

Production is not disabled by `git.deploymentEnabled`.

## Expected behavior

- `web/*` Preview: Web may deploy; Admin should not create an automatic Git deployment.
- `admin/*` Preview: Admin may deploy; Web should not create an automatic Git deployment.
- shared/unknown Preview: both may deploy.
- Production: changed-path classification decides Web-only, Admin-only, or both.

## Live probe evidence

The rules were tested from the exact change branch before merge:

- `web/vercel-pretrigger-probe-20260917` commit `39485e69...` created a `ccpun-web` Preview and created no corresponding `ccpun-admin` deployment.
- `admin/vercel-pretrigger-probe-20260917` commit `47182a00...` created a `ccpun-admin` Preview and created no corresponding `ccpun-web` deployment.

This removes canceled cross-project Preview churn without weakening the Production fail-safe router.

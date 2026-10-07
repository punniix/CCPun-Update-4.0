# Vercel Retirement Audit — 2026-10-07

Status: **ZERO LIVE DEPENDENCY / CANONICAL DOMAINS DETACHED / BOTH PROJECTS PERMANENTLY DELETED**

This audit separates historical provider state from current runtime authority. Phase 5 paused and detached the projects first; on 2026-10-08 the owner completed permanent deletion for both legacy Vercel projects.

## Projects

| Role | Project | Project ID | Vercel live flag | Current classification |
| --- | --- | --- | --- | --- |
| Web | `ccpun-web` | `prj_dxwjITkd0av5QiJQv2snUlIASUWu` | false before deletion | permanently deleted 2026-10-08 |
| Admin | `ccpun-admin` | `prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN` | false before deletion | permanently deleted 2026-10-08 |

Canonical `ccpun.com` and `admin.ccpun.com` live HTTP read-back is Hostinger.

## Runtime evidence

Vercel observability read-back on 2026-10-07:

- Web Production, latest 24 hours: **0 runtime-log rows**.
- Admin Production, latest 24 hours: **0 runtime-log rows**.
- Targeted Admin query `/api/admin/social/worker`, latest 24 hours: **no logs found**.
- Targeted Admin query `/api/internal/line/rich-menu/reconcile`, latest 24 hours: **no logs found**.

Seven-day history still contains pre-cutover Web/Admin requests, so the correct claim is **current zero observed dependency**, not “Vercel was never used this week”.

## Source hardening in P0

P0 removes the last autonomous Vercel cron declarations from `apps/admin/vercel.json`.

Both historical cron-facing execution surfaces are fail-closed:

- Social HTTP worker already returned `social-worker-unavailable`.
- P0 changes the LINE Rich Menu HTTP route to return `rich-menu-reconciler-unavailable` and removes its provider reconciler import.

This makes stale Vercel cron credentials incapable of executing Social or LINE Rich Menu provider work even if an old caller exists.

## Residual Vercel inventory classification

### Active live runtime dependency

**None observed.**

No canonical host is served by Vercel and no Production runtime activity was observed in the current 24-hour window.

### Historical residual assets

Phase 5 first paused both Vercel projects after the Hostinger runtime and private execution plane were accepted. Phase C then detached canonical domains, disabled new Preview deployment ownership, and the owner permanently deleted both projects on 2026-10-08.

Phase C removed the stale canonical project-domain attachments (`ccpun.com`, `www.ccpun.com`, `admin.ccpun.com`) and disabled Preview deployments plus automatic custom-domain assignment before deletion. Those project-owned `.vercel.app` aliases, historical deployments and project environment variables/secrets were then removed with permanent project deletion.

### Source cleanup after deletion

After both Vercel projects were permanently deleted, the Vercel-only operational recovery/audit artifacts were removed from source:

- `.github/workflows/line-key-recovery-once.yml`;
- `.github/workflows/vercel-monorepo-migration-audit.yml`;
- `scripts/operator/web-line-recovery.cjs` and its dedicated tests.

`apps/web/vercel.json`, `apps/admin/vercel.json` and provider-neutral Vercel identity tests may remain as inert compatibility/build metadata or fail-closed regression coverage; they own no project, domain, cron or live runtime.

### Historical documentation

Dated Vercel migration/runbook documents remain evidence of prior architecture only. Current placement is governed by `ccpun-runtime-baseline-20261007.md`.

## Audit limitation

The connected Vercel identity could read projects, deployments, domains, env metadata and runtime observability, but Vercel webhook listing returned HTTP 403. Therefore this audit does not claim a complete account-level webhook inventory from the Vercel API.

No webhook is inferred to exist or not exist from that permission failure.

## Destructive-retirement gate

Runtime prerequisites were satisfied before deletion: private workers accepted, live dependency zero, active caller inventory clean, projects paused/non-live, Preview deployments disabled, automatic custom-domain assignment disabled, and canonical custom domains detached.

On 2026-10-08 the owner completed irreversible deletion for both `ccpun-web` and `ccpun-admin`. Subsequent Vercel read-back returns zero projects in the team and `404 not_found` for both project lookups.


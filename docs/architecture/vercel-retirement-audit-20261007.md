# Vercel Retirement Audit — 2026-10-07

Status: **ZERO LIVE DEPENDENCY / BOTH PROJECTS PAUSED / PERMANENT DELETION REQUIRES VERCEL UI CONFIRMATION**

This audit separates live dependency from residual provider state. Phase 5 has paused both projects; permanent project deletion remains an irreversible Vercel UI confirmation that the connected tool cannot perform.

## Projects

| Role | Project | Project ID | Vercel live flag | Current classification |
| --- | --- | --- | --- | --- |
| Web | `ccpun-web` | `prj_dxwjITkd0av5QiJQv2snUlIASUWu` | false | paused / delete-confirmation pending |
| Admin | `ccpun-admin` | `prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN` | false | paused / delete-confirmation pending |

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

### Paused residual assets

Phase 5 paused both Vercel projects after the Hostinger runtime and private execution plane were accepted. The projects remain in Vercel only because permanent deletion is an irreversible UI-confirmed action that the connected tool cannot execute.

Residual inventory includes project aliases/deployments, environment variables/secrets and project-domain attachments recorded by Vercel. Their existence is not evidence that DNS/live traffic is using Vercel.

### Emergency recovery only

`.github/workflows/line-key-recovery-once.yml`:

- manual `workflow_dispatch` only;
- no schedule;
- exact action-time approval string required;
- intended as temporary emergency capsule recovery.

It remains a rollback tool, not a steady-state dependency.

### Audit/test compatibility

- `.github/workflows/vercel-monorepo-migration-audit.yml`: old migration branch + manual dispatch, no schedule;
- `apps/web/vercel.json` and `apps/admin/vercel.json`: compatibility/build-routing metadata; Admin no longer contains operational crons;
- Vercel identity/service-auth adapters and tests: retained while rollback compatibility remains supported;
- Vercel-specific regression tests: historical/rollback compatibility, not provider placement authority.

### Historical documentation

Dated Vercel migration/runbook documents remain evidence of prior architecture only. Current placement is governed by `ccpun-runtime-baseline-20261007.md`.

## Audit limitation

The connected Vercel identity could read projects, deployments, domains, env metadata and runtime observability, but Vercel webhook listing returned HTTP 403. Therefore this audit does not claim a complete account-level webhook inventory from the Vercel API.

No webhook is inferred to exist or not exist from that permission failure.

## Destructive-retirement gate

Runtime prerequisites are now satisfied: private workers are accepted, live dependency is zero, active caller inventory is clean, and both projects are paused. The remaining destructive action is Vercel project deletion itself.

The connected Vercel tool exposes deletion only as `requires_user_action`: it can open the Delete Project section but cannot click the irreversible confirmation on the owner's behalf. Therefore permanent deletion of `ccpun-web` and `ccpun-admin` remains an explicit owner UI action, not an unfinished runtime dependency.


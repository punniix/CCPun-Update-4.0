# CCPun Runtime Baseline — 2026-10-07

Status: **CURRENT OBSERVED BASELINE / P0 ARCHITECTURE CLOSURE**

This document supersedes `ccpun-runtime-baseline-20261006.md` for current runtime placement and migration status. It records observed state; it does not by itself authorize provider writes, autonomous background execution, destructive Vercel retirement, DNS changes or data mutation.

## Authority order

For current runtime-placement questions use:

1. live provider/runtime read-back;
2. this document;
3. `lib/runtime/deployment-lanes.mjs`;
4. `docs/architecture/ccpun-four-lane-deployment-contract.md`;
5. dated migration documents only as historical context.

If live evidence contradicts this baseline, stop and re-baseline before infrastructure changes.

## Git and live release split

Repository state observed while this P0 closure branch was created:

- `origin/v4-production = 7f6c4425c5d27580c202927637304cdae97246ef`
- that branch already includes PR #367, the evergreen income-tax URL change.
- **Live Production is intentionally still pinned to** `78713868605e3bda0f2ecdd3bf8a2e18411b2e70` through `codex/hostinger-release-production-78713868605e3bda0f2ecdd3bf8a2e18411b2e70`.
- This P0 architecture closure does **not** imply promotion of newer `v4-production` commits.

That distinction is deliberate: source governance and live promotion remain separate gates.

## Current four lanes

| Lane | Domain | Provider | App lane | Data lane | Indexing | Observed release |
| --- | --- | --- | --- | --- | --- | --- |
| Web Production | `ccpun.com` | Hostinger | `production` | Sanity `kyfxgjnq/production` | indexable | `78713868605e3bda0f2ecdd3bf8a2e18411b2e70` |
| Web UAT | `test.ccpun.com` | Hostinger | `web-uat` | Sanity `ccb9lnw5/uat` | blocked | `73f21285fdd70070db546c23e013387fbcb832f2` |
| Admin Production | `admin.ccpun.com` | Hostinger | `production-admin` | Sanity Production + Neon Production | blocked | `78713868605e3bda0f2ecdd3bf8a2e18411b2e70` |
| Admin UAT | `admin-test.ccpun.com` | Hostinger | `admin-uat` | Sanity UAT + Neon UAT | blocked | `73f21285fdd70070db546c23e013387fbcb832f2` |

Observed live evidence on 2026-10-07:

- all four hosts returned Hostinger platform evidence;
- Web Production returned the Production Sanity CSP endpoint and public robots contract;
- Web UAT returned UAT Sanity plus `X-Robots-Tag: noindex, nofollow, noarchive` and `robots.txt: Disallow: /`;
- both Admin hosts returned `X-Robots-Tag: noindex, nofollow, noarchive` and block-all robots;
- authenticated Admin Production System read-back reported `production-admin`, Hostinger, exact pinned release ref/SHA, Sanity `kyfxgjnq/production`, Neon `lively-bar-43618798 / br-long-resonance-b3ys5xrv`;
- Admin Production showed **Scheduler runtime OFF / durable ON**;
- Hostinger vulnerability views showed zero findings for Web Production and no vulnerabilities found for Admin Production after the security promotion.

## Completed migration phases

- Phase 0 — four-lane re-baseline / provider SSOT: **closed**
- Phase 1 — Web UAT parity: **closed**
- Phase 2 — Money Story responsive UX/UI acceptance: **closed**
- Phase 3 — Admin UAT/runtime hardening: **closed**
- Security Production Promotion — patched release `78713868` on Web/Admin Production: **closed**
- P0 Architecture Closure 2026-10-07 — current SSOT + exclusive execution authority + Vercel live-dependency audit: **closed when the corresponding source/tests merge**

## Background execution ownership

Current safety state is intentionally **dormant, single-authority** rather than “a worker must always be running”.

- Hostinger Admin Cloud is a producer/control plane only. Build/runtime seals keep Article Scheduler executor, native Workflow execution and generic Admin background worker **OFF**.
- Article execution is authorized only through `scripts/article-schedule-worker.ts` in a reviewed private VPS execution environment.
- Social and LINE Rich Menu background execution are authorized only through `scripts/admin-background-worker.ts` on the private VPS execution plane.
- The former Social HTTP worker is retired and returns fail-closed `503`.
- P0 retires the old LINE Rich Menu HTTP executor as well; authenticated calls remain fail-closed and cannot invoke provider mutation.
- `apps/admin/vercel.json` owns no operational cron after P0.
- n8n discovery found no CCPun Article Scheduler or Rich Menu workflow. Legacy `CCPun — article-publish` and `CCPun — social-post` are inactive.
- Hostinger VPS Docker Manager showed the existing n8n/Traefik, Local-AI and OCR applications, but no dedicated Article/Social/Rich-Menu worker application. Therefore this baseline does **not** claim that an autonomous private worker is currently running.

The resulting invariant is: **zero autonomous Cloud/Vercel executors; private VPS CLI is the only authorized execution plane if/when an owner-approved activation occurs.**

See `private-execution-ownership-20261007.md`.

## Vercel retirement state

Vercel is no longer an observed live serving or autonomous-execution provider for the canonical four lanes.

Current audit evidence:

- both `ccpun-web` and `ccpun-admin` report `live: false`;
- Vercel Production runtime-log queries for the latest 24 hours returned zero rows for both projects;
- targeted 24-hour queries returned no calls to the old Social worker or LINE Rich Menu reconcile paths;
- project domains, old deployments and environment variables still exist and are retained as rollback assets;
- emergency LINE recovery remains a manual, action-time-approved workflow, not a scheduled dependency;
- the legacy Vercel migration audit workflow is manual/old-branch scoped, not a Production scheduler.

See `vercel-retirement-audit-20261007.md`.

## Work intentionally left after P0

These are not P0 blockers:

1. **Private-worker activation/canary:** enable Article/Social/LINE worker processes only through a separate owner-approved activation packet, then prove cadence, restart behavior and real-job receipts. P0 removes duplicate ownership; it does not turn provider writes on.
2. **Recoverable Vercel asset deletion:** custom-domain attachments, env/secrets, old deployments and projects may be removed only after the chosen rollback observation window and explicit destructive-retirement approval.
3. **Provider/LINE Human Gates:** provider authorizations, callback read-backs and final real-provider canaries remain separate.
4. **Legacy `/snt-admin/*` compatibility removal:** only after callback, delayed retry and job callers are proven canonical.
5. **Security Phase 2:** npm audit still reports a separate Sanity/next-sanity transitive cluster even though Hostinger's deployed scanner is clear.


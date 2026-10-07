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

Repository and live release state after P0 final acceptance:

- `origin/v4-production = 26658e389348a4e7b1fffaa362531a3ece3cbbff` (PR #368 P0 architecture closure).
- Web Production intentionally remains on the previously accepted security release `78713868605e3bda0f2ecdd3bf8a2e18411b2e70`; P0 did not require a Public Web promotion.
- Admin Production was promoted and accepted on `26658e389348a4e7b1fffaa362531a3ece3cbbff` through `codex/hostinger-release-production-26658e389348a4e7b1fffaa362531a3ece3cbbff`.
- Admin UAT was promoted and accepted on the same source SHA through its stable Hostinger UAT release slot.
- Web UAT remains on its previously accepted isolated release.

This split is deliberate: each runtime lane advances only when its own acceptance gate requires it.

## Current four lanes

| Lane | Domain | Provider | App lane | Data lane | Indexing | Observed release |
| --- | --- | --- | --- | --- | --- | --- |
| Web Production | `ccpun.com` | Hostinger | `production` | Sanity `kyfxgjnq/production` | indexable | `78713868605e3bda0f2ecdd3bf8a2e18411b2e70` |
| Web UAT | `test.ccpun.com` | Hostinger | `web-uat` | Sanity `ccb9lnw5/uat` | blocked | `73f21285fdd70070db546c23e013387fbcb832f2` |
| Admin Production | `admin.ccpun.com` | Hostinger | `production-admin` | Sanity Production + Neon Production | blocked | `26658e389348a4e7b1fffaa362531a3ece3cbbff` |
| Admin UAT | `admin-test.ccpun.com` | Hostinger | `admin-uat` | Sanity UAT + Neon UAT | blocked | `26658e389348a4e7b1fffaa362531a3ece3cbbff` |

Observed live evidence on 2026-10-07:

- all four hosts returned Hostinger platform evidence;
- Web Production returned the Production Sanity CSP endpoint and public robots contract;
- Web UAT returned UAT Sanity plus `X-Robots-Tag: noindex, nofollow, noarchive` and `robots.txt: Disallow: /`;
- both Admin hosts returned `X-Robots-Tag: noindex, nofollow, noarchive` and block-all robots;
- authenticated Admin Production System read-back reported `production-admin`, Hostinger, exact pinned release ref `codex/hostinger-release-production-26658e389348a4e7b1fffaa362531a3ece3cbbff` and SHA `26658e389348a4e7b1fffaa362531a3ece3cbbff`;
- the same read-back reported Sanity `kyfxgjnq/production`, Neon `lively-bar-43618798 / br-long-resonance-b3ys5xrv`, and **Scheduler runtime OFF / durable ON**;
- Admin Production root/auth/core-route smoke passed; Admin robots remains block-all and every checked Admin response carries noindex protection;
- retired Social and LINE Rich Menu HTTP executor routes returned fail-closed `503` with no-store/noindex headers;
- Hostinger Admin vulnerability view reported **No vulnerabilities found** after the final P0 deployment;
- Vercel Production runtime-log queries for both Web and Admin returned zero rows in the final two-hour acceptance window;
- Public Web regression smoke remained `200` for home, `/sitemap.xml`, and `/sitemaps/core.xml`.

## Completed migration phases

- Phase 0 — four-lane re-baseline / provider SSOT: **closed**
- Phase 1 — Web UAT parity: **closed**
- Phase 2 — Money Story responsive UX/UI acceptance: **closed**
- Phase 3 — Admin UAT/runtime hardening: **closed**
- Security Production Promotion — patched release `78713868` accepted, with its dependency fixes inherited by the later Admin release: **closed**
- P0 Architecture Closure 2026-10-07 — SSOT + exclusive execution authority + Vercel zero-live-dependency evidence + Admin UAT/Production live acceptance at `26658e38`: **CLOSED**

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
- the final P0 acceptance repeated the Production query over the latest two hours and again returned zero rows for both projects;
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


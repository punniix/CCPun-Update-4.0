# Private Execution Ownership — 2026-10-07

Status: **PHASE 4 ACCEPTED / PRIVATE VPS IS THE ACTIVE SINGLE EXECUTION OWNER**

## Decision

Autonomous CCPun operational execution must have one authority only:

- **Cloud Web/Admin:** request/producer/control-plane only; no autonomous worker.
- **Vercel:** no operational cron owner.
- **n8n:** no Article Scheduler, Social publisher or LINE Rich Menu autonomous owner.
- **Private Hostinger VPS:** the only authorized plane for Article Scheduler execution and Admin background Social/LINE Rich Menu work, through reviewed CLI entry points.

This decision removes duplicate-executor risk without silently enabling Production provider writes.

## Workload ownership matrix

| Workload | Cloud/Admin state | Vercel state | n8n state | Only authorized executor |
| --- | --- | --- | --- | --- |
| Article Scheduler | durable producer/state; executor OFF | no owner | no scheduler workflow found | `scripts/article-schedule-worker.ts` on private VPS |
| Social publication worker | HTTP route retired/fail-closed | cron removed | legacy `CCPun — social-post` inactive | `scripts/admin-background-worker.ts social` on private VPS |
| LINE Rich Menu reconcile | HTTP route retired/fail-closed by P0 | cron removed | no rich-menu workflow found | `scripts/admin-background-worker.ts line-rich-menu` on private VPS |

## Enforced source invariants

`scripts/article-schedule-worker.ts`:

- has no HTTP listener;
- requires `native-neon` scheduler backend and explicit execution enablement;
- validates committed source provenance before polling;
- starts only the native article scheduling clock.

`scripts/admin-background-worker.ts`:

- accepts only `social` or `line-rich-menu`;
- requires `CCPUN_BACKGROUND_EXECUTION_PLANE=vps`;
- requires `CCPUN_BACKGROUND_WORKER_ENABLED=1`;
- rejects Next.js runtime context;
- requires `CCPUN_NATIVE_WORKFLOW_ENABLED=0`;
- rejects any populated `VERCEL_*` identity;
- validates the exact Admin lane and committed source before provider work.

Hostinger Admin build/runtime seals keep:

- `CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED=0`;
- `CCPUN_NATIVE_WORKFLOW_ENABLED=0`;
- `CCPUN_BACKGROUND_WORKER_ENABLED=0`.

`scripts/check-p0-execution-ownership.mjs` makes those ownership rules part of `npm run test:architecture`.

## HTTP retirement

Two historical cron-facing routes remain only as fail-closed compatibility surfaces:

- `/api/admin/social/worker`
- `/api/internal/line/rich-menu/reconcile/`

They retain bounded authentication/no-store behavior so stale callers do not become an anonymous surface, but even a correct stale credential cannot run a worker. Provider execution must enter through the private CLI.

P0 removes `apps/admin/vercel.json` operational cron declarations entirely.

## Live evidence and limitation

Observed 2026-10-07:

- Admin Production System read-back: Hostinger `production-admin`, scheduler runtime OFF, durable ON.
- Vercel Production runtime logs: no old Social/Rich-Menu cron-route calls in the latest 24-hour window.
- n8n discovery: no Article Scheduler or Rich Menu workflow; legacy Article Publish/Social Post workflows inactive.
- Phase 2 retired the migration-era VPS Admin containers after canonical Hostinger lane smoke proof;
- Phase 3 installed systemd lifecycle ownership for Article Scheduler and the Social/LINE background entry points;
- Article Scheduler UAT is enabled and active and recovered automatically after forced container termination;
- Production Article Scheduler is active/enabled against exact release `99661d64...` and recovered after a forced container termination;
- Social and LINE Rich Menu Production timers are active/enabled and passed manual plus automatic canaries;
- Social provider writes remain intentionally OFF; LINE mutation remains durable-command gated;
- n8n, Local AI, OCR and Ollama remain active and are not execution owners for these three workloads.

Phase 4 acceptance is therefore **exclusive active ownership on the private VPS with independent provider-write policy preserved**. See `phase4-operational-acceptance-20261007.md`.

## Accepted activation evidence

Production acceptance proved:

1. exact reviewed release SHA/lock on the private worker;
2. one service/timer owner per workload;
3. required VPS execution flags and no Vercel identity;
4. restart/redeploy behavior;
5. bounded retry/lease/idempotency behavior;
6. bounded manual and scheduled canaries without manufacturing unnecessary provider-side mutations;
7. receipts showing no second executor and no unresolved queue created by cutover.

Never “test failover” by enabling the old Vercel cron and the VPS worker at the same time.


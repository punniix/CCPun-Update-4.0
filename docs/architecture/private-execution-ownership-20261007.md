# Private Execution Ownership — 2026-10-07

Status: **P0 EXCLUSIVE-AUTHORITY CONTRACT CLOSED / AUTONOMOUS ACTIVATION DORMANT**

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
- Hostinger VPS Docker Manager: n8n/Traefik, Local-AI and OCR workloads visible; no dedicated CCPun Article/Social/Rich-Menu worker application visible.

Direct host process/systemd/crontab read-back was not established in this audit session, so this document intentionally does **not** say an autonomous worker is running.

P0 acceptance is therefore **exclusive authority with activation dormant**. That is safer than claiming a nonexistent executor and prevents double execution.

## Later activation gate

A future activation must separately prove:

1. exact reviewed release SHA/lock on the private worker;
2. one service/timer owner per workload;
3. required VPS execution flags and no Vercel identity;
4. restart/redeploy behavior;
5. bounded retry/lease/idempotency behavior;
6. synthetic canary first, then owner-approved real-provider canary;
7. receipts showing no second executor.

Never “test failover” by enabling the old Vercel cron and the VPS worker at the same time.


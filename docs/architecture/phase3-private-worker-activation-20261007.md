# Phase 3 Private Worker Activation Receipt — 2026-10-07

Status: **CLOSED — PRIVATE EXECUTION PLANE INSTALLED; PRODUCTION PROVIDER CUTOVER HELD FOR PHASE 4**

This receipt records the Phase 3 activation boundary after P0–P2. Phase 3 establishes one supervised private VPS execution plane and proves its lifecycle without turning on new Production provider writes. Production Article/Social/LINE operational canaries remain Phase 4.

## Selected releases

- Production worker candidate: `99661d64bbb0cd1aeb87b645a3928006878cf98e` (`v4-production` after Phase 0–1 closure).
- Article Scheduler UAT lifecycle release: `cd146117c193795dcb49109692998e91038911b4`, matching the existing sealed UAT scheduler environment.
- Both releases have their exact lock-installed dependencies and `tsx` runtime available on the VPS.
- Superseded private-worker release copies were removed after these two releases were selected.

## Execution ownership

The private VPS remains the only authorized autonomous execution plane.

- Cloud Web/Admin: producer/control plane only.
- Vercel: no operational cron owner.
- n8n: no Article Scheduler, Social publisher or LINE Rich Menu owner.
- VPS systemd: lifecycle owner for the private worker processes/timers.

No public worker HTTP endpoint is re-enabled.

## Article Scheduler UAT

`ccpun-article-scheduler-uat.service` is installed, enabled and active.

Properties:

- systemd owns restart behavior;
- Docker is the isolated Node 24 execution runtime;
- the exact UAT environment is loaded from the existing root-owned private environment file;
- the release tree is mounted read-only;
- no host port is published;
- graceful stop is bounded;
- the worker runs the reviewed `scripts/article-schedule-worker.ts` entry point only.

Lifecycle evidence:

- bounded launch canary remained running;
- graceful stop exited 0;
- forced container termination caused systemd `NRestarts` to advance from 0 to 1;
- the service returned to active/running state automatically.

This proves process supervision and restart behavior without a Production scheduler cutover.

## Production worker units

The following Production units are installed against exact release `99661d64...`:

- `ccpun-article-scheduler-production.service`
- `ccpun-social-worker.service` + `ccpun-social-worker.timer`
- `ccpun-line-rich-menu-worker.service` + `ccpun-line-rich-menu-worker.timer`

The Social and LINE cadence preserves the retired Vercel cadence of every five minutes.

All three Production activation owners are deliberately **disabled/held** at the end of Phase 3. They require the Phase 4 private Production environment/credential activation packet and canary gate before enablement.

This is intentional: Phase 3 proves the private execution topology and supervision. It does not silently authorize a real Production scheduler cutover or provider mutation.

## Provider-write boundary

Phase 3 does not enable new Production provider writes.

- Social provider writes remain OFF.
- LINE Rich Menu Production reconcile remains held until Phase 4.
- Production Article Scheduler remains disabled until Phase 4 acceptance.
- Existing Cloud/Vercel/n8n duplicate executors remain absent.

## VPS steady state after Phase 3

Active workloads:

- Traefik
- n8n
- Local AI worker
- OCR
- Ollama
- Article Scheduler UAT private worker

Production worker units are installed but held.

Worker release storage is reduced from five historical copies plus the new candidate to two selected releases. Disk usage after cleanup/selection is about 19 GB of 96 GB (~20%), with about 78 GB available.

## Phase 3 acceptance

Phase 3 is closed because:

1. an exact reviewed source/lock is selected for Production worker activation;
2. one private lifecycle owner is defined per workload;
3. Article Scheduler UAT proves real private-process startup, graceful stop and automatic restart;
4. Production Article/Social/LINE units are installed with no public listener;
5. old Cloud/Vercel/n8n autonomous ownership remains absent;
6. superseded worker release copies are removed while the selected UAT and Production candidate releases are retained;
7. Production provider writes and Production scheduler cutover remain fail-closed for Phase 4.

## Phase 4 handoff

Phase 4 must create/validate the Production private environment without exposing credentials, then separately accept:

1. Production Article Scheduler canary and durable receipt;
2. Social no-write/readiness canary before any provider-write approval;
3. LINE Rich Menu readback/hold canary before mutation approval;
4. retry/lease/idempotency and restart receipts;
5. provider receipts and confirmation that no second executor exists.

Do not enable all Production units at once. Promote one workload at a time with rollback/readback after each gate.

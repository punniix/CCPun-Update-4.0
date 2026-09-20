# Local AI Production Operations — Security Gates

Date: 2026-09-20
Scope: public-safe Content and SEO only
Baseline reviewed: `2961d224b4eaef536382e42bf9610a4902b4d138`
Decision: customer-private and LINE processing remain disabled and out of scope.

This document is a release gate, not Production authorization. The real workflows stay inactive until every mandatory gate below passes in code, UAT and provider read-back.

## Mandatory gates

| Gate | Required invariant | Acceptance evidence |
|---|---|---|
| Readiness before claim | Worker verifies Ollama and the configured model before claiming. An unavailable model never increments a job attempt. | Automated failure test with Ollama stopped and attempt count unchanged. |
| Bounded failure handling | Errors map only to `ollama-timeout`, `ollama-unavailable`, `lease-completion-rejected`, `model-output-invalid`, or `worker-failure`. Raw exception text is never logged. Retry delay is deterministic, increasing and capped at 60 seconds. | Security regression plus captured logs containing no sentinel prompt. |
| Semantic output validation | Content category is in `allowedCategories`. SEO queries match the input exactly once, owner candidates come from input pages, and every result requires review. | Contract tests reject invented, missing, duplicate and unreviewed output. |
| Human review | Successful output starts at `review_status=pending`. Only an authenticated owner can approve or reject it. The bridge exposes output only when job status is `succeeded` and review status is `approved`. | Route/RBAC tests and one UAT pending → approved lifecycle. |
| No automatic side effect | Local AI enqueue, status and review routes cannot publish, apply, dispatch or mutate content/provider records. | Static route guard plus UAT provider read-back showing zero writes before review. |
| Payload-bound idempotency | Same key and same semantic payload reuses one job. Same key with changed payload returns `idempotency-conflict`. | Database test covers inserted, reused and conflict outcomes. |
| Backpressure | Active `queued + leased` jobs are capped at 25. Existing idempotent replay resolves before the cap. New work above the cap returns `backpressure`; it is not silently dropped. | Transactional database test at 24, 25 and replay-at-25 boundaries. |
| Fixed service classes | `urgent` uses priority 80 and a 900-second deadline. `batch` uses priority 20 and a 21,600-second deadline. The caller cannot submit an arbitrary priority. | Contract and route tests. |
| Metadata-only monitoring | Monitoring contains only queue state, durations, normalized categories, `processRssBytes`, `heapUsedBytes`, `systemLoad1` and `uptimeSeconds`. It never contains prompts, payloads, output, ciphertext, keys or tokens. | Sentinel scan across worker, Admin, n8n execution and alert logs. |
| Private boundary | Compose hard-sets `CCPUN_LOCAL_AI_PRIVATE_JOBS_ENABLED=false`; n8n accepts only public-safe task types; Ollama has no published port and stays on the internal model network. | Compose/config test and provider read-back. |

## Queue and fallback behavior

The minimum safe workflow is enqueue → bounded poll → pending human review. A Local AI failure branches to `paused` or `skipped`; it does not fail unrelated n8n work and never calls a write/publish step.

- `inserted`: poll until terminal state or the workflow deadline.
- `reused`: poll the existing job; never enqueue a duplicate.
- `idempotency-conflict`: stop that item and require operator reconciliation.
- `backpressure`: pause the batch and retry later with the same idempotency key.
- `ollama-timeout` or `ollama-unavailable`: retry within the stored attempt/deadline limits only.
- `model-output-invalid`: terminal failure; no downstream write.
- `reconciliation-required`: owner investigation only.

Concurrency remains 1. Increasing it requires fresh RAM, CPU, disk, queue-latency and n8n-latency evidence on the 8 GB VPS.

## Monitoring and alerts

Alert payloads use job identifiers and normalized metadata only. They never copy input or model output.

- Worker heartbeat missing for more than 90 seconds.
- Ollama or configured model unavailable for two consecutive checks.
- Any `reconciliation-required` job.
- Queue age beyond its class deadline.
- Active queue reaches 25.
- Sustained memory or disk pressure at the threshold established by the load test.
- Failure/retry increase relative to the measured UAT baseline.

Host-wide RAM, CPU and disk claims must come from the VPS/container monitoring source. Worker process metrics must not be mislabeled as host metrics.

## Failure and load test matrix

1. Stop Ollama before claim: queue remains intact, attempts remain unchanged, Admin and n8n stay responsive.
2. Delay Ollama beyond 90 seconds: bounded retry/backoff occurs and unrelated workflow branches continue.
3. Stop worker during a lease: lease expires, one retry occurs, and no duplicate review record is created.
4. Break Neon connectivity: worker backs off; no prompt appears in logs; Admin returns a normalized unavailable state.
5. Replay the same request: same payload reuses the job; changed payload conflicts.
6. Fill the queue: the 25th active job is allowed, the next new job receives backpressure, and replay still resolves.
7. Submit urgent work behind batch work: the next claim follows the fixed bands; running inference is not interrupted.
8. Run synthetic public-safe batches while measuring worker/container and existing n8n latency. Keep concurrency 1 and stop at the first resource or latency threshold breach.
9. Search worker, Ollama, n8n and alert logs for sentinel prompt strings; expected matches are zero.
10. Approve one UAT result and reject another. Only the approved output becomes bridge-readable; neither action publishes content.

## Rollback checklist

Before activation, record the exact deployed SHA/image digest, current workflow export checksum, queue counts, migration/readback checksum and a durable post-install rollback point. Do not rely on an expiring snapshot alone.

1. Deactivate the real Content/SEO workflows.
2. Disable the Admin bridge so no new jobs enter.
3. Let the current inference finish within its lease or stop the worker and allow the lease to expire safely.
4. Restore the previously verified application/worker SHA or image digest.
5. Preserve jobs, review records and audit events. Do not truncate queues or reverse/drop the additive v2 schema.
6. Keep customer-private and LINE disabled.
7. Read back Admin/n8n health, exact SHA, worker heartbeat, queue/lease counts and bridge state.
8. Restore a VPS snapshot only in an approved maintenance window. Neon, Vercel and n8n state require their own read-back because a VPS snapshot does not roll them back.

## Promotion decision

Public-safe workflows may move from inactive smoke testing to UAT only after the automated security regression is green. Production activation still requires current COO authorization, exact provider read-back and a human-reviewed UAT result. Customer-private activation requires a separate security review and approval.

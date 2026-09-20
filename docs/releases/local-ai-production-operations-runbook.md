# Local AI production operations runbook

This runbook promotes only public-safe `content-operations` and `seo-preprocessing` work. Customer-private and LINE processing stay disabled. Local AI may prepare and classify data, but cannot apply changes, send messages, or publish. Every successful result starts as `pending`; only an authorized Admin review can make it readable to n8n.

## Preflight and promotion order

1. Record the intended commit SHA and confirm the rollback point (previous SHA and VPS snapshot `370665`). Do not restore the snapshot outside an approved maintenance window.
2. Run the offline gate:

   ```bash
   node --import tsx scripts/local-ai-operations-harness.mjs
   node --import tsx --test tests/admin/local-ai-enclave.test.ts tests/admin/local-ai-production-ops-security.test.ts
   npm run typecheck:admin:shadow
   cd workers/local-ai && npm run typecheck
   ```

3. Apply `20260920_local_ai_production_operations_v2_uat.sql` to UAT, then run its matching readback. Stop if any readback boolean is false.
4. Run UAT load/failure checks below. Record timestamps, exact SHA, n8n execution IDs, queue counts, P50/P95 duration, peak VPS RAM/CPU/load/disk, and recovery time. Do not record prompts, model output, or customer data.
5. Obtain owner acceptance. Only then apply the byte-identical Production migration and its Production readback during the approved window. Deployment and provider changes require separate current authorization.

The only approved cutover order is new Admin application first, then v2 migration. Keep all Local AI enqueue/review workflows inactive while deploying the application. Before v2 exists, the new application returns no review rows and Local AI enqueue remains unavailable instead of failing the page. Confirm by provider read-back that every current Admin instance runs the exact new SHA and no previous instance remains; only then apply v2 and its readback, deploy the worker, run UAT, and activate workflows after acceptance.

The additive v2 migration intentionally keeps the v1 Admin function grants for read and rollback diagnostics, but it does not support mixed-version writes. Never apply v2 while an old application instance can still enqueue. If the application is rolled back to v1 after v2, pause Local AI enqueue before rollback and keep it paused until the v2 application is restored. Remove the v1 grants only in a later cleanup migration after provider read-back confirms the rollback window is closed.

## n8n contract

- Enqueue: `POST /api/internal/local-ai/jobs/`
- Poll approved result: `GET /api/internal/local-ai/reviews/?jobId=<uuid>`
- Health: `GET /api/internal/local-ai/operations/health/`
- Sanitized incidents: `GET /api/internal/local-ai/operations/incidents/?limit=25`
- Owner review: `POST /api/admin/local-ai/review/` using the signed Admin session, never the n8n token

Use one stable idempotency key per logical input. A replay with the same payload is safe; a changed payload returns `409`. Use `urgent` only for work that must finish within 15 minutes; batch is the default. On `429` or `503`, pause and follow `Retry-After` instead of failing unrelated n8n work. `awaiting-review` is not success. Never attach a publish/write node directly to model output.

## UAT load and failure evidence

Keep worker concurrency at one. Use synthetic public-safe fixtures only.

1. Submit 20 batch jobs followed by five urgent jobs. Confirm no more than one lease is active, urgent jobs are selected before queued batch work, and all 25 remain within the cap.
2. Submit a 26th active job. Confirm `429`, no duplicate row, and normal Admin/n8n health.
3. Replay one idempotency key with the same payload, then a changed payload. Confirm reuse first and `409` conflict second.
4. Stop the worker in UAT. Confirm queued work remains durable, health reports a stale worker, Admin/n8n remain available, and no payload appears in logs. Restart and record recovery time.
5. Stop or delay Ollama in UAT. Confirm model readiness becomes false, claims pause, probes back off, retryable jobs use 5/15-second database delays, and other Admin/n8n routes remain healthy.
6. Complete one valid and one schema-invalid output. Confirm the valid result is hidden until approval; confirm the invalid result is rejected with only an allowlisted error category.

Host monitoring must independently alert on sustained RAM, CPU/load, and disk pressure because the application endpoint intentionally exposes only metadata-safe worker metrics. Suggested initial gates for the 8 GB VPS are RAM above 85% for five minutes, load above the host CPU count for five minutes, disk above 80%, worker heartbeat older than 90 seconds, Ollama not ready for two consecutive probes, or any growing failed-job count. Tune only from recorded UAT evidence.

## Rollback and incident response

Stop new enqueue first, then let the current single job finish or expire its lease. If the application SHA is at fault, redeploy the recorded previous SHA and re-run health/readback checks. The v2 database change is additive; do not manually drop columns or functions during an incident. If database/VPS recovery is required, use snapshot `370665` only inside an approved maintenance window and accept that post-snapshot jobs may need reconciliation.

After recovery, compare queue counts and incident metadata, mark ambiguous leased jobs `reconciliation-required`, and re-enable enqueue only when the worker heartbeat is fresh, the configured `qwen3:1.7b` appears in Ollama tags, the queue is draining at concurrency one, and no prompt/output/customer data is present in logs.

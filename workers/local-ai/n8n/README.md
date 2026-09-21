# n8n integration contract

n8n talks to the Admin control plane, never to Ollama or the encrypted Neon queue.

Required n8n environment variables:

- `CCPUN_ADMIN_BASE_URL=https://admin.ccpun.com`
- `CCPUN_LOCAL_AI_N8N_TOKEN=<same high-entropy token configured only in Admin and n8n>`

Admin must also set `CCPUN_LOCAL_AI_N8N_ENABLED=true`. Keep it false until UAT worker health is green.

## Public-safe enqueue

`POST $CCPUN_ADMIN_BASE_URL/api/internal/local-ai/jobs/`

Headers: `Authorization: Bearer <token>` and `Content-Type: application/json`.

The endpoint accepts only `content-operations` and `seo-preprocessing`. It rejects `line-intent` and `privacy-redaction` because n8n must never transport customer-private payloads.

```json
{
  "taskType": "seo-preprocessing",
  "idempotencyKey": "gsc-2026-09-19-batch-01",
  "queueClass": "batch",
  "payload": {
    "locale": "th-TH",
    "queries": [
      { "query": "ประกันสุขภาพ ลดหย่อนภาษี", "page": "/blog/health-insurance-tax/" }
    ]
  }
}
```

`queueClass` is fixed to `urgent` or `batch`. Urgent work has priority 80 and a 15-minute deadline; batch work has priority 20 and a six-hour deadline. Omit it to use `batch`. The active queue cap is 25 jobs. When the cap is reached the endpoint returns `429` with `Retry-After: 30`; pause the workflow instead of failing the whole n8n execution.

Do not send the legacy numeric `priority` field; the strict endpoint rejects it. While migrating existing workflows, map SEO `priority: 30` to `queueClass: "batch"` and time-sensitive Content `priority: 70` to `queueClass: "urgent"`. Normal scheduled Content preprocessing should still use `batch` unless the owner explicitly marks it time-sensitive.

The response is `202` for a new job or `200` for an idempotent replay and contains only `jobId`, `status`, `reused`, and `queueClass`. Reusing an idempotency key with a different payload returns `409`; do not retry that request automatically.

## Safe result polling

`GET $CCPUN_ADMIN_BASE_URL/api/internal/local-ai/reviews/?jobId=<jobId>`

Queued, leased, and `awaiting-review` responses include `Retry-After: 3`. Poll with a three-second wait and a bounded retry count. A completed model result stays hidden until an Admin owner approves it. Only an approved result includes the strict validated output. Legacy Content/SEO approval does not apply, write, send, or publish anything; `line-card-description` is the narrow exception and writes `lineTitle` plus `lineDescription` to the exact unchanged Sanity revision after owner approval. Existing reviewed values are never overwritten. Rejected jobs return `reviewStatus: rejected` and a null output. Failed responses include only a normalized error category.

Customer-private and LINE tasks remain disabled. These endpoints accept and return public-safe Content/SEO work only; do not route customer messages, ciphertext, or encryption keys through n8n.

Recommended reusable sub-workflow inputs are `jobId`, `maxPolls` (default 40) and `pollSeconds` (default 3). Treat `failed`, `reconciliation-required`, and `rejected` as terminal branches. Treat timeout, `429`, and `503` as pause/retry branches with the supplied `Retry-After`; never auto-publish or auto-send based only on model output.

## Metadata-only operations endpoints

- `GET /api/internal/local-ai/operations/health/` — queue counts, latency, worker freshness, Ollama readiness, and the hard-disabled private-jobs flag.
- `GET /api/internal/local-ai/operations/incidents/?limit=25` — sanitized job IDs, status, queue class, attempts, and allowlisted error category.

Both require the same Admin bridge bearer token. Neither endpoint returns prompts, input/output content, ciphertext, keys, or customer text. Alert when the worker is stale, Ollama is not ready, queue age grows, failed jobs rise, or memory/load crosses the separately configured VPS threshold.

The owner-only review action is `POST /api/admin/local-ai/review/`; it uses the signed Admin session and same-origin check, not the n8n bearer token.

## Inactive LINE description backfill

Import `line-description-backfill.inactive.json` only when the owner is ready to configure and test it. It remains inactive after import and uses the existing `CCPun Local AI Admin Bridge` header credential against the fixed Admin origin; the file contains no secret value.

The workflow asks Admin for at most 10 published, indexable articles whose `lineTitle` or `lineDescription` is still blank, expands the response, and enqueues the existing `content-operations` task as `batch`. Manual executions are scoped to `critical-illness-insurance` for the first production proof; scheduled executions use the bounded missing-field list. Its versioned idempotency key is bound to the Sanity document ID and exact revision, so a prompt-contract upgrade can replace an obsolete pending result without reprocessing articles whose LINE card fields are already filled.

The workflow polls the review-safe endpoint without exposing output before approval. The owner approves or rejects in `https://admin.ccpun.com/operations/local-ai/`. Approval performs the guarded Sanity patch inside Admin; n8n never receives a Sanity write token. After approval, n8n reads the exact article by `sourceId`, verifies that both LINE fields match the approved output, and records a human-readable terminal state in the execution. It never connects directly to Sanity or Ollama.

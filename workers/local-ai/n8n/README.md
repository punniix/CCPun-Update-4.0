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
  "payload": {
    "locale": "th-TH",
    "queries": [
      { "query": "ประกันสุขภาพ ลดหย่อนภาษี", "page": "/blog/health-insurance-tax/" }
    ]
  }
}
```

The response is `202` for a new job or `200` for an idempotent replay and contains only `jobId`, `status` and `reused`.

## Safe result polling

`GET $CCPUN_ADMIN_BASE_URL/api/internal/local-ai/jobs/<jobId>/`

Queued and leased responses include `Retry-After: 3`. Poll with a three-second wait and a bounded retry count. A successful response includes the strict validated output. Failed responses include only a normalized error category.

For private LINE tasks, another private runtime creates the encrypted job. n8n may receive the resulting opaque `jobId` and use this same GET endpoint, but it must not receive the original message, ciphertext or encryption key.

Recommended reusable sub-workflow inputs are `jobId`, `maxPolls` (default 40) and `pollSeconds` (default 3). Treat `failed` and `reconciliation-required` as terminal branches; never auto-publish or auto-send based only on model output.

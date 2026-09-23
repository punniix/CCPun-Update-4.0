# n8n integration contract

For encrypted queue jobs, n8n talks to the Admin control plane rather than Ollama or the encrypted Neon queue. The public-safe LINE card workflow below calls private VPS Ollama directly.

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

Queued, leased, and awaiting-review responses include Retry-After: 3. Poll with a three-second wait and a bounded retry count. A completed model result stays hidden until an Admin owner approves it. Content/SEO approval never writes, sends, or publishes anything. Rejected jobs return reviewStatus: rejected and a null output. Failed responses include only a normalized error category.

Customer-private and LINE tasks remain disabled on these queue endpoints. They accept and return public-safe Content/SEO work only; do not route customer messages, ciphertext, or encryption keys through n8n.

Recommended reusable sub-workflow inputs are `jobId`, `maxPolls` (default 40) and `pollSeconds` (default 3). Treat `failed`, `reconciliation-required`, and `rejected` as terminal branches. Treat timeout, `429`, and `503` as pause/retry branches with the supplied `Retry-After`; never auto-publish or auto-send based only on model output.

## Metadata-only operations endpoints

- `GET /api/internal/local-ai/operations/health/` — queue counts, latency, worker freshness, Ollama readiness, and the hard-disabled private-jobs flag.
- `GET /api/internal/local-ai/operations/incidents/?limit=25` — sanitized job IDs, status, queue class, attempts, and allowlisted error category.

Both require the same Admin bridge bearer token. Neither endpoint returns prompts, input/output content, ciphertext, keys, or customer text. Alert when the worker is stale, Ollama is not ready, queue age grows, failed jobs rise, or memory/load crosses the separately configured VPS threshold.

The owner-only review action is `POST /api/admin/local-ai/review/`; it uses the signed Admin session and same-origin check, not the n8n bearer token.

## LINE card copy

LINE card generation is no longer part of this encrypted queue worker. The production LINE flow is orchestrated visibly in n8n and calls the private Ollama service over the VPS-only Docker network. Sanity Studio calls the owner-only Admin bridge, n8n generates multiple candidates, n8n enforces the hard LINE length and safety contract, a second local-model step selects only among valid candidates, and Admin writes only the missing Draft LINE fields with revision guards. Publish LINE only is a separate Sanity action and never publishes pending SEO or body changes.

Do not enqueue mode line-card-description jobs. The strict content-operations queue contract rejects that retired payload.

### Manual improvement of approved LINE copy

`line-card-copy.direct.json` is a credential-free snapshot of the **published** `CCPun — Local AI — LINE Card Copy` workflow (`NeHFrMsfXcdnVxjU`) plus an explicit Improve branch. It is source control for an update to that existing workflow, not a workflow to import as a second copy. The existing Generate path is preserved. The webhook's live Header Auth credential and the existing `CCPun LINE Copy Runs` Data Table must be retained when applying the update.

The owner starts Improve for one article in Sanity Studio. Admin POSTs to the existing authenticated `/webhook/ccpun-line-card-generate` endpoint with **only the previously approved Published LINE copy** as model source:

```json
{
  "mode": "improve-existing",
  "requestId": "unique-request-id",
  "triggerSource": "sanity",
  "source": {
    "id": "ccpun-article-example",
    "revision": "published-sanity-revision",
    "slug": "example",
    "title": "Article title for audit",
    "category": "Article category for audit"
  },
  "existingLineTitle": "Previously approved LINE title",
  "existingLineDescription": "Previously approved LINE description"
}
```

Omit `body`, article text, excerpt, chunks, customer data, and Draft copy. The Improve input gate rejects a request containing `body` or missing either previous LINE field. Before inference, the Improve branch reads the existing Data Table row by `requestId`. A completed matching article ID/revision and Improve source returns the saved pair; a reused key with different source or failed prior result returns a normalized error. A missing row proceeds to Ollama because the lookup node emits an empty item on no match. The Improve branch sends only `existingLineTitle` and `existingLineDescription` to private VPS Ollama; `source` remains in n8n for audit and is not included in the model prompt. Two independent JSON-mode candidate calls are bounded at 60 seconds each and continue to the validator on transport failure. n8n accepts only a complete pair within 24–60 and 50–90 Thai graphemes, checks banned claims, contact identifiers, trailing fragments, new numeric claims, and requires at least one changed field. Model output is a **proposal**, not an approved revision. Factual equivalence needs owner review because a local model and string checks cannot establish it.

The webhook retains its strict Admin response shape: `status: "generated"`, both proposed LINE fields, and timing/error metadata. An invalid input, lookup failure, or model output returns `status: "error"` with a normalized `errorCategory`. The existing Data Table keeps one canonical row per request key with article ID/revision, `triggerSource: "sanity:improve-existing"` for Admin requests, status, stage, and proposed fields. A conflicting replay responds with an error and remains in n8n execution history without overwriting the successful Data Table row. Sequential matching replays are deduplicated; concurrent requests with the same new key can both pass the lookup before either writes a result because Data Table lookup/upsert is not an atomic claim. n8n does not patch Sanity. Admin must verify the Published revision and both original LINE fields still match the request, write a guarded Draft proposal, and leave the separate owner Publish LINE only action in charge of Published output.

For the live update, compare the current published graph first. Update only the `เตรียมงาน LINE` node parameters, add the ten Improve and replay nodes in the JSON, then replace only the true output of `Input พร้อม?` and connect the new branch. Preserve all other nodes, connections, credentials, workflow settings, and Generate behavior. Validate the draft before publishing; do not patch Sanity as part of this source-controlled artifact change.

Local structural check from `workers/local-ai/n8n`:

```sh
node -e "const w=require('./line-card-copy.direct.json'); const n=new Set(w.nodes.map(x=>x.name)); if(w.nodes.length!==29||!n.has('ปรับปรุง LINE เดิม?')||!n.has('อ่านผล Improve เดิม')||!n.has('ตรวจ Replay Improve')||!n.has('Ollama · Improve A')||!n.has('Ollama · Improve B')||!n.has('ตรวจผล · Improve')||w.connections['ปรับปรุง LINE เดิม?'].main[1][0].node!=='มี LINE ครบแล้ว?'||w.connections['มีผล Improve เดิม?'].main[1][0].node!=='Ollama · Improve A'||w.connections['สรุป Replay Conflict'].main[0][0].node!=='ตอบกลับ Sanity') process.exit(1)"
```

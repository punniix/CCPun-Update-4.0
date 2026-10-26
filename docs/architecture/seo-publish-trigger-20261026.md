# Signed publish producer and private notification worker

C7 extends the existing queue and CLI. No provider or database operation is part of this source change. Both notification switches default off; observation remains read-only. The main sitemap submission target is the owner-selected `https://ccpun.com/sitemap.xml`; the live gate still checks the existing blog sitemap and URL ownership.

## Authority and durability

Sanity's `idempotency-key` identifies a delivery; `sanity-webhook-id` identifies the configured hook. The raw-body signature is verified with pinned `@sanity/webhook` 4.0.4 and a five-minute absolute timestamp window. The route requires the Production Admin deployment, exact trusted ingress host and Production project/dataset. Its raw stream is capped at 4 KiB and ten seconds; a process-local bounded 60/minute IP limiter runs before signature work. Replicas have independent rate counters; durable delivery/content-version deduplication is in Neon.

The producer re-reads the published perspective, resolves URL ownership through the existing module and requires approved review, indexability and aligned canonical. Only INSERT is used by the signed producer. The append-only intent records every signed delivery and survives an observation-only reconciler winning the unique article/version job race. Deferred foreign keys require the job and receipt to commit together; a concurrent statement that cannot see the winner returns retryable failure rather than acknowledging a missing receipt. Reusing a delivery key for a different article/version is a conflict. Worker UPDATE consumes the intent without changing reconciler provenance.

The migration and readback are files for owner review only. SQL has not been applied or executed against a database. Runtime concurrency and grants therefore require isolated migration/readback acceptance. Advisory locks, row locks and job/step leases reserve durable quotas before external calls. Known retryable GSC responses wait at least thirty minutes; unknown outcomes and expired write leases require reconciliation. An active peer write causes a delayed retry; an unresolved/expired write fences future property submissions. Stale completed jobs cannot reopen; signed live-gate recovery stops after roughly 45 minutes from the first receipt or at 8 attempts. Exhausted work becomes reconciliation-required. Known provider backoff uses its own longer windows. C7b now enrolls approved/live members into fixed30-minute GSC windows, then independently revalidates/reserves one covering submission; GSC uncertainty does not suppress IndexNow. Bounded read-only sitemap reconciliation can release at most one retry. See [the operations runbook](../operations/seo-post-publish-runbook.md). Inspection leases allow three actual attempts and budget deferral does not consume an attempt.

## Credentials and budgets

Environment names only; no values are supplied:

- Existing queue/worker and deployment identity names remain required.
- Producer: `CCPUN_SANITY_WEBHOOK_SECRET` (Admin server only).
- GSC write: `CCPUN_GSC_SITEMAP_WRITE_ENABLED`, `CCPUN_GSC_SITE_URL`, `CCPUN_GSC_SITEMAP_CLIENT_ID`, `CCPUN_GSC_SITEMAP_CLIENT_SECRET`, `CCPUN_GSC_SITEMAP_REFRESH_TOKEN`, `CCPUN_GSC_SITEMAP_DAILY_BUDGET` (VPS only).
- IndexNow: `CCPUN_INDEXNOW_ENABLED`, `CCPUN_INDEXNOW_KEY`, `CCPUN_INDEXNOW_DAILY_BUDGET` (key also configured on Production Web for the exact key-file response).
- Existing separate read-only `CCPUN_GOOGLE_DATA_*` credentials support URL Inspection. No write-token fallback exists.
- Existing Supabase ops server configuration supports optional telemetry; no generated identity/date columns are written.

GSC and IndexNow budget values are **internal owner-configured daily budgets, not claimed provider quotas**. Missing/invalid values fail closed. Reservations stop at 80% of the configured budget, with GSC an additional hard maximum of 20 submissions/day and thirty-minute debounce. IndexNow has an internal maximum budget of 1,000/day, therefore at most 800 reserved calls/day. URL Inspection uses the published property limits stopped at 1,600/day and 480/minute, shared across initial and due inspections. Existing unrelated Inspection users outside this worker would require a shared owner budget allocation before enablement.

All write endpoints and redirect behavior are fixed. Notification code never calls Google's Indexing API, sitemap ping or the Search Console UI. Production Web serves only the exact configured key pathname with the switch on; other routes continue through their existing proxy/404 owners. No real key is generated. Follow-ups are read-only and independently leased.

## Admin and acceptance

`/seo/post-publish/` is owner-only and read-only. It shows the last 30 jobs, authoritative article labels/URLs, live gate, provider receipts, +1/+24-hour Inspection and plain Thai error summaries. A not-indexed +24-hour result offers the documented manual Search Console deep link. System health shows the last signed receipt, last worker pass and retry/reconciliation counts. These views show unavailable when migration/configuration is absent.

Mock tests verify signature/tamper/lane/body/rate guards, authoritative skips, delivery collisions/dedup, late reconciler intent, no-write defaults, live gate, transport mapping, fixed targets, reservations, uncertainty fencing, follow-up attempts, telemetry allowlists and exact source admission mutation rejection. They do not establish live webhook delivery, deployed proxy behavior, SQL concurrency in PostgreSQL, OAuth access, provider notification acceptance or eventual indexing. Those remain owner-controlled rollout acceptance, with switches off until approved.

# SEO หลังเผยแพร่ — GSC window recovery

Source/task: C7b. Runbook and SQL are review templates only. Do not use real credentials in commands/reports. No agent applies this SQL, creates a webhook, changes provider configuration or enables either switch.

## Read the states

- A live-verified approved publish joins a fixed30-minute GSC window. No initial PUT occurs. Later publishes inside that same window join it without extending its end. A publish after the end belongs to the next window, even if the worker is late.
- At the end, the same private VPS timer leases the window, re-reads every member's current published revision/approval/noindex/canonical and live/sitemap checks. Withdrawn/ineligible members are blocked, not covered. A temporary live failure defers the write. Only the eligible set is covered by one budget-reserved PUT; no token is acquired when all members are ineligible.
- Validation is bounded to100 members/window and a two-minute checking budget. Exceeding the member bound blocks that window visibly without a PUT; it does not fence later windows. Repeated current-live failures block after8 validations; budget/debounce deferrals do not consume these attempts. No member is silently marked covered.
- `waiting`: pending window, debounce or budget wait. `validating`: current member checks. `processing`: durable write reservation exists. `succeeded`: accepted or confirmed fresh sitemap submission; this does not mean the article is indexed.
- `uncertain` / `reconciling`: only GSC writes pause. IndexNow continues with its own switch, idempotency and429 retry budget.
- Reconciliation first waits30 minutes after an uncertain write. It uses the separate read-only Google token and fixed `sitemaps.get`, never a write-token fallback. Only the exact main sitemap's `lastSubmitted` at least the write start (floored to API second precision) confirms coverage. `lastDownloaded`, processing errors/pending and a historic submission are not proof of this write. Pending/errors/warnings are retained as processing facts, not indexing results.
- Up to3 read attempts, at least30 minutes apart. Transport errors/timeouts are recorded separately from valid negative observations. After the full90-minute wait and3 attempts, the window may release **one** retry; all writes still obey30-minute debounce, daily budget and max3 total attempts. A retry that is again uncertain can be confirmed, but cannot auto-release another retry. Exhaustion is `blocked` and requires owner review. Expired third read leases use the same bounded decision, rather than leaving a permanent pending counter.
- Reconciliation reads have a separate durable daily counter. They use the existing owner-configured sitemap budget at80%, with an additional internal max20 reads/day. Missing budget fails closed. These are internal limits, not a claim of Google's official API quota.
- Old uncovered `coalesced` jobs re-enter current approval/live validation; old unresolved writes are adopted into uncertain windows and keep the global GSC fence. Do not assume old tables are empty.

## Stop notification writes

The owner sets `CCPUN_GSC_SITEMAP_WRITE_ENABLED` and/or `CCPUN_INDEXNOW_ENABLED` off in the approved runtime. Both default off. Do not delete jobs or change published Articles. Read-only existing URL Inspection remains independent. Verify the exact source pin and runtime before any later enablement.

## Owner-only manual confirmation template

Use only after reviewing the exact property/main sitemap and proving a submission at/after this window's `started_at`. Pause the VPS timer first, confirm no active write/read lease, and run readback in the intended lane. Replace the psql variable placeholder with the specifically approved window UUID; do not paste credentials. This confirms coverage and never issues another PUT or bypasses quotas.

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('seo-notify-gsc'));
SELECT window_id,state,started_at,attempts,retry_released,last_observation
 FROM ccpun_admin.seo_gsc_window WHERE window_id=:'approved_window_id'::uuid FOR UPDATE;
-- Owner confirms external submission evidence and lane before continuing.
WITH confirmed AS (
 UPDATE ccpun_admin.seo_gsc_window SET state='succeeded',last_error_code=NULL,
   lease_id=NULL,lease_until=NULL,finished_at=now(),
   last_observation='{"kind":"owner-confirmed-submission"}'::jsonb
 WHERE window_id=:'approved_window_id'::uuid
   AND state IN ('uncertain','reconciling','blocked') AND started_at IS NOT NULL
   AND last_error_code IN ('gsc-uncertain','gsc-reconciling','gsc-uncertain-exhausted','gsc-write-lease-expired','gsc-legacy-uncertain')
   AND (lease_until IS NULL OR lease_until<now()) RETURNING window_id
), covered AS (
 UPDATE ccpun_admin.seo_post_publish_step s SET state='succeeded',error_code=NULL,
   lease_id=NULL,lease_until=NULL,finished_at=now()
 FROM confirmed c WHERE s.gsc_window_id=c.window_id AND (s.state IN ('uncertain','processing') OR s.state='blocked' AND s.error_code='gsc-uncertain-exhausted') RETURNING s.job_id
)
UPDATE ccpun_admin.seo_post_publish_job SET gsc_submit_at=now(),notify_state='gsc-submitted'
 WHERE job_id IN (SELECT job_id FROM covered);
COMMIT;
```

If submission cannot be proven, leave writes off and escalate. Do not reset `retry_released`, attempt counters, daily ledger or timestamps to force another submit. The Admin view is read-only and offers no mutate/clear button.

## Local test scope

Executable migration tests create their own disposable PostgreSQL cluster with TCP disabled and no inherited PG credentials, then apply v1/v2/v2. No remote database is an acceptable substitute. Without an existing local PostgreSQL runtime, report that required test as BLOCKED; do not install/pull a runtime or claim source/mock tests establish SQL behavior.

L2 URL identity change is deferred: changing persisted article/version uniqueness and receipt collision identity is outside these two fixes. No URL ownership, redirects, slugs, analytics or consent are changed here.

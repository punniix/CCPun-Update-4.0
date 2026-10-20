# Post-Publish SEO — Durable VPS Architecture (2026-10-08)

Status: CODE READY FOR CI; RUNTIME ACTIVATION HELD PENDING DATABASE MIGRATION, CREDENTIAL SCOPING AND UAT CANARY.

## Ownership

Web Production ccpun.com is the public read-only content/sitemap surface. Web UAT remains separate. Admin Production admin.ccpun.com alone accepts authenticated owner-origin POST /api/admin/seo/post-publish and returns 202 only after a Neon queue receipt is committed; GET reads job status. Admin UAT does not enqueue to Production. Neither Cloud Web nor Cloud Admin runs this worker. The sole execution owner is the private Hostinger VPS (no n8n duplicate, Vercel cron or public listener).

Sanity owns editorial publication. Neon owns idempotent job status. Google Search Console returns index observations and optionally accepts sitemap submission. Sitemap submission does not request URL indexing and does not guarantee a Google crawl.

## Durable job

Migration: db/migrations/20261008_seo_post_publish_durable_v1.sql. Apply to UAT Neon after provider and owner role validation, then separately to Production after approved readback. Unique(article_id,content_version) deduplicates. States: queued, processing, completed, retry-required, reconciliation-required. Atomic claim, 4-minute lease, bounded retries and backoff; expired leases become reconciliation-required instead of being blindly executed again. A sitemap_attempted marker is stored before the external request. Manual review is required for uncertain provider outcomes.

A VPS reconciliation sweep discovers recent published Sanity revisions (48 hours, 40 per pass). This recovers missed browser notifications and scheduled publications without executing Google writes. Reconciled jobs do not carry owner permission. Only the persisted owner-approved action allows optional sitemap submission. Successful Sanity publication is never reversed because queueing failed. HTTP 202 confirms Neon receipt, not execution completion.

## Google OAuth

Existing Search Analytics/URL Inspection retains CCPUN_GOOGLE_DATA_* and webmasters.readonly/analytics.readonly scopes. Do not upgrade the existing read token. Optional sitemap submissions require an entirely separate, owner-approved VPS-only credential:
CCPUN_GSC_SITEMAP_CLIENT_ID, CCPUN_GSC_SITEMAP_CLIENT_SECRET, CCPUN_GSC_SITEMAP_REFRESH_TOKEN.
The separate refresh token must not match CCPUN_GOOGLE_DATA_REFRESH_TOKEN. CCPUN_GSC_SITEMAP_WRITE_ENABLED defaults to OFF. Property sc-domain:ccpun.com and sitemap https://ccpun.com/sitemaps/blog.xml are fixed. No generic Indexing API.

## Activation flags

Cloud Admin producer CCPUN_SEO_POST_PUBLISH_QUEUE_ENABLED=1 after queue migration/canary; NEXT_PUBLIC_CCPUN_POST_PUBLISH_SEO_ENABLED=1 only after acceptance to send the best-effort browser dispatch (default OFF); existing CCPUN_ADMIN_DATABASE_URL remains controlled by Production Admin operations identity. Never put VPS worker or Google write secrets in Cloud Admin.

Private VPS worker requires CCPUN_SEO_POST_PUBLISH_WORKER_ENABLED=1, CCPUN_BACKGROUND_EXECUTION_PLANE=vps, CCPUN_NATIVE_WORKFLOW_ENABLED=0, CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED=0, CCPUN_APP_ENV=production-admin and Production Neon branch identities. It must use dedicated CCPUN_SEO_POST_PUBLISH_DATABASE_URL under limited ccpun_seo_post_publish_worker role. Migration creates the role NOLOGIN; provision scoped credentials in operator-controlled private environment only after UAT approval. Worker source checks reviewed Git SHA and pinned ref. CLI: node --conditions=react-server --import tsx scripts/seo-post-publish-worker.ts. Deploy under a supervised, non-overlapping systemd oneshot timer; no HTTP worker endpoint or n8n workflow. Merge does not activate the timer.

## Acceptance / rollback

1. UAT migration and least-privilege role readback, dry run without Google writes.
2. Canonical/redirect/response-size limits; CSRF, auth, role, environment and data-plane checks.
3. Owner Publish, Scheduler/reconciliation, retries, duplicated events, expired lease and restart receipts.
4. Read-only GSC verification; separate owner-authorized canary before any sitemap PUT.
5. Node 24 CI and Web/Admin Shadow, four-lane smoke, exact-release and rollback evidence.
6. Disable producer and worker flags first for rollback. Keep queue and audit rows; never undo a successful Sanity publish during cleanup.

This is an additive integration contract; current authorities remain docs/architecture/ccpun-four-lane-deployment-contract.md, docs/architecture/private-execution-ownership-20261007.md, and pinned Release Governance. Do not change UX Improvement or Investment Allocation Draft PR #165. Older local migration-era Hostinger plans cannot override these authorities.

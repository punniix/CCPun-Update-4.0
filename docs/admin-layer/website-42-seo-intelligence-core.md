> **Hostinger four-lane override (2026-10-08):** This document contains historical Website 4.2/Vercel details. Current authority is docs/architecture/ccpun-four-lane-deployment-contract.md and docs/architecture/seo-post-publish-vps-20261008.md. GSC/GA4 reader OAuth retains the read-only scopes, while Post-Publish sitemap writing requires separate owner approval and a VPS-only token. Historical Vercel settings below are not live instructions.

# Website 4.2 SEO Intelligence Core

The preparation branch exposes an authenticated, same-origin readiness endpoint at
`/api/snt-admin/seo/providers/readiness?provider=gsc|ga4`. It returns required variable
names, presence, identifier validity, minimum read-only scope, and limitations only.
It never returns values. UAT uses one owner-authorized offline OAuth connection stored as
branch-scoped Vercel Secrets. The server exchanges the refresh token for a short-lived access
token only when the owner presses a manual Sync control. Production Admin login may reuse the
same complete OAuth client ID/secret pair; its identity-only sign-in flow and the data refresh
token remain separate. Preview and UAT keep their dedicated `AUTH_GOOGLE_*` pair.

Required provider variables for both the exact Preview/UAT lane and the gated Production Admin lane:

- `CCPUN_GOOGLE_DATA_CLIENT_ID`
- `CCPUN_GOOGLE_DATA_CLIENT_SECRET`
- `CCPUN_GOOGLE_DATA_REFRESH_TOKEN`
- `CCPUN_GSC_SITE_URL` (`sc-domain:ccpun.com` or the exact verified URL-prefix property)
- `CCPUN_GA4_PROPERTY_ID` (numeric Property ID, not a `G-...` Measurement ID)

The read-only OAuth grant uses webmasters.readonly for GSC and analytics.readonly for GA4. A separate write-scoped owner-approved VPS-only token is required for the blog sitemap PUT. Do not upgrade the existing read token or use the broad grant for ordinary analytics. No provider tokens are stored in Sanity, browser, or logs.

Status: owner-triggered, read-only Admin UAT and gated Production foundation.

The deterministic detectors for CTR underperformance, position 4–15 opportunities, content decay and persistent query/page cannibalization remain covered by fixed synthetic fixtures. The manual GSC and GA4 panels display live read-only totals, exact comparison joins and bounded change signals; they do not feed provider rows into those detectors or create proposals.

Activation always requires `CCPUN_SEO_INTELLIGENCE_ENABLED=1` and one exact lane:

- Preview/UAT: Admin UAT environment, `ccpun-admin` Vercel project identity, exact approved Website 4.2 SEO branch, and Sanity `ccb9lnw5/uat`
- Production Admin: `CCPUN_APP_ENV=production-admin`, `VERCEL_ENV=production`, `CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID` matching the Vercel-supplied Production Admin project ID, exact branch `v4-production`, and Sanity `kyfxgjnq/production`

The API is authenticated, requires `seo:read`, checks the configured Admin origin and exposes GET only. The page and API return 404 when any activation guard differs.

The GSC boundary validates provider responses, maps keys by the exact requested dimension order, supports operator-selected date ranges up to 90 days and paginates at 25,000 rows up to a bounded 50,000-row result per range. It uses finalized web data, one bounded retry and a 15-second timeout. Google documents that Search Analytics may still omit anonymized/low-volume rows and does not guarantee every possible query.

`POST /api/snt-admin/seo/opportunities/sync/gsc/` is the only caller. It runs only after an authenticated human with `research:provider-query` permission presses the manual Sync control on an exact enabled Admin UAT or Production Admin lane. It fetches the selected and preceding equal-length ranges, returns counts plus at most 100 current rows, and persists nothing. It never runs during page rendering.

`POST /api/snt-admin/seo/opportunities/sync/ga4/` adds the same human-triggered, read-only boundary for Organic Search landing pages. It requests only `landingPage`, `sessions` and `engagedSessions`, derives engagement rate deterministically and compares the selected range with the preceding equal-length range. The call is limited to 10,000 rows per range, returns at most 100 sample rows to the Admin UI, reports sampling/thresholding/other-row limitations when Google supplies them, and persists nothing. If the current range succeeds but the comparison fails, the result is explicitly partial.

GA4 event outcomes are deferred. The repository has protected analytics event names, but this batch does not duplicate them into a second reporting allowlist or assume every event is a business outcome. A later batch must verify the live property compatibility and establish one approved reporting registry without renaming analytics or consent contracts.

The market boundary is provider-neutral and currently has one pure Ubersuggest adapter. It accepts only the existing validated research shape, rejects credential-shaped input, labels SERP evidence as untrusted external data and represents `ready`, `unavailable`, `stale` and `missing` states. The Admin page displays deterministic fixtures for all four fallback states. The adapter performs no provider call, reads no environment variable and does not activate a paid service.

The retained GSC observation assembler joins validated current and previous rows by exact governed dimensions for separately reviewed detector workflows. The current manual dashboard route does not invoke that assembler or read editorial context from Sanity; it joins query/page rows only when both dimensions match exactly. Comparison provenance and provider limitations remain explicit, and the route performs no persistence.

The manual-sync routes return totals, exact joined rows, bounded change signals and limitations in memory only. They do not invoke the deterministic detectors, assign Business Value, create opportunities or write provider responses to Sanity, Neon or Production. GA4 event outcomes remain separate until an approved event registry and landing-page ownership contract exist.

This batch does not call Ubersuggest or a paid provider; persist observations or opportunities; generate AI proposals; mutate Sanity; apply Draft changes; publish content; write to Production; or change URL, canonical, redirect, sitemap, robots, analytics or consent contracts. Search appearance remains deferred because Google documents it as a separate two-step query. Scheduled sync and the persistent opportunity lifecycle remain separate later batches.

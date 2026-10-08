# Pending owner actions — Post-Publish SEO Activation (2026-10-08)

**Status: PAUSED BY OWNER for later continuation. Do not infer that this feature is live.** This file is the durable handoff for the request "จดไว้ก่อน". It describes pending user/provider action, not a scheduled automation or an approval to disclose or create credentials.

## Already completed (verified)

- PR [#387](https://github.com/punniix/CCPun-Update-4.0/pull/387) and [#388](https://github.com/punniix/CCPun-Update-4.0/pull/388) merged to `v4-production`; release source SHA `a997ddb0be265bd3b7693ec5017e53a805686b91`.
- Both Neon UAT (`young-term-47483330` / `br-crimson-mouse-az7ajkv8`) and Neon Production (`lively-bar-43618798` / `br-long-resonance-b3ys5xrv`) have migration `20261008_seo_post_publish_durable_v1.sql` applied. Initial queues held 0 jobs. UAT and Production roles `ccpun_seo_post_publish_worker` exist but have `NOLOGIN` (Production role was restored to NOLOGIN after an unsuccessful credential setup).
- Production VPS `/opt/ccpun-workers/releases/a997ddb0be265bd3b7693ec5017e53a805686b91` has verified Git SHA and Node 24 lock-installed dependencies. Read-only architecture test passed 19/19. No Post-Publish timer/service is active; existing Article Scheduler Production and UAT remain active and untouched.
- GitHub pinned Production branch `codex/hostinger-release-production-a997ddb0be265bd3b7693ec5017e53a805686b91` exists, but **Hostinger Admin Production still showed deployed `c867c34a`**, not this branch. No Save/Redeploy was completed.
- Web UAT UX SHA `0ed35b03`, Draft Investment Allocation PR #165 SHA `af833412`, and 14 uncommitted original local WIP files remain protected.
- No Provider Sitemap Write, no GSC refresh-token upgrade, no Production Post-Publish executor.

## Owner must do, later — not via chat

1. **Create and scope a dedicated Neon Worker credential** for `ccpun_seo_post_publish_worker`, starting with isolated UAT acceptance and then Production. Explicitly allow login only after the credential is securely provisioned. Keep a dedicated, least-privilege role; never reuse the database-owner or Admin producer connection.
2. **Install the resulting connection string only in a root-controlled private VPS environment** (appropriate ownership/permissions and secret handling). Never paste a password, database URL, GSC token or environment-file contents into ChatGPT or GitHub; never copy it into Hostinger Cloud Web/Admin frontend.
3. When ready for optional **Google Sitemap Submission**, approve a separate write-scoped OAuth client and refresh token stored only on VPS (`CCPUN_GSC_SITEMAP_CLIENT_ID`, `CCPUN_GSC_SITEMAP_CLIENT_SECRET`, `CCPUN_GSC_SITEMAP_REFRESH_TOKEN`). Existing GSC/GA4 read-only OAuth must stay read-only. This is **optional** for the observation-only SEO checker and must not be enabled just to complete queue processing.

## Technical acceptance after the owner returns

4. Review the SQL role grants, UAT migration readback, worker/release seal, and dry-run private Worker without Google writes. The current Post-Publish HTTP route is explicitly **Production-only**; Admin UAT returns `skipped`, so a separate UAT-safe harness/dry run is needed before claiming a full UAT E2E acceptance.
5. Deploy Admin Production from its pinned reviewed SHA, aligning Git branch, `CCPUN_GIT_REF`, `CCPUN_GIT_SHA`, `CCPUN_RELEASE_ID`, build config and release identity. Preserve existing Sanity/Neon data plane and noindex. Keep Web UAT UX and PR #165 unchanged. Smoke-test the authenticated Admin API and rollback.
6. After bounded UAT proof, explicitly enable `CCPUN_SEO_POST_PUBLISH_QUEUE_ENABLED=1` (server) and `NEXT_PUBLIC_CCPUN_POST_PUBLISH_SEO_ENABLED=1` (Admin Studio dispatch). Source default is OFF.
7. Install **one** private VPS `systemd` oneshot/timer for the Post-Publish Worker, with supervised restart, no exposed port, no Cloud/Vercel/n8n duplicate executor. Use reviewed Git SHA and dedicated DB role. Enable `CCPUN_SEO_POST_PUBLISH_WORKER_ENABLED=1` only after readback. Keep `CCPUN_GSC_SITEMAP_WRITE_ENABLED=0`.
8. End-to-end proof: approved Publish to Neon `queued`, bounded Worker claim/lease, `completed` receipt, HTTP/canonical/noindex/sitemap parity, retries/lease-expiry, browser callback loss, Scheduler reconciliation, human-readable error/health and persisted Audit. Do not fabricate a real article publication as a synthetic test.
9. If separately authorized, run a single Google Sitemap Write canary with a distinct OAuth token; verify GSC outcome and mark uncertain writes reconciliation-required rather than retrying blindly. Search Console sitemap resubmission is **not** the Google Indexing API and does not guarantee indexing.

## Safety / rollback

- **Do not** turn on any production provider writes, change secrets, or perform a blind Admin re-deploy during P2 cleanup.
- Rollback order: disable queue/worker flags and timer, restore previously approved Hostinger Admin SHA, keep existing durable rows, retain successfully published Sanity content. Never delete production job rows or re-enable Vercel/n8n cron for Post-Publish.
- If launch is blocked by permissions or missing credential, record the blocker and leave Post-Publish off rather than treating Source Merge as successful Production activation.

Current authority: `docs/architecture/seo-post-publish-vps-20261008.md`, `docs/architecture/ccpun-four-lane-deployment-contract.md`, `docs/architecture/private-execution-ownership-20261007.md`.

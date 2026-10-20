# Website 4.2 Provider Setup Runbook

Status: preparation only. This runbook does not authorize a provider connection, credential creation, environment mutation, database write, social post, analytics sync, or Production change.

## Keep these three identities separate

1. **Admin login** proves who may enter `admin.ccpun.com` or Admin UAT. It uses the existing Auth.js Google client.
2. **Provider authorization** grants CCPUN narrowly scoped access to GSC, GA4, Drive, Meta, YouTube, or TikTok. Provider tokens must use their own server-only lifecycle and must not be copied into Admin login configuration.
3. **MCP authorization** lets Codex or another approved agent operate the provider's developer tools. It does not automatically give the deployed CCPUN application a runtime token.

Use separate UAT and Production provider apps/clients. Start read-only. Add publish scopes only in the platform-specific publishing phase.

## What is ready without credentials

- Provider-neutral connection states: disconnected, authorization pending, connected, refresh required, revoked, and error.
- Strict server-only normalizers for Meta, YouTube, and TikTok historical metrics.
- Synthetic Meta Page/Instagram discovery, Calendar, post formats, Comment Series, and post-live historical analytics.
- GSC and GA4 manual read-only sync boundaries.
- Drive metadata and ancestry verification limited to one immutable root folder ID.

No current route exchanges authorization codes or persists refresh tokens. Do not create or paste long-lived provider secrets until the corresponding reviewed callback, encrypted token store, revoke flow, and audit event exist.

All analytics/provider sync in the current phase is owner-triggered and manual. There is no cron, background sync, or autonomous provider execution. Adding any recurring or background path requires a separate exact approval, code review, and UAT gate.

## Zero-cost Drive-first steady state

The owner-selected Google Drive folder `CCPun-Financial Advisor Project` is the source of truth for private strategy/research documents and long-lived media. Its verified children include `Website 4.2 — Admin Control Plane` and the existing `Website 4.2 — Media Library`. Folder names are inventory labels only; do not hard-code Drive file/folder IDs in public code or documentation. Sanity remains the Article Draft/Published system, Sanity `internal` is deferred, and Neon remains the operational-state system. Do not copy Drive document bodies into Sanity or Neon.

Admin may project only metadata, a Drive link, and a Drive-hosted preview for a file selected interactively through Google Picker with `drive.file`. This does not authorize folder crawling, broad `drive` or `drive.readonly` scopes, token persistence, a provider connection, or media/document duplication.

Sanity `ccb9lnw5/uat` and `ccb9lnw5/recovery` remain private during the current trial. If the trial expires, both datasets revert to public visibility; the intended no-new-spend steady state keeps only `uat` as the active public test lane. Before expiry, keep `uat` limited to synthetic data and authenticated Drafts; export and checksum any private or Production restore material in `recovery` to encrypted local storage or the Restricted area of the selected Drive folder, then verify read-back. Do not allow the trial to lapse while that material remains. No deletion is authorized by this runbook.

## Recommended setup order

1. Finish and merge the synthetic foundation.
2. Apply the reviewed additive migration to Neon UAT only.
3. Inventory the private-trial Sanity datasets and complete the protected export/checksum/read-back gate before any public transition or separately approved deletion.
4. Keep every provider feature flag disabled by default.
5. Use the existing Picker plus `drive.file` contract for owner-selected Drive files; do not create a persistent Drive provider connection.
6. Create or select another provider **UAT** app/client only after its exact callback route is present in a reviewed Preview.
7. Authorize the minimum read-only scope and one owner account.
8. Verify connection, expiry, refresh-required, revoked, and reconnect behavior.
9. Run a manual read-only sync and review its evidence/limitations.
10. Request publishing scopes separately, one platform at a time.

## Google Search Console

Purpose: actual CCPUN organic-search observations plus the owner-approved post-publish sitemap discovery signal. Search Analytics and URL Inspection remain observation-only.

1. Existing Search Analytics / URL Inspection remain on the scoped read-only grant: `https://www.googleapis.com/auth/webmasters.readonly`.
2. Do not upgrade the existing read token. The optional sitemap writer uses a separate owner-authorized OAuth client and refresh token on the private VPS only.
3. After accepted UAT migration, provision CCPUN_GSC_SITEMAP_CLIENT_ID, CCPUN_GSC_SITEMAP_CLIENT_SECRET and CCPUN_GSC_SITEMAP_REFRESH_TOKEN on VPS, then explicitly accept CCPUN_GSC_SITEMAP_WRITE_ENABLED=1 for a guarded single canary.
4. Write permission applies only to submitting the known blog sitemap on property sc-domain:ccpun.com. It is not the Google Indexing API or a per-URL request.
5. See docs/architecture/seo-post-publish-vps-20261008.md for current ownership, retry, receipts and rollback gates.

Current temporary UAT names are `CCPUN_GSC_ACCESS_TOKEN` and `CCPUN_GSC_SITE_URL`. They are server-only and branch-scoped. They are not the permanent refreshable connection design and must not be copied to Production.

Official references:

- https://developers.google.com/webmaster-tools/v1/how-tos/authorizing
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query

## Google Analytics 4

Purpose: page-level behavior and approved business-intent events; never customer-level health or financial answers.

1. Enable **Google Analytics Data API** in the UAT Google Cloud project.
2. Use OAuth user authorization and request only `https://www.googleapis.com/auth/analytics.readonly` for the owner-operated UAT flow.
3. Ensure the Google user has Viewer access to the intended GA4 property.
4. Copy only the numeric property ID, not a Measurement ID or stream ID.
5. Verify landing page, sessions, engaged sessions, engagement rate, and only existing approved event names. Do not rename events or bypass `lib/analytics.ts`.

Current temporary UAT names are `CCPUN_GA4_ACCESS_TOKEN` and `CCPUN_GA4_PROPERTY_ID`. They are server-only and branch-scoped, not a permanent refresh-token store.

Official references:

- https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart
- https://developers.google.com/analytics/devguides/reporting/data/v1/quotas

## Google Drive private document and media source

Purpose: use the owner's existing Drive as the source of truth for private strategy/research documents and long-lived media while avoiding a paid duplicate store.

1. Enable **Google Drive API**, **Google Picker API** and **Google Sheets API** in a UAT Google Cloud project.
2. Request only `https://www.googleapis.com/auth/drive.file`; do not request broad `drive` or `drive.readonly` access.
3. Use Google Picker so the owner explicitly shares/selects the folder and files.
4. Select the existing folder named **`CCPun-Financial Advisor Project`**.
5. Record the immutable folder ID returned by Drive as the CCPUN root. The folder name is descriptive only and is never an authorization check.
6. Reject shortcuts, trashed files, moved files, multiple parents, cycles, and any file whose current parent chain cannot be proven to descend from that exact root ID.
7. Let Admin show only selected-file metadata, link and Drive-hosted preview; never copy the document body into Sanity or Neon.
8. Keep media bytes out of Vercel Functions. Use direct/resumable provider upload or temporary object staging only when required.

The current PR57 browser flow requests a short-lived owner access token, keeps it in React memory only, opens Google Picker and revalidates selected-file metadata, approved roots, size and SHA-256 before approval or execution. The same memory-only authorization can create a manual Google Sheets export. It does not persist refresh tokens or create a background provider connection. Do not put Drive tokens in Sanity, Neon documents, source, logs or browser storage.

Official references:

- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/guides/picker

## Meta: Facebook Page and Instagram

Purpose: Page/Instagram discovery first, then historical analytics, then separately approved publishing.

1. Create or select a Meta **Development** app for CCPUN UAT. Keep it separate from any future Production app.
2. Configure one exact UAT OAuth callback only after the route exists in the reviewed Preview.
3. Start with the already-modeled read permissions `pages_show_list`, `pages_read_engagement` and `instagram_basic`.
4. Select the Facebook Page explicitly; do not auto-select when multiple Pages are returned.
5. Verify whether an Instagram professional account is linked and show `not-linked` when absent.
6. Add Insights or publishing permissions only after checking the current Meta App Dashboard/App Review requirements for the exact intended endpoint and content type.
7. Keep Groups as assisted browser distribution. Do not implement unofficial server-side Group posting.

### Meta MCP

Meta's current official MCP offering is **Meta Devtools MCP**. It can help Codex manage Meta apps, webhooks, compliance, App Review status, and developer documentation. It is not the deployed CCPUN runtime Graph API connection and does not replace Page/Instagram access tokens.

Safe connection procedure:

1. Open https://developers.facebook.com/documentation/mcp/ and choose **Meta Devtools MCP**.
2. In Codex App, add the remote MCP server URL shown on that official server page.
3. Sign in to Meta manually.
4. Select only the UAT app and the minimum read scopes needed for app inspection.
5. Do not grant manage/write scopes to an agent processing SERP, comments, captions, webhooks, or other untrusted content.
6. Review/revoke the integration periodically under Facebook Business Integrations.

Official references:

- https://developers.facebook.com/documentation/mcp/
- https://developers.facebook.com/documentation/mcp/devtools-mcp
- https://developers.facebook.com/docs/permissions/
- https://developers.facebook.com/docs/pages-api/posts/
- https://developers.facebook.com/docs/instagram-platform/content-publishing/

## YouTube

Purpose: historical channel/video analytics first; resumable upload and native scheduling later.

1. Enable **YouTube Data API v3** and **YouTube Analytics API** in a UAT Google Cloud project.
2. Create an OAuth web client only after the exact UAT callback route exists.
3. For read-only channel data, request `https://www.googleapis.com/auth/youtube.readonly`.
4. For non-monetary analytics, request `https://www.googleapis.com/auth/yt-analytics.readonly` only when analytics ingestion is enabled.
5. Do not use a service account for channel analytics or uploads.
6. Add `https://www.googleapis.com/auth/youtube.upload` only in the reviewed publishing phase.
7. Test uploads as private and use YouTube's resumable upload. Unverified API projects can be restricted to private uploads until the required audit passes.

Official references:

- https://developers.google.com/youtube/documentation/authentication
- https://developers.google.com/youtube/reporting/guides/authorization
- https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- https://developers.google.com/youtube/v3/docs/videos/insert

## TikTok

Purpose: historical public-video metadata first; Upload-to-TikTok/native finish before broad direct publishing.

1. Register a TikTok for Developers app and add Login Kit/Display API only for the read-only connection phase.
2. Request `video.list` for the approved user's public video list and available post statistics.
3. Add **Content Posting API** only in the publishing phase.
4. Request `video.publish` only after the app and user are approved for it.
5. Prefer Upload to TikTok/native finish when music, effects, cover, or native editing matters.
6. For direct publishing, use official `FILE_UPLOAD` or a URL under a verified domain/prefix. Do not pass large files through a Vercel Function.
7. Treat unaudited-client posts as private until TikTok audit requirements are satisfied.

Official references:

- https://developers.tiktok.com/doc/content-posting-api-get-started/
- https://developers.tiktok.com/doc/tiktok-api-v2-video-list/
- https://developers.tiktok.com/doc/oauth-user-access-token-management/

## Ubersuggest

Reuse the existing CCPUN connector and its pinned issuer/discovery checks. Do not invent a generic API key field. The owner must complete the provider's interactive authorization and quota confirmation in UAT. Keep research results as untrusted evidence and route them to a Research Snapshot or Review Proposal; never overwrite an article.

## Credential and environment rules

- Never paste a secret into chat, source, a command, Sanity, or documentation.
- Use Vercel **Sensitive** variables, exact Admin Preview branch scope, and server-only names.
- Read back names, types, scopes, and branch targets only; never reveal values.
- OAuth client secret, access token, and refresh token are different values. Do not place a refresh token in an access-token variable.
- Each UAT callback must match the deployed URL exactly, including path and scheme.
- A provider callback is separate from `/api/auth/callback/google`, which belongs to Admin login.
- Production provider credentials, callback URLs, scopes, and feature flags require a separate exact approval after UAT passes.

## Cost boundary

This preparation creates no paid resource. The steady-state target uses the owner's Google Drive allowance, the current Neon Free resource and existing API quotas without a standing object-storage or provider-connection cost. Quotas, review requirements and pricing can change; verify each provider dashboard before any separately approved recurring sync or upload phase. Do not activate DataForSEO, object storage, paid delivery or a billing upgrade without separate owner approval.

## Ready-for-owner checklist

- [ ] Exact provider UAT callback route exists and is deployed.
- [ ] UAT OAuth/app is separate from Production.
- [ ] Minimum scopes are documented and visible on consent.
- [ ] Token storage is server-only, encrypted at rest, revocable, and audited.
- [ ] Not-connected, expired, revoked, and reconnect states pass.
- [ ] Manual read-only sync passes; no scheduler/background sync exists without separate exact approval.
- [ ] Provider freshness, limits, and partial-data warnings are visible.
- [ ] No real post or Production content mutation is possible in the read-only phase.
- [ ] Publishing scope is requested only by a separate approved phase.

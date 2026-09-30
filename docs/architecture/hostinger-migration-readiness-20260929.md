# Hostinger Web + Admin migration readiness — revised 2026-09-30

## Decision boundary

Current COO instruction (2026-09-30): migrate both `ccpun.com` and `admin.ccpun.com` to Hostinger, with Admin's article-production and SEO workflow as the highest priority. This supersedes the earlier instruction to keep Admin hosting on Vercel. Preparation and related implementation/candidate verification are authorized. The earlier boundary to leave DNS unchanged remains active: prepare and verify both systems before any separately approved traffic switch. Production content publication, Production merge, customer messages, credential copying and purchases are not implied.

The complete public-Web scope includes rendered pages, static assets, image optimization, API/server routes, LINE ingress and continuation/delivery, public Sanity reads, calculators/exports, consent and tracking, SEO/AEO/GEO, custom-domain TLS, release identity, restart and recovery. Admin scope includes owner login/session/authorization, Studio/editorial workflows, SEO controls/reviews/Preview, publication and durable scheduling, operational queue/audit/private archive and its server APIs. A final architecture that silently keeps Web/Admin functions or scheduler execution on Vercel is not this migration. Sanity, Neon, LINE and existing external business providers remain their current data/service planes.

Status: **NOT READY — pre-DNS remediation in progress**. The 2026-09-30 audit found actual runtime failures despite the earlier parity checker passing. The audit's observations and the current task's fresh evidence take precedence over old readiness claims. Parent task: `hostinger-pre-dns-readiness-20260930`.

The desired migration is infrastructure-only:

- keep `ccpun.com` URLs, trailing slashes, canonicals, redirects and sitemap membership unchanged;
- keep Sanity and Neon as the existing data planes;
- keep content and schema unchanged during the hosting cutover;
- deploy `apps/web` as the Hostinger Web App shadow;
- compare Vercel and Hostinger before DNS changes.

## Baseline captured before migration

The following figures are historical snapshots from 2026-09-29, not measurements of the fixed candidate or fresh cutover evidence.

Ubersuggest production crawl on 2026-09-29:

- technical score: 75/100;
- 20 URLs crawled;
- 17 successful, 1 redirected, 0 broken, 2 blocked;
- no 4xx issue count, no duplicate title issue count and no duplicate meta-description issue count;
- six category/index pages flagged for low word count.

PageSpeed baseline:

- Desktop LCP: 601 ms;
- Desktop CLS: 0;
- Mobile LCP: 2.4 s;
- Mobile CLS: 0.

Search baseline:

- 110 tracked Thai keywords;
- current tracked positions include CCPun #10, พีระมิดทางการเงิน #12, พีระมิดการเงิน #15, financial pyramid #25, aia health happy #28 and ประกัน aia health happy #30.

AI Search Visibility baseline:

- 10 tracked prompts;
- 20 sampled AI answers;
- CCPun mentions: 0;
- CCPun visibility: 0%.

These values are measurement baselines, not cutover targets by themselves. Host migration must not introduce a technical regression while organic and AI visibility are still developing.

## Hostinger Web environment contract

Production Web must use:

```text
CCPUN_DEPLOYMENT_PROVIDER=hostinger
CCPUN_DEPLOYMENT_ROLE=web
CCPUN_APP_ENV=production
NEXT_PUBLIC_CCPUN_APP_ENV=production
NEXT_PUBLIC_SANITY_PROJECT_ID=kyfxgjnq
NEXT_PUBLIC_SANITY_DATASET=production
CCPUN_UAT_MODE=0
CCPUN_ENABLE_PRODUCTION_ANALYTICS=1
```

Do not set `VERCEL_PROJECT_ID` or `VERCEL_ENV` on Hostinger.

Web UAT/shadow must use:

```text
CCPUN_DEPLOYMENT_PROVIDER=hostinger
CCPUN_DEPLOYMENT_ROLE=web
CCPUN_RELEASE_STAGE=shadow
CCPUN_APP_ENV=web-uat
NEXT_PUBLIC_CCPUN_APP_ENV=web-uat
NEXT_PUBLIC_SANITY_PROJECT_ID=ccb9lnw5
NEXT_PUBLIC_SANITY_DATASET=uat
CCPUN_UAT_MODE=1
CCPUN_ENABLE_PRODUCTION_ANALYTICS=0
```

Production Candidate is a separate pre-cutover lane. It reads the Production Sanity dataset for full content/SEO parity, but the temporary Hostinger hostname must remain blocked from indexing and production analytics must stay off:

```text
CCPUN_DEPLOYMENT_PROVIDER=hostinger
CCPUN_DEPLOYMENT_ROLE=web
CCPUN_RELEASE_STAGE=candidate
CCPUN_APP_ENV=production
NEXT_PUBLIC_CCPUN_APP_ENV=production
NEXT_PUBLIC_SANITY_PROJECT_ID=kyfxgjnq
NEXT_PUBLIC_SANITY_DATASET=production
CCPUN_UAT_MODE=1
CCPUN_ENABLE_PRODUCTION_ANALYTICS=0
CCPUN_GIT_REF=<exact candidate branch or release ref>
CCPUN_GIT_SHA=<exact candidate sha>
CCPUN_RELEASE_ID=<unique candidate release id>
```

Live Production is allowed only after the candidate gates pass. It switches indexing and analytics on and requires the production branch identity:

```text
CCPUN_DEPLOYMENT_PROVIDER=hostinger
CCPUN_DEPLOYMENT_ROLE=web
CCPUN_RELEASE_STAGE=live
CCPUN_APP_ENV=production
NEXT_PUBLIC_CCPUN_APP_ENV=production
NEXT_PUBLIC_SANITY_PROJECT_ID=kyfxgjnq
NEXT_PUBLIC_SANITY_DATASET=production
CCPUN_UAT_MODE=0
CCPUN_ENABLE_PRODUCTION_ANALYTICS=1
CCPUN_GIT_REF=v4-production
CCPUN_GIT_SHA=<exact merged production sha>
CCPUN_RELEASE_ID=<unique live release id>
```

The readiness gate is:

```bash
npm run check:hostinger
```

## SEO / AEO / GEO release gates

Before DNS cutover, run the shadow app and compare it against Vercel:

```bash
npm run qa:hostinger:parity -- \
  --source https://ccpun.com \
  --target https://<hostinger-shadow-host>
```

Shadow mode is the default. It validates the Hostinger runtime and static SEO contract while deliberately allowing Sanity UAT content membership to differ from Production:

- HTTP status and redirect-chain parity on static/public shell routes;
- canonical URL parity;
- title and H1 parity;
- JSON-LD schema type parity;
- root/core/tools sitemap membership parity;
- blog sitemap must stay on the canonical `https://ccpun.com/` host, but UAT article membership is not required to equal Production;
- `X-Robots-Tag` contains `noindex, nofollow, noarchive`;
- `robots.txt` blocks all crawlers and does not advertise a sitemap;
- OAI-SearchBot, Claude-SearchBot and PerplexityBot can reach representative static Shadow pages without HTTP errors while receiving the same noindex protection.

After Shadow passes, create a Production Candidate on the temporary Hostinger hostname. This candidate uses Production Sanity for full page and sitemap parity, but remains blocked from indexing:

```bash
npm run qa:hostinger:parity -- \
  --source https://ccpun.com \
  --target https://<hostinger-production-candidate> \
  --target-mode candidate
```

Candidate mode requires full production-content parity plus the same `noindex, nofollow, noarchive` and block-all robots safety used on Shadow.

Only after candidate parity passes and the approved commit is merged/redeployed from `v4-production` should the final live check use:

```bash
npm run qa:hostinger:parity -- \
  --source https://ccpun.com \
  --target https://<hostinger-live-target> \
  --target-mode production
```

Production mode requires full content parity and meta robots, X-Robots-Tag and robots.txt parity with the current Vercel production site. Remove the Hostinger preview/temporary domain after the custom domain is stable so an indexable duplicate hostname is not left online.

After Shadow parity passes, re-run PageSpeed/Ubersuggest against the Hostinger shadow. Mobile LCP is a critical gate because the current baseline is already about 2.4 s.

## Admin and article/SEO priority

Admin is a private editorial/control plane and must stay authenticated and noindex. SEO success is measured on the published article's `ccpun.com` URL, not by making Admin pages indexable. Retain the current article document IDs, Edit Intent, schemas, canonical URL ownership, locked slugs, category/topic distinction, legacy redirects, workflow audit and publish/review controls. Do not rewrite published content or create speculative replacement SEO features during migration.

The highest-priority acceptance flow is:

1. Owner signs in to the isolated Admin candidate with the correct lane and session permissions; unauthenticated users cannot reach Studio, previews, drafts, exports or private APIs.
2. An isolated UAT article can be written/edited, saved, reopened and reviewed without loss of content, structured fields, source citations, cover/alt, category or logical document identity.
3. Existing title/description/canonical/noindex/OG/schema/FAQ/source/SEO review controls work. Author/review and URL-lock rules survive migration. Public URLs remain stable.
4. Preview shows the correct private Draft, and public Web continues to show only published data. Preview noindex and token/session boundaries remain intact.
5. Controlled UAT publish updates the correct public page, category/index and sitemap under known cache behavior; unpublish/rollback restores only the synthetic test. Verify the emitted article title, body, links, images, canonical, robots, complete JSON-LD and sitemap entry/lastmod.
6. Durable scheduled UAT publication, edit/reschedule, cancellation, retry/dedup and process restart each preserve one logical job and the intended publication state/audit. No duplicate publish and no orphaned queued work.
7. Verify actual cross-runtime Web/Admin collaboration and private API authorization on Hostinger. Hostinger owner auth, service identity and workflow transport must be designed and positively/negatively tested before activation.

These are migration preservation tests, not permission to publish Production articles. Current SEO/article capabilities are the source of truth; first identify a missing migration behavior before writing a feature.

## Durable scheduler and service trust

The current Article Scheduler uses `workflow` / `withWorkflow()`. On non-Vercel hosting the SDK defaults to a local filesystem World unless explicitly configured. The official self-hosted Postgres World is available, but self-hosted Workflow handler endpoints must be authenticated or protected at the network layer.

Do not move Admin production merely by setting `WORKFLOW_TARGET_WORLD=local`. That is forbidden for a deployed Hostinger lane.

Admin becomes eligible for the planned Hostinger cutover only after one of these paths is completed and tested:

1. move Article Scheduler execution to the approved n8n orchestration path; or
2. configure the official Postgres World, durable storage, worker startup and authenticated/private `/.well-known/workflow/*` transport.

The preferred first investigation preserves the existing Workflow pipeline using a compatible durable Postgres World and a proven worker/transport lifecycle. The official reference implementation is not authenticated by default. Hostinger Cloud's support for an HTTP Node app does not itself prove persistent idle worker execution or private execution-route protection. If the Cloud process model cannot meet those requirements, evaluate a bounded worker on the existing Hostinger VPS after current resource and security evidence. Never use local filesystem World in a deployed lane, silently activate a legacy n8n publisher, or purchase infrastructure by implication.

Both Hostinger runtimes also need provider-neutral Web/Admin service trust. Existing native LINE ingress and per-outbound business capabilities remain useful, but the existing Vercel OIDC diagnostic/gateway cannot be satisfied by spoofing `VERCEL_*` values. The earlier Admin-on-Vercel native diagnostic proposal is transitional and is paused before implementation. Design the final two-Hostinger identity/auth contract, preserve least privilege and prove denied/tampered/replayed/wrong-lane callers. Do not reuse business dispatch tokens or customer data to manufacture health success.

### Hostinger Admin identity

Use explicit `CCPUN_DEPLOYMENT_PROVIDER=hostinger`, `CCPUN_DEPLOYMENT_ROLE=admin` and the actual Admin lane: `admin-uat` with UAT Sanity for isolated tests, then `production-admin` with the exact approved Production project/dataset for release. Preserve the approved `admin.ccpun.com` owner-auth URL/callback/session contract. Do not copy Production secrets into UAT, set fake Vercel variables, or claim an Admin HTTP 200 certifies login/Studio/scheduler.

## Pre-DNS execution order

PR #311 is already merged as `3bba7c662c539f0aecb6677b5cfc9020ef6740db`; the former instruction to leave it unmerged is historical. Start fixes from freshly verified Production source, on isolated `codex/hostinger-pre-dns-20260930`. Preserve all unrelated dirty work, PR #165 and the original checkout.

1. Record fresh GitHub, Hostinger, Vercel Web/Admin, Sanity/Neon lane metadata and authoritative DNS identities. Preserve both currently working Vercel deployments/aliases as recovery targets. Do not edit DNS or Production content. Inventory the actual Admin editorial/SEO/scheduler/auth/service contracts before implementing migration adapters.
2. Fix public-directory materialization and standalone staging, repeat-build failure, cached candidate robots and any proven source header defect. Include runnable regressions against the observed failures. Do not weaken assertions or fabricate branch/SHA values to open a gate.
3. Review the exact changed paths, run required repository checks and build the Web standalone output. Install from the lockfile in this worktree; do not borrow another worktree's dependencies. Freeze release provenance and create a reviewed branch artifact.
4. Deploy the reviewed Web artifact to the existing temporary Hostinger candidate. Prepare a separate isolated Hostinger Admin candidate with the approved UAT lane, secure owner auth and a proven durable scheduler/transport backend. Keep noindex and Web analytics off; Production content remains read-only. Use actual branch/SHA and verify each completed build plus running behavior. A queued job is not completion. A new website/secret/backend configuration is an exact provider operation, not an assumed side effect of a plan.
5. Rerun the corrected checker and independent browser/HTTP probes over all sitemap pages, emitted HTML/JSON-LD, legacy/slash redirects, XML/TXT/security files, public images, optimized images, CSS/JS/fonts, 404s, private routes and crawler groups. Check effective response headers, not source intent. Diagnose any CDN overrides before certifying the candidate.
6. Verify native LINE and the final Hostinger Web/Admin trust contract in correctly isolated UAT lanes with least-privilege UAT credentials configured through the owner/provider's secure mechanism. Test non-empty signed events, denied signatures, dedup/redelivery, postback context, encryption, database ingestion, continuation/delivery capability, retry/restart and no-send behavior. Keep Production credentials out of Shadow/UAT and do not contact customers. Test both providers' real service identity; the existing Vercel-only diagnostic remains a distinct legacy mechanism, not a substitute for native business E2E.
7. Complete the seven-step priority Admin article/SEO acceptance flow above, including durable scheduler failures/recovery, then verify public content freshness/cache behavior and controlled UAT cleanup. Production remains read-only. Confirm representative published Production snapshots separately; a snapshot match alone is not freshness proof.
8. Complete browser QA for Home, Blog/category/articles, FHC and CI: mobile/desktop, keyboard, calculator boundaries, result/export, CTA destinations, controlled synthetic conversion sink, consent enable/revoke and duplicate-event prevention. Keep candidate live tracking off; prepare the exact existing production tracking IDs securely and verify continuity without leaking calculator or customer data.
9. Prepare the custom `ccpun.com`, `www` and `admin.ccpun.com` Hostinger mappings without altering public DNS. Resolve the separate existing Hostinger `ccpun.com` website identity; never delete it merely to bypass a domain collision. Obtain supported pre-provisioning TLS and exact certified targets/records. Validate all three hostnames with proper SNI and certificate verification against their targets. Temporary-host SSL and a guessed CDN IP do not satisfy this gate.
10. Rehearse Web/Admin process and worker restart/recovery using pinned source/lockfile/release manifests and supported restoration/redeployment paths. Keep two known-good releases with checksums; demonstrate restoration and continuation of durable jobs. Extend the existing guarded Cloudflare rollback to the exact Admin record as well as apex/www; preserve all unrelated records. A written rollback is not an executed rehearsal.
11. After assets are healthy, measure at least five paired cold and warm browser runs per representative route against current Vercel. Record environment/network profile, distribution/median, TTFB, actual image LCP element, CLS and errors. Broken-image LCP results cannot count as improvement. Address regressions before signing this gate.
12. Integrate all gate evidence for one exact artifact. If source changes, refresh the affected checks. Obtain review/authorization for any required Production merge; then build the exact merged `v4-production` SHA on Hostinger with indexing and analytics still blocked, and repeat the relevant candidate checks. The real Production ref is needed by the existing native LINE runtime policy.
13. Declare **READY FOR DNS** only after every mandatory gate below is CONFIRMED, prerequisites are securely configured and rollback is executable. Leave public DNS unchanged and hand the exact target/release/record diff to the COO for the separate cutover decision.

## Mandatory pre-DNS acceptance gates

| Gate | Required evidence |
| --- | --- |
| Release identity | GitHub SHA, reviewed source, completed Hostinger build and actual runtime agree; correct provider/role/lane; no spoofed Vercel identity |
| Public runtime | All emitted public asset/image/font requests in the defined full crawl succeed; real pages and errors render; no EEXIST on repeated build |
| SEO/AEO/GEO | Full recursive sitemap/content/metadata/schema/redirect parity; correct crawler-group semantics; candidate noindex and private boundary; release checker negative fixtures pass |
| Security | Effective CSP/security headers, protected Admin/Draft/private routes, relevant dependency reachability and denied auth/input probes |
| Native LINE/service trust | Positive isolated signed business E2E, signature-denied and dedup/retry/restart evidence; final least-privilege configuration and actual Hostinger Web/Admin caller trust |
| Admin articles/SEO — highest priority | Owner login/session, Draft edit/save/reopen, SEO review/Preview, safe publication, durable scheduler/reschedule/cancel/retry/restart and article page/category/sitemap/schema/cache correctness |
| Content | Published-only Web reads and private Draft boundary; isolated revision-to-page/sitemap freshness with cache behavior documented |
| Tools/conversion/privacy | FHC/CI calculations and exports, CTA/controlled conversion path, consent revoke/enable, event mapping/duplication/privacy and prepared production IDs |
| Custom domain/TLS | Exact Hostinger apex/www/Admin mappings, certified targets, valid certificates and verified SNI preflight before traffic moves |
| Reliability/recovery | Candidate Web/Admin/worker restart and pinned restoration rehearsed, durable jobs survive; both Vercel recovery targets retained; DNS rollback values read back |
| Performance | Healthy-image paired warm/cold route measurements meet reviewed baseline with disclosed limits |
| Scope preservation | Existing Vercel deployments, Production content/data, other domains, PR #165 and authoritative DNS retain their approved state during preparation |

Any BLOCKED, PARTIAL or NOT VERIFIED mandatory gate means **NOT READY**. Record the missing evidence, consequence, next owner and exact action; do not waive a gate because the provider normally issues SSL after DNS. If this plan cannot pre-provision TLS with the current platform, return that concrete provider dependency to the COO instead of switching traffic experimentally.

## After separate DNS authorization

The future release must coordinate final live stage/indexing/analytics, domain routing and public DNS so the live custom domain is not accidentally left noindex or with tracking disabled. Changing a stage while the temporary host is public must not leave an indexable duplicate. This coordination is a future reviewed release action, not authorized by this preparation document.

Only then: execute the separately reviewed staged cutover of Admin/service prerequisites and public Web using the exact approved apex/www/Admin record diff while preserving NS/mail/verification/CAA and other records. Order must follow the final trust and scheduler prerequisites, not a simultaneous blind DNS switch. Verify custom-domain TLS, owner/article workflow, complete public business/SEO/consent behavior and exact identities; use the prepared rollback if acceptance fails. Preserve scheduler ownership so two providers cannot publish the same scheduled job during overlap or rollback. Retain both Vercel recovery deployments until the agreed observation window passes. Do not cancel Vercel or remove existing aliases by implication. Monitor publishing/audit/queue, GSC/crawl/CWV, analytics and actual crawler logs with separately authorized follow-up.

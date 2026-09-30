# Hostinger migration readiness — 2026-09-29

## Decision boundary

Prepare Hostinger before purchase, but do not change DNS or production hosting yet. The first safe cutover target is the public Web app only. Admin remains on Vercel until the Article Scheduler runtime has an approved self-hosted execution path.

The desired migration is infrastructure-only:

- keep `ccpun.com` URLs, trailing slashes, canonicals, redirects and sitemap membership unchanged;
- keep Sanity and Neon as the existing data planes;
- keep content and schema unchanged during the hosting cutover;
- deploy `apps/web` as the Hostinger Web App shadow;
- compare Vercel and Hostinger before DNS changes.

## Baseline captured before migration

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

## Why Admin is not in the first cutover

The current Article Scheduler uses `workflow` / `withWorkflow()`. On non-Vercel hosting the SDK defaults to a local filesystem World unless explicitly configured. The official self-hosted Postgres World is available, but self-hosted Workflow handler endpoints must be authenticated or protected at the network layer.

Do not move Admin production merely by setting `WORKFLOW_TARGET_WORLD=local`. That is forbidden for a deployed Hostinger lane.

Admin becomes eligible for Hostinger only after one of these paths is completed and tested:

1. move Article Scheduler execution to the approved n8n orchestration path; or
2. configure the official Postgres World, durable storage, worker startup and authenticated/private `/.well-known/workflow/*` transport.

Until then, moving public Web first keeps SEO/AEO/GEO risk isolated from Admin runtime work.

## Cutover order

1. Keep PR #311 unmerged while Shadow UAT is being validated.
2. Deploy `apps/web` to the Hostinger Shadow hostname with UAT Sanity, `CCPUN_RELEASE_STAGE=shadow`, indexing blocked and analytics off.
3. Run Shadow readiness/parity plus runtime smoke tests. Do not require UAT article membership to equal Production.
4. Reconfigure the same Hostinger app as a Production Candidate using Production Sanity, `CCPUN_RELEASE_STAGE=candidate`, `CCPUN_UAT_MODE=1` and analytics off.
5. Run full candidate parity, Ubersuggest crawl and PageSpeed against the temporary Hostinger hostname.
6. Freeze URL/content/schema changes and merge only after the candidate gates pass.
7. Redeploy the exact merged `v4-production` SHA and repeat the candidate parity check while indexing is still blocked.
8. Connect/cut over `ccpun.com` only after all P0 gates pass, then switch the Hostinger lane to `CCPUN_RELEASE_STAGE=live`, `CCPUN_UAT_MODE=0` and analytics on.
9. Verify canonical/robots/sitemap behavior on the custom domain, then remove the Hostinger preview/temporary domain once the custom domain is stable.
10. Monitor GSC, crawl errors, rankings, Core Web Vitals and AI crawler logs after cutover.
11. Keep Admin on Vercel until its separate runtime gate passes.

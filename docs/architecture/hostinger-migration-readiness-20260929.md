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
CCPUN_APP_ENV=web-uat
NEXT_PUBLIC_CCPUN_APP_ENV=web-uat
NEXT_PUBLIC_SANITY_PROJECT_ID=ccb9lnw5
NEXT_PUBLIC_SANITY_DATASET=uat
CCPUN_UAT_MODE=1
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

Shadow mode is the default. It requires content/route parity while deliberately enforcing UAT indexing safety:

- HTTP status and redirect-chain parity;
- canonical URL parity;
- title and H1 parity;
- JSON-LD schema type parity;
- sitemap URL membership parity for root, core, tools and blog sitemaps;
- `X-Robots-Tag` on Shadow contains `noindex, nofollow, noarchive`;
- Shadow `robots.txt` blocks all crawlers and does not advertise a sitemap;
- OAI-SearchBot, Claude-SearchBot and PerplexityBot can reach representative Shadow pages without HTTP errors while receiving the same Shadow noindex protection.

For the final production candidate after UAT protection is removed, run:

```bash
npm run qa:hostinger:parity -- \
  --source https://ccpun.com \
  --target https://<hostinger-production-candidate> \
  --target-mode production
```

Production mode additionally requires meta robots, X-Robots-Tag and robots.txt parity with the current Vercel production site.

After Shadow parity passes, re-run PageSpeed/Ubersuggest against the Hostinger shadow. Mobile LCP is a critical gate because the current baseline is already about 2.4 s.

## Why Admin is not in the first cutover

The current Article Scheduler uses `workflow` / `withWorkflow()`. On non-Vercel hosting the SDK defaults to a local filesystem World unless explicitly configured. The official self-hosted Postgres World is available, but self-hosted Workflow handler endpoints must be authenticated or protected at the network layer.

Do not move Admin production merely by setting `WORKFLOW_TARGET_WORLD=local`. That is forbidden for a deployed Hostinger lane.

Admin becomes eligible for Hostinger only after one of these paths is completed and tested:

1. move Article Scheduler execution to the approved n8n orchestration path; or
2. configure the official Postgres World, durable storage, worker startup and authenticated/private `/.well-known/workflow/*` transport.

Until then, moving public Web first keeps SEO/AEO/GEO risk isolated from Admin runtime work.

## Cutover order

1. Merge only readiness/build fixes that preserve current Vercel behavior.
2. Purchase/provision Hostinger only after the Web Hostinger CI is green.
3. Deploy `apps/web` to a Hostinger shadow/UAT hostname.
4. Run `check:hostinger`, parity QA, Ubersuggest crawl and PageSpeed.
5. Verify Sanity production read path and public analytics.
6. Freeze URL/content/schema changes.
7. Switch `ccpun.com` DNS only after all P0 parity gates pass.
8. Monitor GSC, crawl errors, rankings, Core Web Vitals and AI crawler logs after cutover.
9. Keep Admin on Vercel until its separate runtime gate passes.

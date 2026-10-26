# C10 local inline CSS trial

Task-ID: v5-inline-css-trial-20261026. Base: 87cee9d86f28a9aaba004cdae38fb318f0aa44db (C9). This is an offline compiled-app comparison, not deployed UAT acceptance.

Product delta: one `inlineCss: true` property in `apps/web/next.config.ts`. Web already owns its independent config. Root/Admin config, CSP, `CRITICAL_FOUNDATION_CSS`, consent/timing, CSS, layouts, URLs and package/lock sources are unchanged.

Baseline/candidate use Node 24.22.1, the same local Kanit fixture, development/local Web lane, UAT public fixture identifiers and `CCPUN_INVESTMENT_ALLOCATION_ENABLED=1`. The article is synthetic, never requested from a CMS. Its path is `/blog/personal-finance/c10-local-fixture/`. All six measured routes return 200. Initial Next static generation logs safe mocked-content request failures; the actual runtime fixture renders the six required pages in both builds. This does not verify real CMS connectivity.

Text evidence: `baseline/sizes.json`, `candidate/sizes.json`, both `browser.json` files, `comparison.json` and `verification.json`. Local PNG and raw HTML captures are intentionally ignored, not committed. Size measurements are decoded response HTML recompressed using Node gzip level 9 and Brotli quality 11; they exclude separately cached CSS/JS transfers. Stylesheet/style counts use parsed DOM, not string occurrences in RSC script text.

Reproduce with the repository's existing dependencies and local font fixture; do not install packages or source local environment files. Copy `qa/v5-inline-css-network.mjs` and `qa/v5-inline-css-fixture.mjs` to `/private/tmp/c10-network.mjs` and `/private/tmp/c10-fixture.mjs`, then use these public-only values:

```text
PATH=/Users/punnii/.nvm/versions/node/v24.22.1/bin:/usr/bin:/bin:/usr/sbin:/sbin
CCPUN_APP_ENV=development
NEXT_PUBLIC_CCPUN_APP_ENV=development
CCPUN_DEPLOYMENT_PROVIDER=local
CCPUN_DEPLOYMENT_ROLE=web
CCPUN_INVESTMENT_ALLOCATION_ENABLED=1
NEXT_PUBLIC_SANITY_PROJECT_ID=ccb9lnw5
NEXT_PUBLIC_SANITY_DATASET=uat
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/private/tmp/c7-font-mock.cjs
NODE_OPTIONS=--require /private/tmp/c10-network.mjs --require /private/tmp/c10-fixture.mjs
NEXT_TELEMETRY_DISABLED=1
```

Run `env -i` with that explicit environment and `npm run build:web:shadow` at repository root. Start from `apps/web` with `node ../../node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3020` using the same environment. The actual capture used equivalent frozen CommonJS snapshots `/private/tmp/c10-network.cjs` and `/private/tmp/c10-sanity-http-fixture.cjs`; the checked-in ESM versions pass the actual installed Sanity SDK selfcheck and Node 24 synchronous preload check. The fixture retains no real HTTP/fetch transport. The socket fence permits loopback only. Chrome requests outside the single local origin are aborted.

Run the browser harness with a clean explicit PATH and `PLAYWRIGHT_MODULE=/Users/punnii/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`:

```sh
node --import ./qa/v5-cookie-banner-timing-network.mjs qa/v5-inline-css-regression.mjs baseline
node --import ./qa/v5-cookie-banner-timing-network.mjs qa/v5-inline-css-regression.mjs candidate
```

Each variant uses fresh owned Chrome contexts, 390x844 and 1440x1000, both themes, reduced motion, 24 screenshots, theme readback on every capture, sampled first rendered frames, reload and a local navigation probe. Existing changing countdown digits are excluded only from the before/after text digest; full captured text remains in each browser JSON. Fixture article text is compared in full. Stable theme/styles in sampled frames and equal computed h1/background checks are bounded local FOUC/style-loss evidence, not a filmstrip/performance claim. View Transition capability and protected motion/CSS contracts remain covered; no stylesheet or motion source changes.

The exact source-hash inverse admits only the full reviewed config successor and reconstructs the previous whole-file hash. Original owner digests/assertions stay frozen; mutated or duplicate config additions are rejected. This helper does not normalize arbitrary source or output.

UAT decision pending: Claude must separately deploy only when authorized and run three comparable mobile measurements. KEEP requires median LCP improvement of at least 0.2s with CLS no worse. No UAT deployment or LCP/CLS acceptance is claimed here. The branch remains for that decision.

## Compressed HTML bytes

| Page | gzip before → after | Brotli before → after | CSS links | style tags |
|---|---:|---:|---:|---:|
| `/` | 25,945 → 85,030 | 16,166 → 35,394 | 3 → 0 | 5 → 6 |
| `/ci-planning/` | 27,881 → 84,021 | 17,827 → 36,265 | 2 → 0 | 1 → 2 |
| `/tools/financial-health-check/` | 21,422 → 77,657 | 14,218 → 32,634 | 2 → 0 | 1 → 2 |
| `/tools/aia-fund-allocation/` | 18,030 → 86,656 | 12,838 → 35,101 | 3 → 0 | 1 → 2 |
| `/blog/` | 17,655 → 74,096 | 12,412 → 30,743 | 2 → 0 | 2 → 2 |
| `/blog/personal-finance/c10-local-fixture/` | 19,729 → 76,879 | 13,770 → 32,433 | 3 → 0 | 1 → 2 |

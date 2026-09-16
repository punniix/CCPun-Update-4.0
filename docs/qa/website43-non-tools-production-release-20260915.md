# Website 4.3 non-tool Production release — 2026-09-15

Release branch: `release/website43-non-tools-20260915`
Base: `origin/v4-production` @ `28481dd4de521f24090b40531a8c1cc6060dcc7e`
Owner authorization: deploy reviewed Website 4.3 work to Production, explicitly excluding CI Planning and Financial Health Check.

## Included

- Home wide-desktop centering and reviewed section rhythm.
- Blog / Category shared 1280px shell centering on wide desktop.
- Article 1060px reading axis for title, featured image, body and support sections.
- Article `แหล่งอ้างอิง` explicitly kept on the same 1060px support axis.
- Website 4.3 Navbar / Footer / Legal wide-desktop centering through the shared public shell.
- Kanit first-paint optimization: full family remains optional/non-preloaded; Thai 400/600/700 are bounded critical preloads.
- Home LCP image explicit preload/high priority.
- Public Website 4.3 regression coverage.

## Explicitly excluded

No source changes from this release are allowed under:

- `features/ci-planning/**`
- `features/financial-health-check/**`
- `components/layout/ToolHero.tsx`
- `components/layout/Navbar.tsx`
- `components/layout/Footer.tsx`
- `app/components.css`
- `app/globals.css`

Tool-specific Website 4.3 transition hunks (`toolStorySection` shell centering and `toolHeroCopy` centering) were also deliberately removed from this release branch.

## Verification before PR

- Protected CI/FHC + generic tool-shell diff against `origin/v4-production`: PASS / empty.
- `npm ci`: PASS, 0 vulnerabilities.
- `npm run check:foundation`: PASS.
- New `website43-public-layout-regression.mjs`: 6/6 PASS, including release-scope exclusion checks.
- Admin suite: PASS with one existing real-Postgres integration skip.
- `npm run build`: PASS (Next.js 16.3.3 / Node 24).
- `git diff --check`: PASS.

## Font performance evidence inherited from reviewed Preview work

390x844 mobile emulation, cache disabled, 150ms latency, ~1.6 Mbps, five runs per candidate:

- baseline: median LCP ~980ms, CLS 0
- all Thai + Latin fonts preloaded: ~1252ms — rejected
- all four Thai weights preloaded: ~1272ms — rejected
- selected Thai 400/600/700 + Home hero preload: ~992ms, CLS 0

The selected strategy stays effectively at baseline LCP while making the visible Website 4.3 weights available early, without forcing text to block on font loading.

## Production gate

Merge only after GitHub Foundation CI and Vercel Preview succeed for the exact release SHA. After merge, verify the resulting `v4-production` SHA and live Home / Blog / Article routes. Confirm CI/FHC source files remain identical to the pre-release Production baseline.

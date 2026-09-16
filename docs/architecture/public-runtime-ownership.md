# Public Web runtime ownership

This document maps the current user-facing `ccpun.com` runtime. Its purpose is to make future work start from the current owner instead of reviving a retired renderer or adding another parallel implementation.

## Runtime map

| Surface | Current owner | Notes |
| --- | --- | --- |
| Home `/` | `features/home/website-43/Website43Home.tsx` | Website 4.3 is the only Home renderer. The pre-Website43 `features/home/components/` subtree was retired in Phase 3. |
| Blog archive `/blog/` | `features/blog/pages/BlogArchivePage.tsx` → `features/blog/website-43/Website43Blog.tsx` | Category Registry is injected server-side. Search/filter/carousel interaction belongs to `Website43BlogInteractive.tsx`. |
| Blog category/topic | `features/blog/pages/BlogCategoryPage.tsx` | Physical category availability comes from Sanity Category Registry; semantic hub policy remains in `lib/content/taxonomy.ts`. |
| Article | `features/blog/pages/ArticlePage.tsx` → `features/blog/website-43/Website43Article.tsx` | Body blocks, FAQ, sources, author card and visible semantic breadcrumbs render here. TOC interaction is isolated in `Website43ArticleToc.tsx`. |
| CI Planning | `features/ci-planning/page.tsx` + current `components/` + `calculator/` | `features/ci-planning/legacy/calculator.ts` is parity evidence only and must not be imported into new UI. |
| Financial Health Check | `features/financial-health-check/page.tsx` → `components/ClientFHC.tsx` → `components/LifeCoverageWizard.tsx` | The older multi-step FHC UI was retired in Phase 3. `calculator/` is retained only as a frozen regression reference until its parity contract is deliberately retired. |
| Privacy / Cookie | `app/privacy/page.tsx`, `app/cookie-policy/page.tsx` + `Website43Legal.module.css` | Legal presentation has a dedicated style owner; do not add legal rules back into the all-surface Website43 CSS map. |
| Website 4.3 shared shell | `components/layout/website-43/` | Shared server shell: `Website43Shared.tsx`; navbar client island: `Website43Navbar.tsx`; responsive runtime owner: `Website43ResponsiveStyles.tsx`. |
| Analytics / consent | `features/analytics/components/` | `ClientWidgets` is the public route-aware boundary. Consent remains mandatory before analytics providers. Meta Pixel remains route-gated to paid-tool surfaces. |
| Public content data | `lib/content/` | Sanity provider, taxonomy, URL/canonical and Category Registry contracts live here. Do not duplicate physical category ownership in presentation code. |
| Public SEO | `lib/seo/` plus `lib/content/structured-data/` | Metadata, schema and sitemap output must stay aligned with canonical routing/content ownership. |

## Blog legacy status

`features/blog/components/` contains pre-Website43 renderer source that is not reachable from the current App Router. Some files are still read directly by older regression tests. These files are **test-bound legacy**, not runtime owners.

Rules:

1. Do not import a legacy Blog component into new Public code.
2. Migrate a regression assertion to the current `pages/` / `website-43/` owner before deleting the legacy file it reads.
3. Do not weaken SEO, block-rendering, FAQ or category-registry coverage merely to remove the old file.
4. Blog/CMS media has a separate content lifecycle and is not deleted by source reachability audits.

## Calculator parity status

The CI and FHC legacy/reference calculators are not permission to maintain two Public calculators. They exist only to preserve regression evidence while current calculator owners evolve.

- CI: `features/ci-planning/legacy/calculator.ts`
- FHC: `features/financial-health-check/calculator/`

Do not import these references into new UI. Retire them only together with an equally explicit replacement parity contract.

## Public reachability model

`scripts/lib/public-reachability.mjs` exposes two graphs:

- `publicReachable` — starts from user-facing App Router page/metadata roots and excludes Control Plane, API, Studio, Workflow, Auth and Proxy roots.
- `reachable` — repository-wide route/request reachability used to distinguish internal-only code from code that has no current runtime owner anywhere.

A file reported as `orphan` is a cleanup candidate, not automatic deletion permission. Check tests, migration ledgers, protocol ownership and frozen parity contracts first.

## Client-boundary rule

Prefer server-rendered shells and narrow client islands. A component becoming interactive is not a reason to move its whole feature tree to `use client`.

Current intentional Public client islands include Blog search/filter/TOC, calculator steps/results, the Website 4.3 navbar, consent and analytics providers.

## New-work rule

Before adding a new renderer, stylesheet, static asset or dependency:

1. Identify the existing owner in this document and the audit output.
2. Extend that owner when the concern belongs there.
3. Create a new owner only when the concern is genuinely independent and name it for that responsibility.
4. Do not create `Legacy2`, `FinalPolish`, `Hotfix`, `NewNew`, or other parallel implementation layers as a substitute for consolidating ownership.
5. Update regression ownership in the same change whenever an implementation owner moves.

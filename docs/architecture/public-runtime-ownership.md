# Public Web runtime ownership

This document maps the current user-facing `ccpun.com` runtime. Future work must start from the current owner instead of reviving a retired renderer or adding a parallel implementation.

## Runtime map

| Surface | Current owner | Notes |
| --- | --- | --- |
| Home `/` | `features/home/website-43/Website43Home.tsx` | Website 4.3 is the only Home renderer. The pre-Website43 Home subtree is retired. |
| Blog archive `/blog/` | `features/blog/pages/BlogArchivePage.tsx` → `features/blog/website-43/Website43Blog.tsx` | Category Registry is injected server-side. Search/filter/carousel interaction belongs to `Website43BlogInteractive.tsx`. |
| Blog category/topic | `features/blog/pages/BlogCategoryPage.tsx` | Physical category availability comes from Sanity Category Registry; semantic hub policy remains in `lib/content/taxonomy.ts`. |
| Article | `features/blog/pages/ArticlePage.tsx` → `features/blog/website-43/Website43Article.tsx` | Body blocks belong to `Website43ArticleBody.tsx`; TOC interaction belongs to `Website43ArticleToc.tsx`. The pre-Website43 Blog renderer is retired. |
| CI Planning | `features/ci-planning/page.tsx` + current `components/` + `calculator/` | `StepExpenses.tsx` orchestrates Step 1; pure preview/model helpers live in `StepExpenses.model.ts`, debt/education UI in `ExpenseObligationsSection.tsx`, and Recovery Reserve UI in `RecoveryReserveSection.tsx`. `legacy/calculator.ts` is parity evidence only. |
| Financial Health Check | `features/financial-health-check/page.tsx` → `components/ClientFHC.tsx` → `components/LifeCoverageWizard.tsx` | Pure calculation/model helpers live in `lifeCoverageModel.ts`; the older `calculator/` directory is a frozen regression reference only. |
| Privacy / Cookie | `app/privacy/page.tsx`, `app/cookie-policy/page.tsx` + `Website43Legal.module.css` | Legal presentation has a dedicated style owner; do not add legal rules back into the all-surface Website43 CSS map. |
| Cookie consent UI | `features/analytics/components/CookieConsent.tsx` | Consent state/lifecycle stays in the main component; preference row/toggle presentation belongs to `CookieConsentPreferences.tsx`. |
| Website 4.3 shared shell | `components/layout/website-43/` | Shared server shell: `Website43Shared.tsx`; navbar client island: `Website43Navbar.tsx`; responsive runtime owner: `Website43ResponsiveStyles.tsx`. |
| Analytics / consent providers | `features/analytics/components/` | `ClientWidgets` is the public route-aware boundary. Consent remains mandatory before analytics providers. Meta Pixel remains route-gated to paid-tool surfaces. |
| Public content data | `lib/content/` | `sanity.ts` owns provider/query orchestration; `sanity-schema.ts` owns validation/parsing schemas; taxonomy, URL/canonical and Category Registry contracts remain separate owners. |
| Public SEO | `lib/seo/` plus `lib/content/structured-data/` | Metadata, schema and sitemap output must stay aligned with canonical routing/content ownership. |

## Retired implementations

The following implementation families are retired and must not be recreated as fallback or parallel renderers:

- pre-Website43 Home components
- pre-Website43 Blog renderer under `features/blog/components/`
- pre-Website43 shared Navbar/Footer/ToolHero
- retired FHC multi-step/result UI
- retired CI walkthrough/tool UI
- unused shared toast/scroll/form UI utilities removed during the ownership audit

Regression assertions were moved to current runtime owners before the retired Blog/Navbar/CI sources were deleted. Source-bound regressions must continue to target current owner paths; never recreate a retired source file merely to satisfy an old test fixture.

## Calculator parity status

The CI and FHC legacy/reference calculators are not permission to maintain two Public calculators. They exist only to preserve regression evidence while current calculator owners evolve.

- CI: `features/ci-planning/legacy/calculator.ts`
- FHC: `features/financial-health-check/calculator/`

The live FHC calculation owner is `features/financial-health-check/components/lifeCoverageModel.ts`; formula-parity and exhaustive static QA must bind to that model while `LifeCoverageWizard.tsx` is checked only as the delegating UI owner.

Do not import these references into new UI. Retire them only together with an equally explicit replacement parity contract.

## Style ownership

`Website43.module.css` must have no zero-reference class selectors and no dynamic CSS-module access. `scripts/audit-public-css-usage.mjs` blocks both regressions in CI.

Responsive Website 4.3 runtime CSS has one owner only: `Website43ResponsiveStyles.tsx`. Do not reintroduce Transition, FinalPolish, Hotfix or similar patch layers.

Global public styles remain split by responsibility instead of returning to a generic CSS bucket.

## Dependency ownership

Production dependencies must have a real code owner. The Phase 3 cleanup removed the zero-consumer dependencies `@radix-ui/react-slot`, `@radix-ui/react-toast`, `class-variance-authority`, `framer-motion`, and `tailwindcss-animate` together with their lockfile entries.

Before adding a dependency, identify the runtime or build owner and keep that ownership visible to the architecture audit.

## Public reachability model

`scripts/lib/public-reachability.mjs` exposes two graphs:

- `publicReachable` — starts from user-facing App Router page/metadata roots and excludes Control Plane, API, Studio, Workflow, Auth and Proxy roots.
- `reachable` — repository-wide route/request reachability used to distinguish internal-only code from code that has no current runtime owner anywhere.

A file reported as `orphan` is not automatic deletion permission. Check tests, migration ledgers, protocol ownership and frozen parity contracts first. `scripts/audit-public-architecture.mjs` blocks any new unexpected orphan while keeping the small explicit set of protected non-runtime contracts visible.

## Protected non-runtime contracts

The following are deliberately retained even though they are not ordinary Public route owners:

- CI frozen formula parity calculator
- FHC frozen formula parity calculator directory
- `components/preview/DraftPreviewRuntimeNoop.tsx` for the build-time Turbopack alias boundary
- `lib/content/legacy.ts` for frozen migration/test mappings

Do not delete or reuse them as active UI without changing the corresponding explicit contract and regression coverage.

## Client-boundary rule

Prefer server-rendered shells and narrow client islands. A component becoming interactive is not a reason to move its whole feature tree to `use client`.

Intentional Public client islands include Blog search/filter/TOC, calculator steps/results, the Website 4.3 navbar, consent controls and analytics providers.

## New-work rule

Before adding a renderer, stylesheet, static asset or dependency:

1. Identify the existing owner in this document and audit output.
2. Extend that owner when the concern belongs there.
3. Create a new owner only when the concern is genuinely independent and name it for that responsibility.
4. Do not create `Legacy2`, `FinalPolish`, `Hotfix`, `NewNew`, or parallel implementation layers as a substitute for consolidating ownership.
5. Update regression ownership in the same change whenever an implementation owner moves.
6. Run the Public style, asset and architecture ownership gates before considering the change ready.

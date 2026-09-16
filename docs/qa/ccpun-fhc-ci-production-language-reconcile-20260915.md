# CCPun FHC / CI — Production Design Language Reconcile

Date: 2026-09-15
Status: local branch verified; not pushed, not merged, not deployed
Branch: `fix/fhc-ci-human-centered-reconcile-20260915`
Base: `origin/v4-production` at `28481dd4de521f24090b40531a8c1cc6060dcc7e`

## Owner direction

- Keep the latest FHC and CI content and behavior.
- Use the design language already live on Production Home/Blog Website 4.3 and the existing approved Figma tool compositions.
- After composition, remove wording and framing that makes the user stop to interpret the interface.
- Do not change calculator formulas, analytics/consent contracts, SEO URL ownership, or Production content.

## Design source

Production Website 4.3 is the visual source of truth: `components/layout/website-43/Website43.module.css`, `Website43Navbar`, and `Website43Footer`.

Figma source already mapped for Website 4.3 tool pages:
- file `2qes5uqbxyJjxwHiqs3sZM`, page `14 — Website 4.3 · Source of Truth`
- FHC frames: `667:144` / `667:272` / `667:383`
- CI frames: `668:180` / `668:302` / `668:407`

Shared production visual contract used here:
- Deep `#251818`
- Background `#352727`
- Surface `#4a3a3a`
- Border `#5b4848`
- Gold `#e0c985`
- Ink `#faf9f9`
- Muted `#baabab`
- Kanit
- Flat-by-default content surfaces; glass only for true floating chrome
- 12–16px production radii and restrained gold CTA hierarchy

## What was reconciled

### Shared shell

- FHC and CI now use the Website 4.3 Production/Figma tool hero, navigation, footer, spacing rhythm and hero assets.
- Added `Website43ToolHero` as the single visual implementation; the old `ToolHero` path is only a compatibility re-export so there is no second design source.
- FHC uses `/assets/website-43/fhc-hero.png`.
- CI uses `/assets/website-43/ci-hero.png`.

### Calculator and results

- Replaced generic blur/heavy-shadow calculator cards with Production surface/border treatment.
- Scoped primary and secondary calculator actions to the same gold / outline buttons used by Website 4.3.
- FHC and CI result states use the same flat surface, border, typography and CTA hierarchy; no generic glass result shell remains.
- Formula, scoring, validation, selected-method behavior, export and LINE actions remain intact.

### Latest content preserved

FHC retains the current life-coverage assessment framing, three planning groups, latest FAQ and latest result copy.

CI retains the latest story content, separate expense/income estimation methods, latest FAQ, current result logic, and the recovery-period cost concept.

## Confusion removed

- Removed the FHC heading `7 เรื่องใน 3 กลุ่ม` because the visible UI presents three groups; replaced with `3 เรื่องที่ควรทบทวนให้เชื่อมกัน`.
- Removed duplicate pre-calculator CTA/disclaimer framing where it repeated the next action instead of helping the user progress.
- Removed border-left accent treatment from CI story content to match the Production visual language.
- Changed the public-facing English label `Recovery Reserve` to `ทุนสำรองช่วงพักฟื้น`; the latest explanatory content remains unchanged.
- Simplified CI post-result explanation so the user sees one clear rule: the expense and income methods are separate and are not added together.

## Verification

### Automated

- `npm run check:foundation` — PASS.
  - architecture PASS
  - foundation safety PASS
  - Vercel regressions PASS
  - calculator regressions PASS
  - motion regressions PASS
  - Admin suite: 472 tests, 471 PASS, 1 existing real-Postgres SKIP
  - lint: 0 errors; one existing generated-workflow unused-disable warning
- `npm run test:calculators` — PASS.
  - same-input / same-output parity PASS
  - calculator domain/assumption/validation files byte-identical PASS
  - FHC journey PASS
  - CI journey PASS
  - Production design-language contract 5/5 PASS
  - result-action regression PASS
- `npm run build` — PASS on Next.js 16.3.3 / Node 24.
- `git diff --check` — PASS.

### Browser / rendered geometry

Local exact branch was exercised at canonical Figma widths `390 / 820 / 1440`.

FHC and CI initial states:
- Website 4.3 background and Kanit confirmed.
- Figma tool hero assets confirmed.
- Calculator surface `#4a3a3a`, border `#5b4848`, no shadow/backdrop blur.
- No horizontal document overflow.

CI story images were scrolled into view and verified loaded; all three returned real natural dimensions rather than empty placeholders.

FHC result on 390px:
- result width 342px, no horizontal overflow
- Production surface/border, no shadow
- visible actions 52px high, 12px radius

CI result on 390px:
- result width 342px, no horizontal overflow
- Production surface/border, no shadow
- separate expense/income method control retained
- visible actions 52px high, 12px radius

Result widths at 820 / 1440:
- both tools center at 704px result width
- no horizontal overflow
- CI keeps two method columns at larger widths

Local screenshot evidence is stored outside the repo under `/Users/punnii/Desktop/CCPun x AI/tmp/ccpun-visual/` and is intentionally not committed.

## Protected contracts

Changed: presentation, layout hierarchy, public-facing explanatory framing, responsive styles, design-language regression coverage.

Not changed:
- calculator formulas / scoring / assumptions / thresholds
- canonical URLs, redirects, sitemap ownership, robots ownership
- Production Sanity content
- analytics event names or calculator value telemetry
- consent behavior
- Production deployment state

## Release boundary

This branch is locally verified only. No push, PR update, merge or Production deployment is authorized by this QA note. Before any release, refresh the live Production head, ensure the branch is still current, run the same gates on the exact release SHA, obtain owner visual acceptance, then use the normal PR → CI → Vercel Preview → explicit Production approval path.

## Production-build runtime check

After the final source commit, the optimized build was served with `next start` on local port 3002 without loading credential files. Both public routes returned HTTP 200. A clean Chrome CDP pass at 390px reported no runtime exception, no hydration error, no Next error portal, no horizontal overflow, and the expected Website 4.3 background for both FHC and CI.

A hydration warning observed earlier under `next dev` did not reproduce under the optimized Production build. The dev run also logged the expected Auth.js `MissingSecret` diagnostic because local credentials were intentionally not loaded; the public Production-build route check itself was clean.

## Desktop spacing refinement — owner review follow-up

Owner review found two visual issues on desktop: several sections carried too much empty space on the left, and vertical spacing was inconsistent between adjacent content groups.

This follow-up changes layout only. Calculator domain/formula paths and `LifeCoverageWizard` calculation logic were not modified.

Measured at 1440px before → after:
- tool story/FAQ shell: x=144, width=1152 → x=80, width=1280 (same shell as Production Home/Blog)
- centered calculator: x=336, width=768 → two-column composition with intro x=124 width=360 and calculator x=548 width=768
- FHC FAQ effective top gap: 96px → 56px
- FHC method block height: ~300px → ~240px
- CI recovery/method block height: ~219px → ~137px

Responsive checks at 390 / 820 / 1100 / 1280 / 1440 all reported zero horizontal overflow. Mobile and tablet retain their existing 24px / 40px shell gutters; the two-column calculator composition activates only at >=1200px.

Verification after this refinement:
- `npm run test:calculators` PASS, including frozen Production formula parity
- `npm run check:foundation` PASS (existing generated workflow lint warning only)
- `npm run build` PASS
- `git diff --check` PASS

## Website 4.3 full public-layout audit — wide desktop + article rhythm

Owner review expanded the scope from the calculator pages to every public Website 4.3 surface after the same left-bias and spacing issue was also observed on Home and Blog.

Root cause on wide desktop:
- the shared 1280px shell was forced to `margin-left: 0` inside an 80px-padded section
- at 1440px this is invisible because 1280 + 80 + 80 fills the viewport
- at 1920px the same shell stayed at x=80 instead of centering at x=320, leaving a large dead area on the right
- overlay navigation and hero copy used the same left-pinned behavior

Shared fix:
- shell children now use auto margins
- Home / Blog / Tool hero copy follows a shared shell-left anchor
- overlay Navbar is capped at 1280px and centered
- Footer and generic Website 4.3 sections inherit the same centered shell
- 404 remained centered and was verified unchanged

Article fix:
- Production article measurement at 1440px showed featured image 1280px vs reading grid 1060px (TOC 300 + prose 720 + gap 40)
- article breadcrumb/title/meta/featured image now use the same 1060px reading axis
- article support sections (sources, FAQ, author, CTA, related articles, disclaimer) use the same 1060px axis
- featured image `sizes` hint is now 1060px on desktop
- Article header → reading gap reduced from the former 48 + 64 padding stack to 32 + 48

Home / tool rhythm:
- Home learning → FAQ UAT-only compressed transition changed from 24 + 24 to 40 + 40
- desktop calculator bottom padding reduced from 72 to 48 so the next section does not feel detached

Responsive matrix verified locally for Home, Blog, Blog Category, FHC, CI and 404 at:
- 390: shell x=24, width=342
- 820: shell x=40, width=740
- 1100: shell x=56, width=988
- 1440: shell x=80, width=1280
- 1920: shell x=320, width=1280

All tested widths reported zero horizontal overflow. New `website43-layout-rhythm-regression.mjs` is wired into the Foundation/Vercel regression suite so wide-desktop centering and Article width parity cannot silently regress.

### Final Article readback and Blog data check

The exact branch was also run in the guarded `local-production` read-only lane against the Production Sanity dataset to verify the real article/content geometry without allowing Draft writes.

Article `aia-health-ci-hero-guide` readback after the final specificity fix:
- 390: title / featured / reading / support sections = x24, width342
- 820: title / featured / reading / support sections = x40, width740
- 1100: title / featured / reading / support sections = x56, width988
- 1440: title / featured / reading / support sections = x190, width1060
- 1920: title / featured / reading / support sections = x430, width1060
- zero horizontal overflow at every checked width

The Article support width rule uses the stronger `.section > .articleSupportInner` / `.sectionDeep > .articleSupportInner` selector so the shared 1280px public shell cannot override the 1060px Article reading axis.

Blog archive and Health category were also loaded with real Production content in the read-only lane. Fresh 390/820 loads confirmed the featured carousel and article cards stay inside the responsive shell with zero horizontal overflow (342px single-column at 390; 361px two-column cards at 820). A transient overflow observed only while programmatically resizing one already-hydrated carousel tab did not reproduce on fresh loads and was therefore classified as emulation state rather than initial-layout behavior.


## Article sources + Kanit first-paint performance follow-up

Owner review explicitly included the Article `แหล่งอ้างอิง` section in the reading-width requirement and requested Kanit to be available from the first visual paint without sacrificing LCP.

Article sources:
- the conditional sources block is explicitly tagged `data-uat-section="article-sources"`
- its inner container remains `articleSupportInner`, so it inherits the same 1060px desktop reading/support axis as FAQ, author, CTA, related articles and disclaimer
- regression coverage now checks this block directly instead of only relying on a support-section count

Font/LCP experiment (390x844 mobile emulation, cache disabled, 150ms latency, ~1.6 Mbps download, five runs per candidate):
- baseline `next/font` (`preload:false`, `display:optional`): LCP median ~980ms, CLS 0
- preload all Thai + Latin weights: LCP median ~1252ms — rejected
- preload all four Thai weights: LCP median ~1272ms — rejected
- preload Thai 400/700 only + Home hero preload: LCP median ~964ms — passed
- preload Thai 400/600/700 + Home hero preload: LCP median ~992ms, CLS 0 — selected because it covers the normal Website 4.3 above-the-fold body/nav/eyebrow/heading weights while remaining effectively at baseline LCP

Selected loading strategy:
- full Kanit family remains self-hosted through `next/font` with Thai + Latin weights 300/400/600/700, `display:optional`, `preload:false`
- a bounded critical Kanit instance preloads only Thai 400/600/700
- generated HTML contains exactly three critical font preloads (not all font files) plus the Home LCP image preload
- browser resource timing confirmed the preloaded 400/600/700 Thai files complete before first paint under the test throttle
- the normal copies of those Thai weights are not fetched again; the preloaded `.p` resources satisfy the active `@font-face` declarations
- Home hero image is explicitly preloaded/fetch-priority high so the font budget does not displace the image LCP candidate

This is intentionally not a font-blocking strategy: `font-display: optional` keeps text paintable on unusually slow connections instead of forcing LCP to wait for a font. It prioritizes the real Kanit files early enough for the normal first paint while preserving a safe fallback path.

## 2026-09-16 owner UAT follow-up — Recovery Reserve + mobile readability

Owner UAT feedback after consolidated PR #125 added four scoped requirements without reopening Home/Blog/Article:

- CI Recovery Reserve must be a real, transparent add-on for out-of-hospital / recovery costs instead of only a disclaimer.
- Cost evidence must be 2023 or newer; implementation uses 2025–2026 references only.
- FHC tool hero needs stronger contrast over the bright image; the overlay remains tool-scoped and opt-in.
- Tool FAQ answer/divider spacing is increased; CI story cards become a mobile-only swipe/scroll-snap carousel with accessible previous/next controls and position cue.

### Recovery Reserve evidence contract

The new CI recovery model deliberately does **not** restore legacy Website 4.0 medical-buffer or 6/9/12-month heuristics and does not hard-code the prior 300k / 1.0M illustrative scenarios.

Current reference set:
- 2025 Thailand cost-of-illness study, Health Region 9, data Sep 2024–Feb 2025, 202 patient-caregiver pairs: transport, food, additional out-of-pocket medical costs, caregiver lost income per visit, and caregiver home-care time loss.
- NHSO FY 2569 physical-therapy service benchmark: 450 THB/session plus 200 THB/session home-service add-on; explicitly presented as a public reimbursement/service benchmark, not private market pricing.
- Department of Older Persons FY 2568 home-environment program: 40,000 THB/home as a public-program ceiling/reference only; never auto-added.

All quantities and manual amounts default to zero. Recovery Reserve is added only to the expense-based method; the income-based method remains unchanged to avoid double-counting income impact. Analytics continues to send metadata only, never recovery quantities or amounts.

Automated regression now asserts evidence year >= 2023, exact source-backed rates, zero/default parity, rehab validation, and no Recovery Reserve double-add to the income method.

### Figma handoff

After the exact code head is committed and Preview is green, sync Figma `S05 — CI Planning` to that exact SHA. `S04 — Financial Health Check` should also reflect the tool-hero contrast change. Do not modify Home/Blog/Article Figma pages for this follow-up.

## 2026-09-16 owner UAT follow-up — FHC access/readability/FAQ rhythm

Owner mobile review found three remaining UX issues in FHC:

- The calculator was discoverable from the hero CTA but visually sat behind the entire explanatory FHC context, making it feel much farther away than CI Planning.
- The opt-in FHC mobile hero overlay still faded too far over the image, so the lower white copy did not have enough contrast.
- Tool FAQ answers still sat too close to the divider rhythm on mobile.

Implemented:

- FHC now mirrors the CI information sequence more closely: hero → compact context → calculator → deeper planning context → FAQ. The existing three planning truths and method explanation are preserved after the calculator instead of removed.
- FHC `strongContrast` mobile overlay now stays dark through the lower image/copy region instead of fading to transparent.
- Tool FAQ summary/answer spacing was increased, with an additional mobile override so expanded answers have visible space above the next divider.
- Home/Blog/Article/global public shell remains unchanged.

QA contracts now assert calculator-before-deeper-context ordering, FHC strong-contrast mobile overlay, and mobile FAQ divider spacing. Calculator formula parity, journey tests, Recovery Reserve tests, result-action tests, Foundation gate, TypeScript, and optimized build remain required before Preview acceptance.

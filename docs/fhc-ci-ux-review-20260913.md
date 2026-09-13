# FHC / CI UX owner-review receipt — 2026-09-13

This focused delivery is for owner review only. It does not authorize merge, Production deployment/promotion, or Production Sanity writes. The live PR #112 body records the final exact-head Preview and post-commit browser verification; use that immutable deployment, not a branch alias or an older screenshot.

## Scope and lineage

- Repository: `punniix/CCPun-Update-4.0`; branch: `feat/fhc-ci-ux-completion-20260913`; base: latest inspected `v4-production` at `f9a233daa31e3b91b7a22e87c3dcbd58a4fff718`.
- Final UI code: `e54bacb1420da59eaa884f64fe0acb4f074c6fcc`; READY Preview `dpl_67fmYaGhAynnoKptMwHfWDkGN6y5`, [UI Preview](https://ccpun-dtil96cm3-punniixs-projects.vercel.app). Subsequent receipt-only commits do not change the UI.
- Live FHC is `LifeCoverageWizard`, the existing two-step life-coverage module, not the legacy scored FHCWizard. No interpretation or financial assumptions were redesigned.

## Changes

FHC: semantic form submission, explicit required household guidance, associated/announced errors, focus and reading-position continuity through next/back/result/edit/reset, 48px navigation actions, wrapping result amounts, and keeping the Thai qualifier “เบื้องต้น” together at 390px.

CI Planning: contained segmented progress replaces overflowing absolute labels; sliding/clipping wrapper removed; semantic form and step/result focus; 48px navigation; two-column summaries and wrapping result/method rows; short numeric currency examples with the existing explanatory helpers retained. No animation library, client dependency, image, page-wide client wrapper or extra financial telemetry added.

## Deterministic and engineering evidence

- Node 24.19.0. `npm run check:foundation` passed after the final UI changes: lint, TypeScript, architecture, foundation, Vercel and Admin/analytics contracts. Final Admin batch: 424 pass, 1 existing skip, 0 fail.
- `node --test tests/calculator-ux-formula-parity.test.mjs`: 6 pass. Actual FHC inline formula and CI module before/after outputs deep-equal for normal, low-resource, high-income, debt-heavy and edge-valid fixtures (five per calculator). Domain/schema/constants/legacy scoring byte-identical to the immutable Production baseline.
- `node --import tsx --test tests/calculator-ux-journey.test.mjs`: 2 mounted integration tests pass. Missing input, dependent field limits (601 installments, 31 education years), retained answers, zero resources, method selection, next/back/result/edit/reset and focus.
- Existing calculator-regression and result-actions-regression pass.
- Formula/scoring/threshold/weighting/recommendation/assumption/output changes: NO. No formula defect found in the fixtures.

## Browser QA

Historical raw matrix: `qa/calculator-ux-geometry-20260913.json` is explicitly pinned to its earlier SHA. It is not relabeled as final-head evidence. Final-head repeat results are recorded in PR #112 after the receipt commit is deployed.

Real Chrome same-origin documents at 390, 600, 820, 1024, 1100, 1280, 1440, 1728 and 1920 CSS pixels were exercised through initial, step two and result. Actual innerWidth and scrollbar-excluding clientWidth are inspected, along with rendered text, cards, controls and CTA bounds. Inputs are 48px, ranges 44px, navigation/export actions at least 48px; radio labels provide the larger target. Existing max-width/automatic-margin calculator shells are retained.

Additional final-UI checks: FHC required error focuses householdMonthly and associates life-calculator-error; CI missing-input error receives focus and role=alert; Tab gives the range a visible 2px gold ring; keyboard Home/End reaches FHC 1/20 and CI 1/10; income/expense radios respond to arrow keys and announce the changed output. With no income, the existing CI contract omits the method selector. Zero resources remain valid. Extreme 1e12 input results wrap without horizontal overflow. Both local image exports announce successful download. Edit/reset and browser back/forward were exercised; calculator steps do not create URL/history entries, and page reload is not a saved-answer feature.

Colour review uses existing production tokens: primary CTA dark text on the darkest gold stop is 10.42:1; muted text on the base background is 6.46:1. This is a targeted colour review, not a full WCAG certification of every gradient pixel. No calculator animation was added; the CI transition was removed.

The Preview-only `/preview/calculator-qa/` embeds unchanged public routes with allowlisted widths, no answer injection, noindex, and notFound outside VERCEL_ENV=preview. This is real responsive layout evidence, not touch-device emulation. Browser zoom shortcuts did not change the provided browser's DPR/viewport; actual OS/browser zoom and physical mobile keyboard ergonomics remain manual owner checks. No failed zoom action is counted as PASS.

## Native Figma

Existing file: [CCPun](https://www.figma.com/design/GnY9j08aOonw70CA1memRK). No page created; only S04 (11:5) and S05 (11:6) changed. Native AutoLayout frames, editable Kanit text, existing semantic colours, reusable money/button instances and native Lucide vectors; no image fill in any final frame. Older schematic/raster references are hidden, not deleted.

| Tool | Width | Step 1 | Step 2 | Result |
|---|---:|---|---|---|
| FHC | 390 | 90:114 | 84:2 | 88:2 |
| FHC | 820 | representative at 390 | 90:2 | 92:31 |
| FHC | 1440 | representative at 390 | 90:60 | 95:37 |
| CI | 390 | 101:404 | 95:120 | 98:61 |
| CI | 820 | representative at 390 | 97:12 | 101:35 |
| CI | 1440 | representative at 390 | 97:110 | 101:236 |

Boards: S04 83:2; S05 95:116. All 14 frames were rendered/read back; native text overflow was corrected. Single-line money values intentionally clip inside their editable input viewport, matching HTML input behavior. Frames represent the calculator region, with 24px presentation bleed and the observed 8px scrollbar reserve; unchanged site hero/navigation/footer are outside these journey frames. Static frames omit transient focus rings and use synthetic examples (FHC household 30,000 / 10 years; CI income 50,000, household 30,000 / 5 years; zero resources). These presentation and font-rasterization differences are intentional, not alternative UI.

## PR #93 transfer and archive

Reinspected #93 at `5aec43c4a97597287be717ea6fbd0122505cedee`, branch `fix/responsive-layout-foundation-uat-20260911`. Only its contained CI segmented-progress idea is reimplemented. The broad Website43 shell layer is not a dependency of these public calculators: they already use containing-width max-width and automatic margins. No Home, Blog, article, legal, 404, navigation experiments or unrelated Figma synchronization was transferred.

Keep #93's branch/head as the future reference for Website43Tools, Website43LayoutContractStyles, transition/final-polish cleanup, motion/layout tests and Figma maps. After final focused verification, close #93 without merging; the live PR state is authoritative. No retired PR is reopened.

## Owner visual review / remaining manual acceptance

Open the final PR-linked Preview and S04/S05: review the 390px input/error/next-back flow, CI expense-versus-income results, FHC long Thai result heading, and 820/1440 result-card density. Check physical mobile keyboard/touch and browser 200% zoom because this browser could not emulate them. Owner visual acceptance and a separate explicit Production instruction remain required.

Production touched: **NO**. Production Sanity touched: **NO**. Public URL/SEO ownership, analytics event/payload abstraction and consent contracts changed: **NO**. TinyFish used: **NO**.

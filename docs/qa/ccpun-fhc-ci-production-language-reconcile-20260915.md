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

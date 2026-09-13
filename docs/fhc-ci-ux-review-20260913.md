# FHC / CI UX review evidence — 2026-09-13

This is an evidence receipt, not Production authorization. Delivery is incomplete; PR #112 remains Draft.

## Scope and lineage

- Repository: `punniix/CCPun-Update-4.0`.
- Focused branch: `feat/fhc-ci-ux-completion-20260913`.
- Production baseline inspected: `f9a233daa31e3b91b7a22e87c3dcbd58a4fff718`.
- UI commit: `15f22ea7d85ab8569aeb875ebabf1e576d6c7f22`.
- UI plus Preview-only viewport fixture: `0e7c9396ddab3a13c8ca256145b4343d67a21e18`.
- Exact tested deployment: `dpl_4FEiFUeRrkevKrDUTrtAu9wHvY6Y`, READY, `ccpun-web`, Preview.
- URL: https://ccpun-5gfqzdngi-punniixs-projects.vercel.app

## Implemented

CI progress now uses contained segments instead of absolute edge labels. Both live wizards support semantic form submission and focus/reading-position continuity through next, back, result, edit and reset. FHC now explicitly identifies the required household amount. CI removes the sliding/clipping wrapper. Navigation actions have 48px minimum height; CI result grids and long amounts have more wrapping room.

The live FHC is `LifeCoverageWizard`, a two-step life-coverage module with its formula inline. It is not the older scored `FHCWizard`. Both the actual inline formula and the older calculator domain files are protected by regression evidence.

## Tests completed

- Node 24.19.0.
- `npm run check:foundation`: exit 0, including lint, TypeScript, architecture, foundation, Vercel, analytics and Admin suites. Final Admin batch: 424 passed, 1 skipped, 0 failed.
- `node --test tests/calculator-ux-formula-parity.test.mjs`: 6 passed. Full before/after outputs for both live calculators match the immutable baseline for normal, low-resource, high-income, debt-heavy and edge-valid fixtures. Calculator domain files, schemas, constants and legacy scoring are byte-identical.
- `node --import tsx --test tests/calculator-ux-journey.test.mjs`: 2 mounted integration tests passed. Actual controls exercise missing input, dependent field errors, maximum installments/education years, retained answers, zero resources, next/back/result/edit/reset focus and CI result method switching.
- Existing `tests/calculator-regression.ts` and `tests/result-actions-regression.ts`: passed.

## Browser evidence and its limits

Raw observations: `qa/calculator-ux-geometry-20260913.json`.

Both tools were interacted with in real Chrome documents inside same-origin iframes sized to 390, 600, 820, 1024, 1100, 1280, 1440, 1728 and 1920 CSS pixels. Initial, step two and result geometry passed in all 54 combinations. The actual inner width was read back; document client width excluded the observed 8px scrollbar. No root or measured text/control horizontal overflow was found. Currency inputs were 48px high. An additional CI mobile extreme-amount result also had no overflow.

The fixture `/preview/calculator-qa/` is gated strictly to `VERCEL_ENV=preview`, noindex, and returns notFound otherwise. It embeds the unchanged public calculator URLs. No calculator answers are injected by the fixture. Browser consent was saved with analytics/social off.

This is responsive document-width evidence, **not** device/touch emulation, complete visual screenshot acceptance, or full zoom/contrast verification. One immediately sampled FHC required-error focus observation still shows the submitting button before requestAnimationFrame; the mounted test verifies the deferred error focus. Do not interpret that immediate observation as a focus PASS.

After the matrix and partial reference capture, browser operations repeatedly failed: CDP get-tabs timeout, tab refresh superseded by recovery, then navigation in a fresh tab timed out and reset the execution session. Further exact-head visual/Figma comparison was not completed. No browser failure was reclassified as a successful test.

## Figma — NOT completed

File `GnY9j08aOonw70CA1memRK` was inspected read-only. `get_metadata` initially listed only Cover; Plugin API enumeration correctly returned all 16 pages.

- S04: page `11:5`; native board `18:138`; existing width wrappers `18:139`, `18:167`, `18:195`.
- S05: page `11:6`; native board `18:223`; existing width wrappers `18:224`, `18:254`, `18:284`.
- Extra existing raster rectangles: S04 `62:2`–`62:4`, S05 `62:5`–`62:7`. These are not accepted final native designs.
- Kanit fonts were confirmed available.

No Figma page or layer was changed. There are **no final frame IDs or parity certification** from this task. Complete representative native input/result frames at 390/820/1440, render them, and compare against the resulting final-head Preview before owner review.

## PR #93 transfer / cleanup

Inspected open Draft #93 at `5aec43c4a97597287be717ea6fbd0122505cedee`. It targets an older Website 4.3 UAT branch and carries substantial unrelated work relative to current Production. The contained segmented progress idea was reimplemented for the live CI calculator. Its animation is not imported. The current public tool shell already uses max-width and automatic margins; no global Website 4.3 layout layer is copied.

Reference #93's `Website43Tools.tsx`, `Website43LayoutContractStyles.tsx`, motion contracts, Figma maps and old Preview if future visual reconciliation needs them. No Home, Blog, legal, 404, navigation experiment or old UAT content fixture was transferred.

#93 remains open because visual transfer/completeness and Figma verification are not finished. Reassess and close without merge only after those checks; do not reopen the retired PRs.

## Remaining release gates

1. Restore browser availability and finish full visual/interaction, touch/zoom/contrast, extreme/min/max, selected/disabled/export-loading and history/scroll checks. Add fixes/tests for defects found, preserving formula output.
2. Complete S04/S05 native Figma and render/readback parity at 390/820/1440 including results.
3. Re-run affected gates after code changes and verify the final exact-head Preview, not this older evidence head.
4. Complete #93 transfer review/cleanup and update #112 with final evidence.
5. Stop for owner visual review. Only a separate explicit instruction can authorize Production.

Production touched: **NO**. Production Sanity writes: **NO**. Formula, SEO URL/metadata, analytics event and consent contracts changed: **NO**. TinyFish used: **NO**.

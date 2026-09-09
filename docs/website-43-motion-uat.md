# Website 4.3 — restrained motion, UAT only

Implementation date: 9 September 2026 (Asia/Bangkok).
Task receipt: `website43-motion-uat-20260909` in the parent workspace.
Branch: `codex/website-43-motion-20260909`.
Base: `fb915c4e1f6057d9bccaeee1345d2783746d83d5`.

## Scope and isolation

This change is an opt-in interaction layer for `/preview/website-4-3/**`, inspired by the Motion Lab examples reviewed with the owner. It does not replace the existing visual design, reorder sections, alter text or images, introduce a new tab bar, or change calculator arithmetic, analytics events, consent logic or article URLs. No dependency was added.

`Website43MotionBoundary` is mounted only by the preview layout; its wrapper uses `display: contents`. Existing public routes do not mount it. `LifeCoverageWizard`, `CIWizard`, and `Website43Blog` have a `subtleMotion` prop that defaults to false; only preview page entry points opt in. Preview noindex/nofollow metadata remains intact.

The original working copy at `CCPun-Update-4.0` remains on `codex/website-43-home-fidelity-20260904`. Its pre-existing dirty Figma-sync work was neither copied, committed, reverted nor changed by this task. Integrate the motion commit into the latest reviewed UAT branch rather than replacing the original working copy wholesale.

## Interaction contract

| Area | Behaviour |
| --- | --- |
| FAQ | Native `details`/`summary` enhanced with a 240 ms height transition; rapid reversal, cleanup and reduced-motion preference changes settle to the requested state. Height is returned to auto. |
| Cards | Fine-pointer hover lifts clickable article cards by 3 px, without rotation or content resizing. |
| Buttons | 160 ms feedback; 1 px hover and 0.98 press scale, with disabled-state guards. |
| Menus | 180 ms, 6 px entry; brief capped item stagger. Existing dimensions and centering transforms are preserved. Escape closes and returns focus to the trigger. No floating/hiding/shrinking header is introduced. |
| Selected controls | Existing dropdown/radio/selection UI gets restrained colour transitions. The blog uses a category dropdown, not tabs; its architecture is retained. |
| Below-fold groups | One-time 8 px reveal, 340 ms, opacity 0.88 to 1. Content is never initially hidden or dependent on the observer to become readable. Hero and primary actions are excluded. |
| Life-coverage wizard | 12 px, 220 ms step transition; entered values remain in the existing state; focus moves to the new step heading. |
| Critical-illness wizard | Existing step transitions shortened to 12 px and approximately 240 ms total exit/entry in the preview only. |
| Inputs/progress | Focus, border and progress changes, without enlarging input fields or spinning result amounts. |
| Reduce Motion | Native preference cancels decorative motion; CSS removes nonessential transitions; preview carousel navigation becomes instant rather than smooth-scroll. |

The FAQ focus ring is inset so the disclosure container's existing overflow clipping does not cut it off. No looped backgrounds, cursor followers, 3D transforms, particle effects, page curtains or extra glass blur were added.

## Verification and local reproduction

Run from this worktree:

```sh
npm run check:foundation
node --import tsx --test tests/website-43-motion.test.mjs
```

An optimized build is made with the existing webpack option and explicit non-secret UAT settings, not with Production credentials. No `.env` files were read or copied. Build success is not a Vercel deployment.

Runtime harness: `node qa/website-43-motion.mjs`.
It targets only localhost by default and rejects remote hosts. It uses a separate headless Chrome profile/CDP on port 9333, and the local built server on port 3113. Optional cookie consent stays off. The harness checks 390, 640, 820, 1024 and 1440 px widths, keyboard disclosure behaviour, rapid repeated activation, menu positioning/Escape, card hover, category selection, both calculators' validation/back navigation/results, reduced-motion behaviour and server-rendered no-JS content.

Runtime report and screenshots: `qa/screenshots/website43-motion/`.

## Delivery guardrails and limitations

No push, pull request, merge, Vercel deployment, alias update, Production release, Sanity write or Figma mutation is part of this local implementation record. Check current GitHub/Vercel state and obtain the appropriate owner's delivery approval before remote writes. Keep Production branch and domains unchanged.

Browser evidence is desktop Chrome with responsive and reduced-motion emulation. It is not a physical iPhone/Safari or Android-device test, nor a measured Core Web Vitals performance comparison. The preview's existing Sanity Live localhost CORS warning is an environment limitation; no project CORS or security setting was changed to suppress it. Basic rendered article data and tested local pages remain usable.

Rollback of this layer is scoped: remove the preview MotionBoundary mount and the three preview `subtleMotion` opt-ins, or revert only the motion commit. Do not reset the original dirty Figma-sync branch.

## Recorded verification — final source and local build

- `npm run check:foundation`: PASS (lint, TypeScript, architecture, foundation contracts, Vercel contracts and admin contracts; the admin suite reports 386 passing tests).
- `node --import tsx --test tests/website-43-motion.test.mjs`: 10 passed, 0 failed.
- `next build --webpack` with explicit UAT settings: PASS; final build task `khai_1d385085f30949b489723f88c792acf5`.
- Built-server responsive/interaction harness: **123 passed, 0 failed**, task `khai_fc8e0e06af174b5b9c9684b543779161`; raw results are in `qa/screenshots/website43-motion/report.json`.
- Local public-route isolation read-back: `/`, `/blog/`, `/ci-planning/` and `/tools/financial-health-check/` returned HTTP 200 without motion opt-in markers (task `khai_e8fd27b55f60459fbaec7a0ccdf60f4b`). These were local build checks, not Production requests or deployments.
- Visually reviewed final mobile home/expanded FAQ/result screenshots and desktop home screenshot. No new horizontal overflow appeared in the five tested widths. The pre-existing copy wrapping/layout is intentionally not redesigned by this motion task.
- Original working-copy Git status was rechecked: its existing Figma-sync changes and branch were preserved.

Earlier harness failures were investigated rather than waived: the keyboard driver needed Enter's character payload, article FAQ selection had to exclude the separate table-of-contents disclosure, and hover measurement had to wait for an instant positioning scroll. The final harness uses those corrected real-interaction checks; production application behaviour was not weakened to make tests pass.

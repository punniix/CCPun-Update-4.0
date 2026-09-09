# Website 4.3 — Code → Figma reconciliation (2026-09-09)

Status: UAT / Figma reconciliation. Production is a read-only comparison source; no Production mutation is authorized by this document.

Figma target: file `2qes5uqbxyJjxwHiqs3sZM`, page `14 — Website 4.3 · Source of Truth`, root `495:23`.
UAT integration branch: `codex/website-43-uat-reconcile-20260909`.
Production comparison: `origin/v4-production` at `2495dcd` when this reconciliation began.

## Reconciliation rule

Figma should reflect the current user-visible and interaction-visible behavior already implemented in code, without converting backend/SEO/analytics internals into decorative UI. Where UAT and Production differ, Page 14 should label the state explicitly rather than silently choosing one:

- `PRODUCTION` = current released public behavior.
- `UAT 4.3` = preview-only behavior that is still under review.
- `SHARED` = behavior that is intentionally equivalent.
- `MOTION SPEC` = interaction timing/state annotation, not a new static layout.

Do not use this sync to redesign unrelated surfaces or change Production code.

## Last known Figma synchronization evidence

Workspace receipts show Page 14 was actively synchronized through the Website 4.3 work, including:

- base Page 14 cleanup/human-centred redesign and prototype integrity;
- submenu mutual-exclusion spec synchronized at UAT commit `b78cddd`;
- Home trust/license refinement synchronized at `1942c02`;
- Home copy synchronization at `4bc3bdd`;
- workspace state later records a complete Page 14 prototype flow for Home, Blog, Article, FHC, CI, Privacy, Cookie and 404 with routed mobile menus and CTA paths.

The live Figma canvas must be inspected before writing because some later changes were code-only and the exact current node state may have advanced beyond those receipts.

## UAT code changes that need live Figma reconciliation

### Home

Reconcile the implemented post-sync Home changes after `4bc3bdd` and the current UAT branch, especially:

- mobile hero flow and mobile content refinements (`6e091e0`, `e1c7c54`);
- consultation CTA wording/placement updates (`77ebe5f`);
- current responsive geometry from the reconciled UAT branch;
- restrained UAT-only motion layer: button/press feedback, below-fold reveal and Reduce Motion annotations.

Keep Page 14 canonical 390 / 820 / 1440 frames. Transition widths remain QA-only, not new canonical Figma source frames.

### Blog / category / cards

Reconcile:

- current Blog intro copy (`91be982`);
- current article-card/tool-card overlay treatment (`0e7b550`);
- category filter/dropdown state and current selected-state behavior;
- global featured recommendations behavior now released in Production: category pages filter the article grid while the featured recommendation rail remains global;
- removal of the unrequested category intro/navigation blocks now released in Production;
- preview motion states: restrained card lift on fine-pointer hover and instant carousel movement under Reduce Motion.

Do not reintroduce removed category blocks merely because an older Figma frame still contains them.

### Article

Reconcile:

- mobile article flow and profile/CTA ordering from the UAT refinements;
- consultation CTA alignment (`7937f42`);
- author profile state now backed by Sanity and released in Production;
- released category/slug parity behavior should be represented as prototype/navigation notes, not a new visual section;
- released cached back-navigation search restoration is behavior documentation only unless a visible state is needed.

### Financial Health Check

The UAT experience-refinement receipt explicitly records that the FHC/CI code refinement at `ab0ccd4` did **not** update Figma. Reconcile the live FHC canvas against the current preview implementation:

- hero/story/FAQ/CTA order;
- current Life Coverage calculator two-step UI;
- validation/focus state;
- step transition spec: short 12 px / ~220 ms preview transition;
- progress state and input focus state;
- result state and current result summary hierarchy;
- Reduce Motion: no decorative step motion.

Calculator arithmetic remains code truth and is not duplicated as editable Figma logic.

### CI Planning

Reconcile:

- current hero/story/cards/FAQ presentation;
- two-step calculator UI and progress states;
- validation/error state, Back state and result state;
- short preview-only step transition and Reduce Motion behavior;
- UAT-specific tracker implementation is not a visible Figma element.

### Navigation / shared shell

Retain the already-synchronized responsive submenu mutual-exclusion behavior, then add the current interaction spec:

- desktop dropdown: ~180 ms / 6 px entry with brief item stagger;
- Escape closes the open menu and returns focus to the trigger;
- no floating/hiding/shrinking header introduced by this motion pass;
- mobile tools submenu remains mutually exclusive with desktop navigation state.

### FAQ / disclosure

Across Home, Article, FHC and CI where applicable:

- native disclosure semantics remain the behavior model;
- open/close motion: 240 ms height transition;
- answer remains present during close transition;
- rapid repeated activation must settle cleanly;
- keyboard activation and focus-visible state must be represented;
- Reduce Motion falls back to native immediate disclosure.

### 404 / legal / cookie

Reconcile current released 404 behavior and verify Page 14 still matches the released presentation. Privacy/Cookie remain UAT design sources unless separately released. Do not alter consent behavior; cookie settings prototype action should continue to represent the existing `ccpun:openCookieSettings` behavior.

## Production-visible deltas to back-sync into Figma

At the start of this task, latest Production includes Website 4.3 releases and follow-up fixes through `2495dcd`, including:

- Home 4.3 release and responsive headline/portrait fixes;
- Blog and Article 4.3 release;
- real 404 presentation and missing-resource metadata behavior;
- Sanity-managed author profile synchronization;
- removal of unrequested Blog category blocks;
- category-page featured recommendations kept global.

Only the user-visible/design-relevant parts should become native Figma layers or prototype states. SEO canonical/noindex logic, analytics implementation, Sanity data contracts, and route-resolution internals should be kept as concise implementation notes where they materially explain a state, not recreated as UI.

## Motion spec to place in Page 14

Create or update one compact `MOTION / INTERACTION SPEC` section rather than duplicating every frame:

| Surface | Spec |
| --- | --- |
| FAQ | 240 ms height, cubic-bezier(0.2,0,0,1), keyboard + Reduce Motion states |
| Clickable cards | fine pointer only, translate Y -3 px, no rotation |
| Buttons | ~160 ms; hover Y -1 px; press scale 0.98 |
| Menus | ~180 ms, Y -6 → 0; capped item stagger; Escape returns focus |
| Below-fold group reveal | one time, Y 8 → 0, opacity .88 → 1, ~340 ms; never hide critical content |
| FHC step | 12 px direction cue, ~220 ms; preserve data/focus |
| CI step | 12 px direction cue, short preview transition; preserve data/focus |
| Reduce Motion | remove nonessential transforms/scroll smoothing; controls remain fully usable |

Do not add cursor followers, magnetic cursor, particles, 3D tilt, page curtains, or continuous parallax.

## Verification after Figma write

After write access is available:

1. Read live Page 14 before mutation and preserve existing component/node IDs where possible.
2. Update only affected native Figma layers/prototype connections and motion-spec annotations.
3. Verify canonical 390 / 820 / 1440 frames for all eight routes.
4. Verify prototype endpoints for desktop/mobile navigation, FAQ, Blog filtering, FHC/CI step flows, CTA paths, Privacy/Cookie and 404.
5. Check for clipping/overflow, hidden/orphan nodes, font drift and broken prototype destinations.
6. Re-read changed nodes and capture visual evidence.
7. Record the final Figma node IDs and sync commit/deployment in the task receipt.

## Integration verification before remote delivery

- Latest Production `2495dcd` was merged into the isolated UAT branch; conflicts on shared Sanity/analytics/article data contracts were resolved to the Production side before adding UAT-only motion.
- `npm run check:foundation`: PASS, including 386/386 Admin tests after updating two stale source-shape assertions to the current released Blog/Article implementation without weakening the underlying SEO contracts.
- UAT optimized webpack build: PASS.
- Motion/interactions built-server matrix: 123 passed, 0 failed across 390 / 640 / 820 / 1024 / 1440, including both calculator flows and Reduce Motion.
- Full Website 4.3 responsive matrix: 464 passed, 0 failed across all eight Preview routes and 390 / 600 / 820 / 1100 / 1440. The Blog final wrapped row guard now checks the already-established Figma left-anchor behavior from `Website43FinalPolishStyles` instead of the obsolete centered-row expectation.

Remote push/Preview deployment is authorized by the current owner request. Production deployment remains out of scope.

# Website 4.3 Responsive Layout Contract

Date: 2026-09-11
Status: UAT design/development source of truth
Scope: Website 4.3 preview/UAT only. This document does not authorize Production promotion.

## Why this exists

Website 4.3 previously allowed responsive transition styles to set a constrained shell width while also pinning that shell to the left edge (`margin-left: 0; margin-right: 0`). On wide desktop viewports this placed all unused width on the right side of the screen, creating visibly unbalanced whitespace and forcing page-by-page fixes.

The layout foundation is now explicit: full-bleed sections may span the viewport, but ordinary page content belongs inside one centered shared shell. Component-specific polish may change internal geometry, but it must not own horizontal page-shell alignment.

## Source-of-truth hierarchy

For horizontal layout decisions, use this order:

1. This responsive layout contract.
2. `features/website-43-uat/Website43LayoutContractStyles.tsx` for implementation invariants.
3. Clean Figma responsive source-of-truth frames that implement this contract.
4. Transition/final-polish styles only for component-level interpolation and visual tuning.

Clean Figma source of truth:

- `CCPun Website 4.3 — Responsive Source of Truth`
- https://www.figma.com/design/GnY9j08aOonw70CA1memRK
- Use `02 — Foundations`, `03 — Components`, `14 — Website 4.3 · Source of Truth`, and `90 — Responsive QA` as the active layout references.
- Treat the older CCPun UX/UI file and Website 4.3 experiment frames as archive/reference, not horizontal-layout authority.

Do not use archived Website 4.3 experiment frames as layout authority.

## Core composition rule

Use this structure for standard sections:

`viewport / full-bleed section -> horizontal gutter -> centered inner shell -> component grid/content`

A full-bleed background, hero image, carousel viewport, or decorative treatment may reach the viewport edges. Its readable content and primary alignment anchors still use the shared shell unless an exception is explicitly documented.

## Canonical widths

### Mobile canonical: 390 px

- Standard content gutter: 24 px.
- Standard reading width: 342 px.
- Shell is centered.
- No constrained content block may be left-pinned when spare horizontal space exists.

### Tablet canonical: 820 px

- Standard content/navigation gutter: 40 px.
- Available standard shell: viewport minus 80 px.
- Shell is centered.
- Two-column layouts must collapse before they create edge collisions or horizontal overflow.

### Desktop canonical: 1440 px

- Standard shell maximum: 1280 px.
- Canonical side space: 80 px on each side.
- Shell is centered.
- Hero copy aligns to the same shell edge even when the image is full bleed.

## Transition references

600 px and 1100 px are QA references, not new responsive modes.

- 600 px uses the mobile mode. Its canonical reading shell is 504 px and must be centered, producing balanced spare space.
- 1100 px uses the desktop mode/interpolation. It must preserve the same centered-shell invariant rather than introducing a one-off alignment rule.

Do not add breakpoint-specific patches at exactly 600 px or 1100 px unless a new product requirement explicitly changes the responsive model.

## Wide desktop behavior

1728 px and 1920 px are required wide-screen QA references.

The content shell remains capped at 1280 px. Extra viewport width is distributed symmetrically.

The shared wide-screen alignment edge is:

`max(minimum responsive gutter, (viewport width - 1280 px) / 2)`

Implementation token:

`--w43-shell-edge: max(var(--w43-nav-gutter), calc(50vw - 640px))`

This token is the alignment anchor for desktop hero copy and other full-bleed compositions that need to line up with the centered content shell.

## Implementation ownership

`Website43TransitionStyles.tsx`
- May interpolate component geometry between canonical frames.
- Must not be treated as the authority for centering the page shell.

`Website43FinalPolishStyles.tsx`
- May refine visual geometry after viewport QA.
- Must not override centered-shell invariants.

`Website43LayoutContractStyles.tsx`
- Loads after transition and final-polish styles.
- Owns horizontal shell centering and wide-screen shell-edge alignment.
- Uses the stable QA marker `data-w43-layout-contract="centered-shell-v1"`.

When the legacy transition bridge is simplified in the future, old left-pinning declarations should be removed rather than re-created elsewhere. Until then, the layout contract is intentionally loaded last so old bridge declarations cannot regress the shell.

## Allowed exceptions

An exception must be intentional and documented. Typical allowed cases:

- Full-bleed hero imagery/backgrounds.
- A carousel viewport that intentionally reaches the viewport edge while its heading remains shell-aligned.
- Decorative gradients or image stages.
- A reading column intentionally narrower than the standard shell, provided it is centered or explicitly anchored within a centered parent grid.

A standard card grid, footer, FAQ, page heading, legal content, article header, blog listing, or ordinary section is not an exception.

## Responsive QA contract

Before a Website 4.3 UX/UI PR is eligible for review, verify at minimum:

- 390 px
- 600 px
- 820 px
- 1024 px
- 1100 px
- 1280 px
- 1440 px
- 1728 px
- 1920 px

Required assertions:

- No horizontal overflow.
- Shared shells have balanced left/right spare space.
- Standard content never touches a viewport edge unexpectedly.
- Header, section content, CTA groups, footer and hero copy share intentional alignment anchors.
- Wide desktop does not accumulate dead space on only one side.
- Full-bleed visuals remain full bleed without dragging readable content off the shared alignment grid.
- Responsive transitions do not introduce a new layout mode at 600 or 1100.

Static regression coverage lives in `tests/website-43-layout-contract.test.mjs` and is part of `test:foundation-contracts`.

## Figma contract

The clean Website 4.3 Figma source of truth should show, at minimum:

- Layout-contract/foundation page.
- Canonical frames: 390, 820, 1440.
- Transition-reference frames: 600, 1100.
- Wide-desktop QA frame: 1728 (1920 may remain QA-only if no separate visual decision exists).
- Visible shell/gutter annotations.
- Full-bleed outer section separated from centered inner content shell.

Figma should describe the same contract as code; it should not contain independent left/right measurements that require developers to reverse-engineer page-specific behavior.

The reusable `Layout / Centered Shell` component in the clean file binds its left and right padding to the same `Shell/Edge` responsive variable. Use it instead of redrawing page-shell geometry manually.

## Change policy

If a future design requires a different maximum shell width, gutter model or canonical breakpoint, change the contract, implementation token(s), Figma foundations and regression test in the same branch/PR. Do not change one layer independently.

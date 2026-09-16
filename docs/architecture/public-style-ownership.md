# Public Web style ownership

This document defines where Public Web styles belong. The goal is to keep CCPun easy to extend without accumulating another stack of one-off override files.

## Ownership map

| Concern | Owner |
| --- | --- |
| Global tokens, Tailwind theme, document defaults, focus baseline | `app/globals.css` |
| Reachable cross-feature compatibility class names | `components/styles/public-compat.css` |
| Shared named animations and global reduced-motion behavior | `components/styles/public-motion.css` |
| FHC print-only behavior | `features/financial-health-check/styles/print.css` |
| Website 4.3 layout and visual rules | CSS Modules under `components/layout/website-43/` and the owning feature |
| Navbar | `Website43Navbar.module.css` |
| Legal pages | `Website43Legal.module.css` |

## Rules for new work

1. Prefer the nearest feature/component CSS Module for new visual rules.
2. Do not recreate `app/components.css` or another generic global style bucket.
3. `public-compat.css` is compatibility-only. A new one-off Website 4.3 fix does not belong there.
4. Feature-only global contracts, such as print behavior, stay in that feature directory even when imported by the root stylesheet.
5. Do not add another `Website43*Styles.tsx` patch layer. `Website43TransitionStyles.tsx` and `Website43FinalPolishStyles.tsx` are the two existing migration bridges; new work should consolidate rules into the real CSS Module owner instead of creating a third bridge.
6. When touching a rule that is duplicated between `Website43.module.css` and a migration bridge, prefer reducing duplication while preserving the current computed output and regression contracts.
7. Critical CSS in `app/layout.tsx` is a protected performance surface. Move it only with measured LCP evidence and the existing performance gates.

## Automated guard

`npm run audit:public-css` builds an App Router import graph and enforces the ownership boundaries above. It fails when:

- the generic `app/components.css` bucket returns;
- an owned global class has no reachable runtime reference;
- the same global class is owned by multiple owner stylesheets;
- Website 4.3 starts using dynamic CSS Module property access that makes static auditing unsafe; or
- another `Website43*Styles.tsx` patch bridge is added.

The audit also reports zero-reference selectors remaining in `Website43.module.css`. Those are cleanup candidates, not automatic deletion instructions; remove them only when the current owner and regression coverage are clear.

# Public Web style ownership

This document defines where Public Web styles belong. The goal is to keep CCPun easy to extend without accumulating another stack of one-off override files.

## Ownership map

| Concern | Owner |
| --- | --- |
| Global tokens, Tailwind theme, document defaults, focus baseline | `app/globals.css` |
| Reachable cross-feature compatibility classes | `components/styles/public-compat.css` |
| Shared named animations and global reduced-motion behavior | `components/styles/public-motion.css` |
| FHC print-only behavior | `features/financial-health-check/styles/print.css` |
| Website 4.3 base layout and visual rules | `components/layout/website-43/Website43.module.css` or the nearest feature CSS Module |
| Website 4.3 responsive interpolation and viewport refinements | `components/layout/website-43/Website43ResponsiveStyles.tsx` |
| Navbar | `components/layout/website-43/Website43Navbar.module.css` |
| Legal pages | `components/layout/website-43/Website43Legal.module.css` |

## Rules for new work

1. Prefer the nearest feature/component CSS Module for new visual rules.
2. Do not recreate `app/components.css` or another generic global style bucket.
3. `public-compat.css` is compatibility-only; new feature styling does not belong there.
4. Feature-only global contracts, such as print behavior, stay in that feature directory even when imported by the root stylesheet.
5. `Website43ResponsiveStyles.tsx` is the only runtime owner for responsive interpolation that cannot yet live cleanly in a narrower CSS Module.
6. Do not create another transition, polish, fix, or override style layer. Update the canonical owner instead.
7. When the same selector/property exists in more than one layer, consolidate ownership while preserving computed output and regression coverage.
8. `Website43.module.css` is a shared migration-era map. Prefer narrower feature/component modules for new work and shrink this shared map as ownership becomes clear.
9. Critical CSS in `app/layout.tsx` is a protected performance surface. Move it only with measured LCP evidence and the existing performance gates.

## Ownership roles

A **base owner** defines the normal visual behavior of a class. A **contextual override** may adjust an existing base-owned class for a constrained context such as `@media print`, but it does not become a second base owner. Contextual overrides must point to a class that already has a base owner.

## Automated guard

`npm run audit:public-css` uses the shared App Router reachability graph in `scripts/lib/public-reachability.mjs` and fails when:

- the generic `app/components.css` bucket returns;
- an owned global class has no reachable runtime reference;
- a global class has more than one base owner;
- a contextual override points to no base-owned class;
- Website 4.3 uses dynamic CSS Module property access that makes static auditing unsafe;
- the canonical `Website43ResponsiveStyles.tsx` owner disappears; or
- a parallel responsive style bridge returns.

The audit also reports zero-reference selectors remaining in `Website43.module.css`. Those are cleanup candidates, not automatic deletion instructions; remove them only when current ownership and regression coverage are clear.

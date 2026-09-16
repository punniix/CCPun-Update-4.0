# Public Production Code Diet — Phase 2

Status: implementation branch; merge only after Foundation CI and Vercel Preview are green.

## Primary objective

Make Public Web styling easier to extend without repeating the patch-layer pattern that accumulated during Website 4.3 delivery. Runtime size is a secondary benefit, not the decision criterion.

## Scope

- replace the generic `app/components.css` bucket with explicit owners;
- keep global foundation, compatibility classes, motion, and feature-only print rules separated;
- audit route-reachable class usage from the App Router graph;
- report stale selectors in `components/layout/website-43/Website43.module.css` without deleting them automatically;
- prevent a third `Website43*Styles.tsx` patch bridge from being added;
- document where future Public Web styles belong;
- preserve Home, Blog, Article, CI Planning, FHC, Privacy/Cookie, SEO, analytics/consent, and calculator behavior.

## Ownership result

- `app/globals.css` — tokens, Tailwind theme, document defaults, focus and document scrollbar
- `components/styles/public-compat.css` — reachable cross-feature compatibility classes only
- `components/styles/public-motion.css` — shared named animations and reduced-motion contract
- `features/financial-health-check/styles/print.css` — FHC print contract
- Website 4.3 component/feature CSS Modules — normal visual ownership for new work

See `docs/architecture/public-style-ownership.md` for the development rules.

## Safety

No URL/canonical/robots/sitemap/content/data/provider changes. No selector is removed solely because its name looks legacy. Critical CSS in `app/layout.tsx` remains untouched. The two existing Website 4.3 migration bridges remain in place, but CI blocks adding another patch-style bridge.

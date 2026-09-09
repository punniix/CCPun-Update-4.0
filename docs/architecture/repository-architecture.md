# CCPun Repository Architecture

This document is the source of truth for source-file ownership. The goal is predictable placement and safe change boundaries, not a large number of folders. Existing public URLs, persisted Sanity names, analytics events, consent behavior, calculator results, and environment guards are contracts.

Runtime, environment and data-plane ownership are defined separately in [`platform-data-architecture.md`](./platform-data-architecture.md). Do not copy those mappings into feature documents.

Runtime baseline: Public Web and Admin use Node.js 24.x with the npm version pinned in `package.json`. Local development and CI use the same Node major; `package.json` is the Vercel runtime authority, `.nvmrc` is the local selector, and `.npmrc` rejects installs on another Node major.

## Dependency direction

```text
app (routes and composition)
  -> features (product behavior and feature UI)
    -> components + lib (shared UI and infrastructure)

cms/sanity (editorial and Admin schema/configuration)
  -> lib/content (URL/taxonomy contracts)
  -> lib/admin/environment (data-plane guard)
```

- `app/` owns physical routes, route handlers, layouts, metadata entrypoints, and thin composition files. It does not own large feature implementations.
- `features/` owns feature-specific UI, page composition, calculation/domain behavior, and data adapters that are not shared infrastructure.
- `components/layout/` owns global layout components. `components/ui/` owns genuinely reusable UI primitives.
- `lib/` owns server infrastructure and cross-feature domain services. New code must have a domain directory; the few remaining root files are compatibility or central boundaries.
- Shared infrastructure must not import from `app/` or `features/`. A feature must not reach into another feature's internals; promote genuinely shared logic to `components/`, `lib/`, `hooks/`, or `types/`.

## Top-level ownership

| Path | Owns | Does not own |
|---|---|---|
| `app/` | Next.js routes, layouts, route handlers, metadata, error/loading/not-found | large UI implementations or reusable business logic |
| `features/home/` | homepage-only composition and sections | global navigation/layout |
| `features/blog/` | archive/article/category presentation and article feature schema | URL taxonomy or CMS schema |
| `features/ci-planning/` | current CI calculator, UI, result rendering; explicitly named legacy implementation | general financial utilities |
| `features/financial-health-check/` | FHC calculator and UI | analytics provider code |
| `features/admin/` | reusable Admin feature presentation and feature orchestration | authentication, RBAC, environment or Sanity write guards |
| `features/analytics/` | client-side analytics/consent presentation components | event naming/mapping authority |
| `components/layout/` | Navbar, Footer, shared tool layout | feature-only components |
| `components/ui/` | reusable UI primitives | feature workflows |
| `lib/content/` | content provider, taxonomy, physical URL, canonical and redirect ownership | route rendering |
| `lib/admin/` | Auth/RBAC, Admin APIs/services, provider clients, environment and mutation safety | Admin page presentation |
| `lib/analytics.ts` | semantic event and provider mapping authority | UI |
| `lib/cookie-consent.ts` | stored consent authority | feature-specific consent copies |
| `lib/seo/` | shared deterministic SEO and structured-data infrastructure | persisted CMS schema |
| `lib/observability/` | server-side crawler classification and sanitized request logging | analytics provider events or editorial content |
| `lib/shared/` | small cross-feature helpers with no feature dependency | miscellaneous dumping ground |
| `cms/sanity/` | Sanity schemas, Studio configuration, lifecycle policy and CMS documentation | physical URL taxonomy |
| `db/` | reviewed relational migrations for operational state such as publishing jobs, locks and platform IDs | editorial content or credentials in source control |
| `qa/` | executable QA, protected ledgers/fixtures, screenshots and evidence | product source code |
| `tests/` | deterministic regression contracts | mutable runtime data |
| `scripts/` | migration, deployment and maintenance commands | imported application runtime logic |
| `workers/` | isolated background/worker entrypoints when an actual workload exists | speculative queues |

## Route rules

Physical route paths remain under `app/` even when their implementations move to a feature. A thin route may re-export `metadata`, `generateMetadata`, and the default page implementation from its owner feature.

Do not introduce a route group such as `app/(public)` merely for visual symmetry. Add one only when it creates a real shared layout boundary and URL/regression checks prove that the physical URLs remain identical.

Protected routes include `/`, `/blog/`, `/blog/[category]/`, `/blog/[category]/[slug]/`, `/ci-planning/`, `/tools/financial-health-check/`, `/snt-admin/`, `/studio/`, sitemap routes, Preview APIs, and Admin APIs.

## Feature placement examples

- New public page: route in `app/`; implementation in `features/<feature>/` when non-trivial.
- New product feature: `features/<kebab-case-name>/` with its UI and domain code together.
- Shared UI: `components/ui/`; global layout: `components/layout/`.
- Calculator: `features/<feature>/calculator/`; preserve regression outputs.
- Admin page: route/handler stays in `app/snt-admin/` or `app/api/snt-admin/`; reusable implementation goes in `features/admin/<area>/`; security/provider/data-plane services stay in `lib/admin/`.
- SEO rule: shared deterministic logic in `lib/seo/`; Admin SEO feature UI in `features/admin/seo/`; physical URL ownership remains in `lib/content/`.
- Analytics: feature components emit through `lib/analytics.ts`; they never call providers directly or rename existing events silently.

## Sanity ownership and safety

```text
cms/sanity/
  schema/documents/   top-level editorial documents
  schema/objects/     reusable embedded editorial objects
  admin/schema/       SEO intelligence, audit, research and system records
  policy/             Studio access and lifecycle restrictions
  config/             Studio structure, presentation and publishing composition
  components/         custom Studio inputs
  schema/index.ts     deterministic schema aggregation only
  schema.ts           compatibility entrypoint only
```

Persisted schema `name` values are data contracts. Filenames and exported variable names may change; persisted type and field names do not change during ordinary refactors. Existing Article slug/category/canonical/noindex locks, review statuses, required fields, Portable Text blocks, link validation, image-alt requirements, migration evidence, and Production lifecycle restrictions must remain intact.

`lib/content/url.ts` and `lib/content/taxonomy.ts` own physical URL/category rules. Sanity consumes those rules and must not duplicate them. `lib/admin/environment.ts` owns fail-closed project/environment/dataset isolation. Unknown or mismatched lanes are denied; a `production` dataset alone is never sufficient authorization.

Editorial documents and system intelligence documents are different product surfaces even when both are stored in Sanity. System records remain hidden/restricted in Studio. Production Sanity documents are never patched, migrated, published, unpublished, or deleted by a structural refactor.

## Intentional compatibility surfaces

- `cms/sanity/schema.ts` remains a small compatibility entrypoint while definitions live under `cms/sanity/schema/`.
- `public/nav-config.json` remains a public compatibility mirror of canonical `lib/nav-config.json`; `test:architecture` prevents drift.
- Critical CSS stays in `app/layout.tsx` until measured LCP/render evidence supports a separate change.
- Protected QA ledgers remain in their established paths because deployment and SEO contracts consume them.
- CI Planning's current and legacy calculators stay explicitly separate until product evidence authorizes removal.
- Published public asset URLs are not moved solely for folder consistency.

## Naming and automated guard

- Feature and architecture folders use `kebab-case`.
- React component filenames may use `PascalCase`.
- Use small `index.ts` files only as composition/public APIs; do not export every internal file.
- Do not add a new top-level directory without an ownership reason and an architecture update.
- Run `npm run test:architecture`. It checks top-level ownership, root artifacts, feature boundaries, root `lib/` drift, navigation mirror parity, Sanity type names/duplicates, Article and SEO locks, Studio policy/configuration, and composition-only schema aggregation.

## Version development after this refactor

The architecture baseline is shared by both Vercel survivors. A repository-structure change is ready only after both Public Web and Admin builds pass from the same commit.

- Website 4.2 (Content, Social and SEO Operating System) starts from the settled refactored baseline. Admin UI belongs under `features/admin/`; route handlers stay under `app/api/snt-admin/`; security/provider infrastructure belongs under `lib/admin/`; Master Content and channel-variant editorial documents go under `cms/sanity/schema/documents/`; operational jobs/tokens/platform IDs belong in the relational data plane under `db/`, not Sanity.
- The Social foundation keeps one required `socialVariant.masterContent` reference and derives reverse relationships. Editorial copy/review stays in Sanity; execution status, platform IDs, locks, idempotency, and audit stay in Postgres. UAT-only schema types must remain hidden and actionless in Production Studio.
- Website 4.3 (Public UX/UI) starts as a fresh active branch from the same settled baseline. Historical UX work is selectively ported and visually revalidated; the old branch is lineage evidence, not a branch to merge wholesale.
- Neither version creates another Vercel project. Preview/UAT lanes live inside `ccpun-web` and `ccpun-admin` with fail-closed branch routing.

Before Phase 1 of Website 4.2, verify the two-project Vercel routing, Node/runtime parity, Admin-only UAT database binding, feature flags default-off, Sanity UAT/Production guards, and a clean branch based on the accepted architecture commit. Then implement one phase per Draft PR and require both deterministic tests and the relevant Admin Preview review.

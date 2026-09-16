# Phase 3 — Full Public Web Audit

## Objective

Audit the complete user-facing `ccpun.com` runtime for maintainable ownership. Performance improvements are secondary. The audit must distinguish current Public owners from Admin/Studio-only code, legacy source, test-only contracts, duplicate ownership, and genuinely orphaned code.

## In scope

- Blog archive, category, article renderer, TOC, FAQ, search/filter interactions and SEO route ownership
- Home
- CI Planning
- Financial Health Check
- shared Website 4.3 shell and responsive ownership
- legal pages
- analytics/consent wiring used by Public pages
- `lib/content` and `lib/seo` modules reachable from Public routes
- production dependency usage from the Public graph and repository source
- regression tests that still point at retired/legacy implementation owners

## Out of scope

- changing article content or Sanity data
- deleting Blog/CMS media based on source-code reachability
- Admin Control Plane behavior changes
- URL/canonical/redirect/sitemap changes unless an audit reveals a defect and a separate evidence-backed fix is required
- calculator formula changes
- Production merge/deploy

## Audit model

`publicReachable` starts only from user-facing App Router page/metadata roots. It deliberately excludes Control Plane, API, Auth, Studio, workflow callback and Proxy roots. `reachable` remains the repository-wide route/request graph. A module can therefore be classified as:

- `public`: reachable from a user-facing page
- `internal`: not Public, but reachable from another route/request owner
- `orphan`: unreachable from every current route/request root

Orphan code is not deleted solely because the graph reports it. Regression tests and migration/protocol ownership are checked first.

## Required validation before Ready for Review

- `npm run check:foundation`
- FHC/CI formula and exhaustive browser QA
- sitemap and SEO/HTTP contracts
- Home LCP contract
- Production-parity build
- Vercel Preview

No Production merge is included in Phase 3 until explicitly authorized.

# P2.2 — Safe Legacy Route Implementation Deduplication

Status: non-destructive source deduplication. No Hostinger filesystem, release, environment, routes or content were changed directly.

## Evidence and ownership

Production and UAT Web use apps/web; Production and UAT Admin use apps/admin. Root app/ is a legacy compatibility router for survivor/rollback builds. It is also inspected by regression tests; deleting it wholesale would be unsafe.

P1 identified 104 path-matched route pairs, with 74 byte-identical copies and 30 divergent implementations.

This pass moves three byte-identical Web route implementations to shared feature-owned source, leaving required routing wrappers for both the root legacy app/ and canonical apps/web/app/:

| Shared implementation | Original byte count | Preserved routing entrypoints |
| --- | ---: | --- |
| features/legal/pages/PrivacyPage.tsx | 21,581 | app/privacy/page.tsx; apps/web/app/privacy/page.tsx |
| features/legal/pages/CookiePolicyPage.tsx | 24,605 | app/cookie-policy/page.tsx; apps/web/app/cookie-policy/page.tsx |
| features/public-pages/NotFoundPage.tsx | 2,232 | app/not-found.tsx; apps/web/app/not-found.tsx |

The exact original content and metadata remain unchanged in the shared module. Both wrappers explicitly forward default component and metadata. This removes approximately 48 KB of duplicate implementation text from version control, **not** three required URL routing pairs. The P1 path-pair baseline remains valid.

Tests that previously inspected legal page source now inspect the shared implementation and explicitly verify cookie-policy routing/robots forwarding. The monorepo architecture test also checks exact wrapper forwarding for all three routes to prevent regression.

## Deferred (not confirmed removable)

Other 101 preexisting route-path pairs remain. Thirty historically differed and cannot be mechanically merged. Many Admin API root compatibility implementations are directly scanned by security tests and might be required for survivor builds. They require consumer-by-consumer migration/acceptance before removal. No unverified source deletions are authorized.

## Non-interference

No UX Improvement branch/worktree, Draft Investment Allocation PR #165, main WIP, Sanity/Neon, SEO canonical/sitemap/robots, content, assets, Hosting runtime, DNS or release identity was altered as part of this source change.

Validate with Architecture Test, legal content regression and Web/Admin shadow CI. Promote to the four Hostinger lanes only as a separately approved SHA-pinned release after parity and rollback checks; do not replace Web UAT UX with this housekeeping branch.

# Repository Handoff Pointer

This file does not store mutable task state or grant approval.

Before repository work:

1. Read the workspace shared state and current task receipt.
2. For PR57 social workspace work, treat [`docs/admin-layer/social-product-contract.md`](./docs/admin-layer/social-product-contract.md) as the acceptance source of truth.
3. Read [`docs/current-work.md`](./docs/current-work.md).
4. Read [`docs/architecture.md`](./docs/architecture.md).
5. Inspect the exact target branch/worktree and scoped diff.

GitHub PR state, deployment state and Production authorization must be verified live for the current task.

Article optimization workflow, migration evidence, production steps and rollback: [runbook](./docs/admin-layer/article-optimize-workflow.md). Current execution status remains in receipt `sanity-optimize-20260909`.

Recorded milestone (2026-09-09): PR #83 merged as `aea1f3b99bdc9408957b6d1f5dc5a75e2926fa29`; the separately approved Production normalization completed atomically (3 raw documents / 8 rows; 61-record integrity check; zero remaining patches). Web and Admin Production are READY at the same merge SHA; authenticated read-only AIA Vitality Studio visual QA passed (banner, review guard, URL locks and object cards). No article was edited or published during QA. Read the receipt for newer evidence before acting.

Recorded milestone (2026-09-10): PR #87 (`fix/content-data-foundation-20260910`) hardens Sanity reads and Blog metadata. The branch splits lightweight list/card projections from strict full-article reads, isolates invalid list records and related-article failures, ranks related articles by topic/category, adds typed/redacted Sanity error logging, and gives `/blog/` explicit Open Graph/Twitter metadata. Production Sanity documents were not edited or published; motor-insurance drafts were not touched. Neon clean views were audited as 383 rows / 383 distinct content IDs across `marketing_content_current`, `post_performance_current_clean`, and `post_performance_latest`; no SQL/schema changes were needed. Neon `main` branch protection could not be enabled because the current plan has no remaining protected-branch quota; no existing branch protection was removed.

PR #87 visual evidence (2026-09-10): authenticated Vercel Web Preview was inspected at 390 / 600 / 820 / 1100 / 1440 on Home, Blog, Health category, AIA Health CI Hero, CI Planning and Financial Health Check. Vercel Preview remains correctly isolated to Sanity UAT. Read-only Sanity counts are UAT published=0 and Production published=5, so empty Blog/category results and the representative article 404 on the Vercel Preview are expected environment behavior. Full content QA used the repository's `local:production:read` lane with Production draft writes disabled; 30 route/viewport layout comparisons had zero regression groups against current Production. Blog canonical/Open Graph/Twitter checks passed and the new related ordering for Health CI Hero is Health Happy then AIA Vitality. A small 820px CI Planning progress-label left overhang also exists on current Production and was not changed.

CSS consolidation evidence (2026-09-10): only settled FinalPolish declarations were moved into `Website43.module.css` (Thai line breaking, article source URL wrapping, Blog article-grid/category trigger, Home hero crop). `Website43TransitionStyles` and breakpoint architecture remain unchanged. Computed-style comparison against Production passed 15/15 targeted probes across all five reference widths. Local `npm run check:foundation` passed under Node 24.11.1.

PR #87 delivery state (2026-09-10): commit `6f436cbc6c80646b4b130972cc604bacb193fe1f` was pushed and Foundation CI run `34389137889` completed SUCCESS, including Production-parity build. Vercel Web deployment `dpl_7qoGpJPyrCzjJt9SP7E6RFAGtsaV` and Admin deployment `3eZJSivzbJHANNzbxGGgqQZAYezD` completed successfully. The refreshed authenticated Web Preview was rechecked across all five reference widths: Home, CI Planning and Financial Health Check remained zero-diff against Production; Blog/category/article differences remain only the expected UAT published=0 lane, and Blog social metadata still passed. Final `listArticles()` consumer review confirmed no list consumer requires full body/FAQ/sources/review/geo data. The PR remains scoped to eight files and does not mutate Sanity Production content, Neon, routing, analytics, consent or protected URLs. After this documentation-only evidence update, re-verify the resulting CI/Preview head; if green, merge PR #87 to `v4-production` and immediately perform read-only Production checks for Blog/article rendering, OG metadata, publish freshness configuration and runtime errors.

Recorded milestone (2026-09-11): branch `fix/seo-copy-source-of-truth-20260911` synchronizes the user's approved `Your Revised Text (Source of Truth)` copy into the Website code without touching `v4-production` directly. The scoped code changes cover homepage metadata/social previews, Organization/Person structured data and verified credentials, the shared Website 4.3 author card, and the Website 4.3 footer role. Vercel Web Preview deployment `dpl_6RqMcbyowD7NQq4eUmsot3bdxihW` for commit `0f45ee111a94cf903e9b2235056870d29c660af2` reached READY with no build errors. Production merge is not authorized yet; user Preview approval is required first.

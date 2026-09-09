# Current Work Pointer

Mutable task status is intentionally not duplicated in this repository.

Use, in order:

1. Workspace shared state for the current owner and paused handoffs.
2. The current task receipt for scope, evidence and next owner.
3. Live GitHub PR/check state for branch delivery status.
4. Live Vercel read-back for deployment status.

This pointer never authorizes push, merge, deployment, environment mutation or data mutation.

Article optimization workflow, migration evidence, production steps and rollback: [runbook](./admin-layer/article-optimize-workflow.md). Current execution status remains in receipt `sanity-optimize-20260909`.

Recorded milestone (2026-09-09): PR #83 merged as `aea1f3b99bdc9408957b6d1f5dc5a75e2926fa29`; the separately approved Production normalization completed atomically (3 raw documents / 8 rows; 61-record integrity check; zero remaining patches). Web and Admin Production are READY at the same merge SHA; authenticated read-only AIA Vitality Studio visual QA passed (banner, review guard, URL locks and object cards). No article was edited or published during QA. Read the receipt for newer evidence before acting.

Current branch (2026-09-10): `fix/content-data-foundation-20260910`, PR #87, base `v4-production`. Scope completed on branch: lightweight Sanity list/card projection; strict full-article validation retained; invalid list rows fail isolated; related-article failures fail open; related ranking prefers semantic topic/category; `/blog/` owns canonical Open Graph/Twitter metadata; regression guards added. Production content and motor-insurance drafts were not changed. Neon clean-view audit found 383/383 distinct content IDs in the three current clean views, so no database de-duplication migration is warranted. Existing `ccpun_social_runtime` role is limited to SELECT/INSERT; no new runtime role was created. Neon `main` protection remains blocked by protected-branch quota on the current plan.

Visual QA milestone (2026-09-10): authenticated Vercel Web Preview was checked at 390 / 600 / 820 / 1100 / 1440 across Home, Blog, Health category, AIA Health CI Hero, CI Planning and Financial Health Check. The Web Preview is correctly pinned to Sanity UAT; a direct read-only audit confirmed UAT has 0 published articles while Production has 5, so empty Blog/category cards and the representative article 404 on Vercel Preview are expected lane behavior, not a `listArticles()` regression. The same branch was therefore run through the repository's `local:production:read` mode (draft writes disabled) for full published-content visual QA. All 30 route/viewport comparisons had zero layout-regression groups against current Production; Blog OG/Twitter checks passed; related Health CI Hero cards resolve to Health Happy then AIA Vitality. A pre-existing CI Planning progress label can extend about 12px left at 820px, but current Production behaves the same and it was intentionally not changed in PR #87.

CSS 4.3 cleanup milestone (2026-09-10): only settled FinalPolish rules were consolidated into `Website43.module.css` (Thai line-breaking contract, article source URL wrapping, Blog grid alignment/category trigger, Home hero image crop). `Website43TransitionStyles` and breakpoint architecture were not changed. Targeted computed-style comparison against Production passed 15/15 probes across the five reference widths after consolidation. Local `npm run check:foundation` passed on Node 24.11.1, including lint, TypeScript, architecture/foundation/Vercel/admin regressions (404 tests, 0 failures in the final Node test batch). Next task: commit/push this evidence-backed CSS consolidation, wait for fresh PR #87 CI and Vercel Preview, review the final diff and authenticated Preview, then merge only if the live checks remain green and current Production authorization is still valid.

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

Current branch (2026-09-10): `fix/content-data-foundation-20260910`, PR #87, base `v4-production`. Scope completed on branch: lightweight Sanity list/card projection; strict full-article validation retained; invalid list rows fail isolated; related-article failures fail open; related ranking prefers semantic topic/category; `/blog/` owns canonical Open Graph/Twitter metadata; regression guards added. Foundation CI run #316 passed and Vercel Web/Admin Preview status checks are green. Production content and motor-insurance drafts were not changed. Neon clean-view audit found 383/383 distinct content IDs in the three current clean views, so no database de-duplication migration is warranted. Existing `ccpun_social_runtime` role is limited to SELECT/INSERT; no new runtime role was created. Neon `main` protection is blocked by protected-branch quota on the current plan. Remaining task: authenticated visual QA of protected Preview before any CSS 4.3 consolidation or Production merge. Khai-hub/browser-capable agent may continue from PR #87; preserve SEO URLs, consent, analytics, Sanity lane separation, and Production safety rules.

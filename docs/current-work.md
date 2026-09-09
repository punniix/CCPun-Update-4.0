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

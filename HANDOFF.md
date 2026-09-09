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

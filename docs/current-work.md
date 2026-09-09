# Current Work Pointer

Mutable task status is intentionally not duplicated in this repository.

Use, in order:

1. Workspace shared state for the current owner and paused handoffs.
2. The current task receipt for scope, evidence and next owner.
3. Live GitHub PR/check state for branch delivery status.
4. Live Vercel read-back for deployment status.

This pointer never authorizes push, merge, deployment, environment mutation or data mutation.

Article optimization workflow, migration evidence, production steps and rollback: [runbook](./admin-layer/article-optimize-workflow.md). Current execution status remains in receipt `sanity-optimize-20260909`.

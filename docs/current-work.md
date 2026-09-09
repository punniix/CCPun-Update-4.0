# Current Work Pointer

Mutable task status is intentionally not duplicated in this repository.

Use, in order:

1. Workspace shared state for the current owner and paused handoffs.
2. The current task receipt for scope, evidence and next owner.
3. Live GitHub PR/check state for branch delivery status.
4. Live Vercel read-back for deployment status.

This pointer never authorizes push, merge, deployment, environment mutation or data mutation.

Website 4.3 motion reference: [`website-43-motion-uat.md`](./website-43-motion-uat.md), with scope/evidence/next owner in workspace receipt `website43-motion-uat-20260909`. Read current GitHub and Vercel state rather than inferring delivery from this reference.

# Current Work Pointer

Mutable task status is intentionally not duplicated in this repository.

Use, in order:

1. Workspace shared state for the current owner and paused handoffs.
2. The current task receipt for scope, evidence and next owner.
3. Live GitHub PR/check state for branch delivery status.
4. Live Vercel read-back for deployment status.

This pointer never authorizes push, merge, deployment, environment mutation or data mutation.

Website 4.3 motion reference: [`website-43-motion-uat.md`](./website-43-motion-uat.md), with scope/evidence/next owner in workspace receipt `website43-motion-uat-20260909`. Read current GitHub and Vercel state rather than inferring delivery from this reference.

Website 4.3 responsive layout reference: [`website-43-responsive-layout-contract-20260911.md`](./website-43-responsive-layout-contract-20260911.md). Shared-shell centering, gutters, wide-screen alignment, compensation-removal rules and Figma responsive frames must follow that contract. The clean Figma Source of Truth contains canonical 390 / 820 / 1440 screens for Home, Blog Archive, Blog Article, Financial Health Check, CI Planning, Privacy, Cookie Policy and 404. Treat transition/final-polish rules as component/interpolation layers only; they must not own or counteract page-shell alignment. Treat this as UAT work until live PR/check/deployment state and explicit Production authorization say otherwise.
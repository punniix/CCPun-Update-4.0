# Current Work Pointer

Mutable task status is intentionally not duplicated in this repository.

Use, in order:

1. Workspace shared state for the current owner and paused handoffs.
2. The current task receipt for scope, evidence and next owner.
3. Live GitHub PR/check state for branch delivery status.
4. Live Vercel read-back for deployment status.

This pointer never authorizes push, merge, deployment, environment mutation or data mutation.

Website 4.3 motion reference: [`website-43-motion-uat.md`](./website-43-motion-uat.md), with scope/evidence/next owner in workspace receipt `website43-motion-uat-20260909`. Read current GitHub and Vercel state rather than inferring delivery from this reference.

Website 4.3 responsive layout reference: [`website-43-responsive-layout-contract-20260911.md`](./website-43-responsive-layout-contract-20260911.md). Shared-shell centering, gutters, wide-screen alignment and compensation-removal rules must follow that contract. PR #93 contains the transition/final-polish cleanup and static regression guards; browser and Figma validation are separate acceptance gates, not implied by those changes.

Required Figma delivery is the actual UAT UI, text and images at 390 / 820 / 1440 in the existing S01–S08 pages: Home, Blog Archive, Blog Article, Financial Health Check, CI Planning, Privacy, Cookie Policy and 404. Preserve the existing Foundation / Components / Source of Truth / Responsive QA pages and do not add duplicate screen pages. A named page, schematic frame, screenshot of a schematic board or initialized capture ID does not satisfy visual coverage. Use live PR #93 evidence for what has actually been captured and verified.

Treat transition/final-polish rules as component/interpolation layers only; they must not own or counteract page-shell alignment. Keep temporary capture scripts and relay endpoints out of the application runtime. Do not infer deployment success from a previous commit, and keep unfinished CI/FHC work isolated in UAT until explicit Production authorization.

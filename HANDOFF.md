# Repository Handoff Pointer

This file does not store mutable task state or grant approval.

Before repository work:

1. Read the workspace shared state and current task receipt.
2. For PR57 social workspace work, treat [`docs/admin-layer/social-product-contract.md`](./docs/admin-layer/social-product-contract.md) as the acceptance source of truth.
3. Read [`docs/current-work.md`](./docs/current-work.md).
4. Read [`docs/architecture.md`](./docs/architecture.md).
5. Inspect the exact target branch/worktree and scoped diff.

GitHub PR state, deployment state and Production authorization must be verified live for the current task.

For the isolated Website 4.3 motion change, read [`docs/website-43-motion-uat.md`](./docs/website-43-motion-uat.md) and workspace receipt `website43-motion-uat-20260909` before integration. These references do not authorize remote delivery or Production changes.

For Website 4.3 responsive/layout work, read [`docs/website-43-responsive-layout-contract-20260911.md`](./docs/website-43-responsive-layout-contract-20260911.md) before changing shell widths, gutters, hero alignment, responsive reference frames, transition/final-polish compensation, or the Figma source of truth. The clean Figma file must retain canonical 390 / 820 / 1440 coverage for all eight real Website 4.3 page families: Home, Blog Archive, Blog Article, Financial Health Check, CI Planning, Privacy, Cookie Policy and 404. Do not reintroduce page-specific shell offsets to match a screenshot; fix the shared contract or document a genuine full-bleed/internal-component exception. The layout contract is UAT-only and does not authorize Production promotion.

Screen coverage above is a delivery requirement, not a completion claim. Repair the existing S01–S08 pages in place; do not create Q/V duplicates. Verify actual UAT images, page identity and viewport evidence before treating any frame as a visual source of truth. Pending capture IDs, schematic boards, static geometry calculations and deployment success are not browser QA. Keep capture tooling outside the application runtime; do not restore the temporary Figma script or submission proxy to work around browser access failures. Read the live PR #93 evidence and blockers before continuing.

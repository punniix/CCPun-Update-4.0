# CCPun Public Web — Hostinger

The canonical Public Web source root is `apps/web`, shared by two independently configured Hostinger lanes: `ccpun.com` (Production) and `test.ccpun.com` (UAT). Source of truth for the four lanes is `lib/runtime/deployment-lanes.mjs`.

Production currently builds from repository root `./` and publishes `apps/web/.next`; Web UAT builds from `apps/web` and publishes `.next/standalone` with its explicit entrypoint. Do **not** make one lane's build/output path match the other merely for folder symmetry.

Shared implementations are imported from root `features/`, `components/` and `lib/`; shared public assets live under `public/`. `apps/web/public` points to `../../public` in source and the Hostinger build materializes them in the runtime artifact.

The root `app/` directory is retained for legacy/compatibility until its consumers and rollback requirements are explicitly audited. Do not add new duplicate route implementations there. Audit with `node scripts/audit-monorepo-boundaries.mjs` and run `npm run test:architecture` before promotion.

Pinned Production release refs must derive from reviewed `v4-production` commits and use matching Git SHA/release identity, not a moving release pointer. See `docs/architecture/p1-four-lane-source-ownership-20261008.md` and `docs/architecture/ccpun-four-lane-deployment-contract.md`.

# Architecture Index

- [`architecture/ccpun-runtime-baseline-20261007.md`](./architecture/ccpun-runtime-baseline-20261007.md) — current observed four-host runtime/provider baseline and migration state
- [`architecture/private-execution-ownership-20261007.md`](./architecture/private-execution-ownership-20261007.md) — exclusive private-VPS execution authority and accepted Production execution ownership
- [`architecture/vercel-retirement-audit-20261007.md`](./architecture/vercel-retirement-audit-20261007.md) — current Vercel zero-live-dependency audit and rollback inventory
- [`architecture/vercel-final-retirement-20261008.md`](./architecture/vercel-final-retirement-20261008.md) — permanent Vercel project deletion and canonical-domain detachment receipt
- [`architecture/final-security-historical-cleanup-20261008.md`](./architecture/final-security-historical-cleanup-20261008.md) — final dead-path, branch, VPS and dependency-security cleanup receipt
- [`architecture/post-migration-security-provider-readiness-20261008.md`](./architecture/post-migration-security-provider-readiness-20261008.md) — post-migration Next.js security patch, protected local worktree cleanup and live Social/LINE read-only acceptance
- [`architecture/vps-filesystem-audit-20261007.md`](./architecture/vps-filesystem-audit-20261007.md) — read-only VPS storage/runtime inventory and Phase 2 cleanup boundary
- [`architecture/phase3-private-worker-activation-20261007.md`](./architecture/phase3-private-worker-activation-20261007.md) — Phase 3 supervised private-worker activation receipt and Phase 4 Production hold boundary
- [`architecture/phase4-operational-acceptance-20261007.md`](./architecture/phase4-operational-acceptance-20261007.md) — Production private-worker canary, cadence, restart and single-owner acceptance receipt
- [`architecture/phase5-final-closure-20261007.md`](./architecture/phase5-final-closure-20261007.md) — final legacy/security/Vercel-retirement closure and remaining irreversible owner action
- [`architecture/ccpun-four-lane-deployment-contract.md`](./architecture/ccpun-four-lane-deployment-contract.md) — machine-enforced four-lane identity/data/indexing contract
- [LINE Ecosystem Activation Contract](./architecture/line-ecosystem-activation-20260918.md) — private LINE media/provider/content-intelligence/privacy activation contract and Human Gates
- [`architecture/platform-data-architecture.md`](./architecture/platform-data-architecture.md) — runtime, environment and data ownership
- [`architecture/repository-architecture.md`](./architecture/repository-architecture.md) — source-file ownership and dependency direction
- [`admin-layer/environment-boundary.md`](./admin-layer/environment-boundary.md) — enforced Admin and Sanity lane controls

Current task state and approval authority do not belong in this index. For provider-placement questions, live read-back and `ccpun-runtime-baseline-20261007.md` outrank dated migration plans and receipts; historical Vercel-era documents must not be used as current runtime authority.

## Admin Control Plane routing

The Admin application is a separate host-scoped control plane. Its canonical owner-facing information architecture is:

- `/login/`
- `/dashboard/` and `/dashboard/inbox/`
- `/content/`, `/content/articles/`, `/content/calendar/`, `/content/research/`
- `/seo/`, `/seo/opportunities/`, `/seo/audits/`, plus keyword, internal-link, competitor and report views
- `/social/`, `/social/posts/`, `/social/calendar/`, `/social/campaigns/`, `/social/queue/`, `/social/accounts/`
- `/analytics/` with website, search, social and conversion views
- `/operations/` with health, deployments, jobs and audit log
- `/settings/` with integrations, access and system views
- `/studio/` as the integrated Sanity destination
- `/api/admin/*` as the canonical Admin API namespace

`lib/admin/routes.ts` owns canonical detection and same-origin return-path validation. `proxy.ts` enforces host and authentication boundaries: the Admin host root resolves to Login or Dashboard, protected deep links return only to validated Admin/Studio paths, unauthenticated APIs return JSON `401`, and unknown Admin-host pages use the branded `404`. Public Production returns `404` for Admin surfaces, Studio and Draft Preview.

## Legacy compatibility boundary

Active `/snt-admin/*` and `/api/snt-admin/*` compatibility is retired in Phase 5 after repository, VPS and n8n caller read-back found no live consumer. No legacy page redirect map or method-preserving API rewrite remains. Legacy strings may remain only in deny/privacy proxy or robots fences and in historical evidence; they are not routable aliases.

## Data and deployment ownership

Routing does not change data ownership. Editorial content remains in the approved Sanity lane; operational audit, review, SEO, Social and scheduler state remains in its existing guarded operational store; provider credentials remain environment-owned and are never returned to clients. SEO, Social and Operations pages expose only current sources available to their existing services and show explicit unavailable, disconnected, stale or partial states instead of inventing data.

Admin deployment is Git-traceable: build and Preview use one reviewed branch commit, Production follows a reviewed merge to `v4-production`, and provider read-back must match the exact promoted commit SHA. Roll back by restoring the previous application deployment or reverting the exact release change; the retired `/snt-admin/*` compatibility adapter must not be resurrected as part of rollback. Never restore a stale database snapshot, truncate operational queues, delete audit history or replay a publisher as part of an application rollback; durable jobs require separate reconciliation or cancellation.

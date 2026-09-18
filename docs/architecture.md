# Architecture Index

- [LINE Ecosystem Activation Contract](./architecture/line-ecosystem-activation-20260918.md) — private LINE media/provider/content-intelligence/privacy activation contract and Human Gates
- [`architecture/platform-data-architecture.md`](./architecture/platform-data-architecture.md) — runtime, environment and data ownership
- [`architecture/repository-architecture.md`](./architecture/repository-architecture.md) — source-file ownership and dependency direction
- [`admin-layer/environment-boundary.md`](./admin-layer/environment-boundary.md) — enforced Admin and Sanity lane controls

Current task state and approval authority do not belong in this index.

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

`lib/admin/routes.ts` owns canonical detection, same-origin return-path validation and the explicit legacy page map. `proxy.ts` enforces host and authentication boundaries: the Admin host root resolves to Login or Dashboard, protected deep links return only to validated Admin/Studio paths, unauthenticated APIs return JSON `401`, and unknown Admin-host pages use the branded `404`. Public Production returns `404` for canonical or legacy Admin surfaces, Studio and Draft Preview.

## Legacy compatibility boundary

Legacy page GETs under `/snt-admin/*` may temporarily redirect through the explicit route map. State-changing requests and provider callbacks under `/api/snt-admin/*` must never use an HTTP redirect: `next.config.ts` contains one method/body-preserving `beforeFiles` rewrite to the same `/api/admin/*` route handler. New navigation, auth redirects, internal fetchers, tests and jobs use canonical routes. Compatibility can be removed only after provider callback configuration, scheduled jobs, delayed retries and monitoring have been verified against canonical URLs. Historical docs, logs and audit values retain their original strings.

## Data and deployment ownership

Routing does not change data ownership. Editorial content remains in the approved Sanity lane; operational audit, review, SEO, Social and scheduler state remains in its existing guarded operational store; provider credentials remain environment-owned and are never returned to clients. SEO, Social and Operations pages expose only current sources available to their existing services and show explicit unavailable, disconnected, stale or partial states instead of inventing data.

Admin deployment is Git-traceable: build and Preview use one reviewed branch commit, Production follows a reviewed merge to `v4-production`, and provider read-back must match the exact commit SHA. Roll back by restoring the previous application deployment or reverting the exact route-migration merge while keeping the API compatibility adapter until dependent callbacks/jobs are verified. Never restore a stale database snapshot, truncate operational queues, delete audit history or replay a publisher as part of an application rollback; durable jobs require separate reconciliation or cancellation.

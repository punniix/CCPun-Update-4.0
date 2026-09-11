# Article scheduling on Sanity Free

Status: implementation on `feature/free-plan-article-scheduling-20260911`; activation is not implied by a passing build. No Production article has been selected for a scheduling test. This feature does not upgrade a subscription.

## Ownership and safety

Sanity remains the editorial source of truth. Schedule state and immutable transition audits live only in private Neon tables `ccpun_admin.article_scheduler_identity`, `ccpun_admin.article_schedule`, and `ccpun_admin.article_schedule_audit`. The unpopulated prototype Sanity `publishSchedule` schema was removed after authenticated raw queries returned zero matching documents in both active datasets on 2026-09-11. Keep the legacy operational type in the anonymous privacy probe and Studio deny-list defensively.

The existing generic Admin operations migration and its UAT-only runtime remain unchanged. The scheduler has its own checksum-locked additive migration. It must never borrow `CCPUN_SOCIAL_DATABASE_URL`, an owner connection, or `DATABASE_URL`.

| Lane | Neon project / branch / endpoint | Sanity | Behavior |
| --- | --- | --- | --- |
| UAT | `young-term-47483330` / `br-crimson-mouse-az7ajkv8` / `ep-mute-frost-aztvz394` | `ccb9lnw5/uat` | Validate only; never publish |
| Production | `lively-bar-43618798` / `br-long-resonance-b3ys5xrv` / `ep-broad-butterfly-b3ro7u8w` | `kyfxgjnq/production` | Publish only after explicit activation and owner confirmation |

Production identity was verified read-only against the existing `ccpun_social.system_identity`; it is not the UAT project whose branch is also named `main`.

## Runtime prerequisites

Use only `ccpun_admin_runtime` through `CCPUN_ADMIN_DATABASE_URL`. The migration preserves an existing restricted role. A missing role is created **NOLOGIN**, without a password or superuser/role-creation/bypass privileges. Enabling LOGIN and supplying a new password must use the operator's secure credential channel; never put a connection string in a PR, workflow file, log, SQL artifact, URL, or chat message.

Set the matching `CCPUN_NEON_PROJECT_ID`, `CCPUN_NEON_BRANCH_ID`, `CCPUN_NEON_DATABASE=neondb`, and the exact Sanity environment variables. Production additionally requires the immutable Admin Vercel project, `CCPUN_APP_ENV=production-admin`, `VERCEL_ENV=production`, and `VERCEL_GIT_COMMIT_REF=v4-production`. UAT runs in `admin-uat` Preview or `local-uat`, not the public Web project. Existing Google owner authentication remains mandatory.

Both `CCPUN_ARTICLE_SCHEDULING_ENABLED=1` and the database identity row's `enabled=true` are required to create/execute schedules. Migrations initialize `enabled=false` and never silently enable or reset it. Read/cancel remain available while activation is off. Do not enable either real lane until its secure connection, migration readback, owner UI, and workflow delivery are verified. Vercel Workflow usage is subject to the account's limits/billing; no unlimited-free guarantee is made.

## Deployment and acceptance

1. Keep `v4-production` unchanged until PR CI, Vercel Preview and human review are complete. Never include CI/FHC UX changes in this release.
2. Generate migration SQL from `db/migrations/20260911_article_scheduling_v1.ts` using Node 24. `buildArticleSchedulerMigration('uat'|'production')` pins the existing control-plane identity and rejects untracked tables/checksum drift. The checked-in DDL string is immutable after rollout; edits require a new migration version.
3. Run the exact SQL against the correct lane, read back the identity/checksum, role, empty queue, and least-privilege grants. This installs infrastructure only; it does not create or publish article content.
4. Verify `npm run check:foundation`, the anonymous Sanity privacy probe, `npm run build`, and the Postgres CI job. The additional mounted React tests cover confirmation, duplicate clicks, rescheduling, and cancellation after a Draft disappears. Disposable Postgres tests never target a Neon URL.
5. In authenticated UAT Preview, use an approved test Draft to exercise a future schedule, reschedule, cancellation, and Draft revision change. The successful UAT terminal state is `validated`, **not** `published`. Confirm no article content was mutated.
6. Only after human review, merge and confirm the exact Production deployment SHA. Supply dedicated Production credentials securely, verify readback, then explicitly activate. A Production end-to-end publication test requires a separately chosen article/time and owner approval. No such test is implicit in this implementation task.

`withWorkflow(nextConfig)` is required for compilation. The framework's signed `/.well-known/workflow/*` transport is excluded only from broad proxy matching; `/api/snt-admin/*`, `/studio/*`, Google sessions and exact browser-origin checks stay protected. Internal routes are noindex/no-store. No Vercel cron or scheduled GitHub workflow is introduced.

## Publication state machine

A schedule confirms an exact logical article ID, Draft revision, published-base revision (including the absence of a published version), Bangkok time, current generation and row version. Dates are converted explicitly to UTC and rejected on calendar rollover. The first release accepts 30 seconds to 90 days ahead.

`preparing` is not executable. A successful Workflow enqueue is acknowledged with its run ID before state becomes `scheduled`. Each mutation and its audit commit together. New confirmations use new request UUIDs; retries of the same UUID cannot dispatch a second workflow. Concurrent new schedules or stale-tab changes fail compare-and-swap.

The workflow sleeps until an **absolute UTC timestamp**, so delayed dispatch does not shift the intended time. A late job rechecks publication guards rather than reapplying the future-time creation rule. At wake, one CAS claim changes the row to `executing` with a two-minute lease. Cancellation/rescheduling can win before this claim; after it, they return a conflict rather than falsely reporting successful cancellation. There is no automatic lease reclamation.

The worker revalidates owner authorization, both article revisions, unchanged protected URL/indexing controls, essential content, references and the existing `articlePublishBlock`. It checks the durable kill switch and remaining lease immediately before mutation. UAT stops at validation. Production uses the existing atomic `publishApprovedArticle` transaction; existing content, references and original `publishedAt` semantics are preserved.

`published` requires a confirmed Sanity transaction receipt. A missing Draft plus an existing published article is **not** proof that this job succeeded. Uncertain network/commit/checkpoint results become `reconciliation-required` or remain an expired executing lease displayed as requiring review. Workflow mutation steps have no automatic retries.

## Stop, recover, roll back

To stop pending jobs, an authorized operator disables `ccpun_admin.article_scheduler_identity.enabled` on the exact lane. This database switch also covers workflows pinned to older deployments; changing an environment variable alone does not. A switch cannot recall an external request already in flight.

For `preparing`, refresh state and cancel the exact current generation/version before creating a new confirmation. For `stale`, re-review the current Draft and confirm a new schedule. For expired `executing` or `reconciliation-required`, do not blindly replay or reset to scheduled. Compare the stored generation/revisions, immutable audit, Workflow run, Sanity transaction evidence, current Draft and published document. Record a reviewed outcome using the authorized operator channel before any further publication. The owner UI intentionally does not allow overriding this safety gate.

Reverting code does not cancel durable workflows. Disable the database switch first, inspect/cancel pending jobs, and reconcile executing jobs. Preserve queue/audit data; do not drop or truncate tables as a rollback shortcut. Failed/overdue delivery is inspected through the schedule UI and Vercel Workflow observations; external email/LINE failure notifications are not part of this release.

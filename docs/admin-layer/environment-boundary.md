# CCPun Admin & Intelligence Layer — Environment Boundary

> **Current authority — 2026-08-27:** the two survivor Projects are `ccpun-web-v4-prod` and `ccpun-admin-prod`, later renamed `ccpun-web` and `ccpun-admin`. `ccpun-web-v4-uat`, `ccpun-admin-nonprod`, `ccpun-web-v4-1-uat`, and `ccpun-web-lab` are `LEGACY-FROZEN`. Any older instruction below that sends new work to Lab/UAT is historical evidence and must not be executed.

Date: 2026-08-22
Status: Active architecture decision

## Core Decision

Separate the public website runtime from the private editorial/Admin working surface.

### Public Production Website

Vercel project:
- `ccpun-web-v4-prod`

Public domains:
- `ccpun.com`
- `www.ccpun.com`

Sanity dataset:
- `production`

Behavior:
- public website reads only Published content
- no public Sanity Studio
- no public editorial Admin surface
- Draft/Preview/Admin tooling is not exposed as normal public website functionality

### Private Production Editorial/Admin Tool

Purpose:
- real CCPun content operations
- create Drafts
- edit Drafts
- SEO metadata work
- review proposals
- preview real content
- human approval
- human Publish

Sanity dataset:
- `production`

Target Vercel project:
- `ccpun-admin-prod` (`prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN`) — Admin survivor; later renamed `ccpun-admin`

Target owner entry:
- `https://admin.ccpun.com/` → `/snt-admin/`
- `https://admin.ccpun.com/studio/` for private Draft Preview and Human Publish

Access rule:
- private/protected working surface only
- one verified Google/Auth.js login, followed by server-side RBAC and policy checks
- no public indexing
- not a customer-facing route or public CMS
- separate Vercel project, credentials and deployment from `ccpun-web-v4-prod`
- public website routes are not exposed as an unauthenticated second website on the Admin host

Production workflow:
`Draft -> Review -> Preview -> Human approval -> Human Publish`

### Non-Production Feature Development

Use for developing and validating backend/Admin features.

Surfaces:
- Admin feature/UAT Preview — branch-specific deployment inside `ccpun-admin-prod`
- Public Web feature/UAT Preview — branch-specific deployment inside `ccpun-web-v4-prod`
- Legacy Projects — read-only rollback/parity evidence only

Sanity dataset:
- `uat`

Allowed:
- schema experiments
- Admin UI development
- SEO engine development
- research provider integration
- review workflow development
- AI proposal testing
- test Draft mutations in `uat`
- synthetic/test content

Not allowed:
- publish real CCPun production articles
- mutate `production` dataset
- production canonical/redirect/noindex changes
- production DNS/config/deploy

Promotion flow:
`Feature Preview -> protected survivor UAT -> reviewed merge -> Production`

The public Production website consumes only the Published result from the `production` dataset.

## Human / AI Permission Boundary

AI may:
- research
- analyze
- audit
- summarize
- generate proposals
- generate Draft content

AI may not:
- approve itself
- publish
- delete content
- change canonical
- change redirects
- change noindex
- change production configuration
- deploy production
- change DNS

## Sanity Dataset Mapping

| Runtime / Surface | Dataset | Purpose |
|---|---|---|
| Local Mac `npm run local:uat` at `localhost:3100` | `ccb9lnw5/uat` | Full synthetic Draft/SEO/review/preview workflow isolated from Local Production |
| Local Mac `CCPun Admin.app` | `kyfxgjnq/production` | Owner-authenticated Draft work on loopback only; CORS exists only while the local runtime is active |
| Admin survivor branch Preview | `ccb9lnw5/uat` plus UAT Neon `ccpun_admin` | Protected Admin feature/UAT lane with Production writes disabled |
| `admin.ccpun.com` / `ccpun-admin-prod` | `kyfxgjnq/production` | Real Draft → Review → Preview → Human Publish workflow |
| `ccpun-web-v4-prod` public website | `production` Published perspective only | Public website rendering |

The `uat` dataset is private and uses test/seed content. The current Sanity plan does not include advanced native dataset-copy management, so production is not automatically cloned into UAT.

## Production Content Completeness Contract

The private Production Admin reads the existing Sanity `production` dataset directly. It does not copy Published/Draft articles into another CMS and it never imports UAT seed documents into Production.

Before enabling editing, a read-only reconciliation must group raw Article documents by normalized base ID and prove that each logical article appears once in one of these states:

- `Published` — published document exists and no Draft overlay exists
- `Published + Draft changes` — both the published document and `drafts.<id>` exist
- `Draft only` — only `drafts.<id>` exists

The reconciliation must use the complete paginated result set and report orphan Drafts, duplicate slugs, broken category/author/image references and count mismatches. It must not repair, rewrite, publish or delete during inventory.

Owner editing uses the exact existing Sanity document identity. An `แก้ไขบทความ` action opens the private Studio document; changes to an already Published article are saved as its Draft overlay so the public Published document remains unchanged until Human Publish. Full content editing remains in Sanity Studio; the Control Plane remains the operating/review layer rather than a second unrestricted CMS.

Current routing authority: `admin.ccpun.com` edits the exact logical Article through Sanity Edit Intent in `kyfxgjnq/production`; the owner never chooses a project or dataset. Website 4.2/Admin Preview remains isolated in `ccb9lnw5/uat`, and neither lane may fall back to or discover the other.

## Current Enforced Code Boundary

One shared invariant now governs Admin clients, public Sanity reads, Sanity Live, CLI and Studio:

| Application lane | Allowed dataset | Admin capability |
|---|---|---|
| `local-uat` | `ccb9lnw5/uat` only | Local test Draft operations; exact `localhost:3100` host only, bound to loopback `127.0.0.1` |
| `local-production` | `kyfxgjnq/production` only | Owner-authenticated Production Draft operations on loopback; Publish/Delete remain human-gated or hard denied as defined by policy |
| `development` | `ccb9lnw5/uat` only | Local/CI development only; any Vercel Project identity fails closed |
| `admin-uat` | `ccb9lnw5/uat` only | Protected branch Preview inside the Admin survivor; Production writes disabled |
| `lab`, `uat` | none | Legacy labels retained only for an explicit fail-closed response |
| `production-admin` | `production` only | Whitelisted real Draft operations; Control Plane publish/delete remain denied |
| public `production` | `production` Published perspective only | Admin and Studio unavailable |
| missing, unknown or mismatch | none | Fail closed |

Changing only `NEXT_PUBLIC_SANITY_DATASET`, project ID or `CCPUN_APP_ENV` is not enough to cross lanes. `local-uat` accepts only the exact Non-Production project/dataset and host `localhost:3100`, while `local-production` accepts only `localhost:3000`; both servers listen only on loopback `127.0.0.1`. They use separate Auth.js cookie namespaces and separate Next.js build directories so they can run concurrently without sharing browser or compiler state. A request using the other lane's Host/port returns `404`. `admin-uat` and `production-admin` require the immutable Admin survivor Project ID; Production Admin also requires `CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID` to match it. An absent or blank `CCPUN_APP_ENV` resolves to `admin-uat` only when Vercel itself supplies both `VERCEL_ENV=preview` and that immutable Admin Project ID. An explicit recognized or unrecognized `CCPUN_APP_ENV` remains authoritative, and the public Web or an unknown Project ID never inherits Admin. Missing or mismatched identity disables Admin clients, Draft mutations and Studio. Public `production` returns 404 for `/snt-admin`, Admin APIs, `/studio` and Draft Preview routes.

Operational Admin reads/writes additionally require the server-only `CCPUN_ADMIN_DATABASE_URL` with username `ccpun_admin_runtime` and the exact UAT compute `ep-mute-frost-aztvz394` (direct or pooled hostname only). Missing or malformed configuration fails closed and is never replaced with `CCPUN_SOCIAL_DATABASE_URL`, an owner/backfill URL, a Sanity token, or a Production credential. Every operation verifies `current_database()`, `current_user`, `ccpun_admin.system_identity` and the exact migration checksum before its business query. Only `admin-uat` and `local-uat` may pass this boundary.

The migration creates `ccpun_admin_runtime` as `NOLOGIN`; therefore the first apply does **not** make the runtime connection usable. A safe rerun preserves an existing `LOGIN` state and password while reasserting every non-login restriction. After migration and read-back pass, a human Neon owner must enable `LOGIN` and set a newly generated password for this exact UAT role only, then construct `CCPUN_ADMIN_DATABASE_URL` from that credential. The password is entered directly in Neon/Postgres and the Vercel `ccpun-admin` Preview environment; it must never be committed, pasted into logs, reused for `CCPUN_ADMIN_BACKFILL_DATABASE_URL`, or scoped to Production. Keep the role `NOLOGIN` until this manual credential step is explicitly performed.

UAT migration/backfill requires the exact identity variables `CCPUN_NEON_PROJECT_ID=young-term-47483330`, `CCPUN_NEON_BRANCH_ID=br-crimson-mouse-az7ajkv8`, `CCPUN_NEON_DATABASE=neondb`, `CCPUN_APP_ENV=local-uat` and a separately supplied `CCPUN_ADMIN_BACKFILL_DATABASE_URL` using `neondb_owner` or `cloud_admin`. The script defaults to dry-run; `--apply` always requires the recorded `43/2/19` cutover baseline and aborts on identity, checksum, count, source-hash or deterministic lineage-digest mismatch.

Local UAT remains the feature-development lane. The separately approved `local-production` Draft lane starts through the single `CCPun Admin.app`, binds Next.js to `127.0.0.1`, serves only `localhost:3000`, requires Google/Auth.js plus the owner allowlist and pins Sanity to `kyfxgjnq/production`. The app adds only `http://localhost:3000` as a credentials-enabled Sanity CORS origin, verifies it before starting, records the owned process and removes the origin through `ปิดระบบ` or `ออกและปิดระบบ`. An occupied port, unverifiable CORS or non-loopback listener fails closed. Public Production, Vercel and DNS remain untouched.

### Historical A2 runtime safety stop

This section records the earlier A2 stop and is not current deployment authority. At that time, `ccpun-admin-prod` was paused because the short Production alias was otherwise publicly reachable. Current runtime status must be taken from the live Vercel inventory and the current authority banner above.

This is intentionally **not** an accepted Production Admin runtime. The A2 xhigh review selected a single Google/Auth.js login plus application and data-plane controls instead of duplicating Vercel/Cloudflare identity prompts. The project stays paused until the Vercel workspace is moved from Hobby to a commercial plan and A3 credentials/RBAC are explicitly approved and verified. The public `ccpun-web-v4-prod`, its domains and Sanity Production content remain untouched.

### Historical A2 xhigh perimeter decision

The Production Admin does not require Vercel `All Deployments` or Cloudflare Access in its first owner-only release. Both would add another identity prompt; Vercel also prices private Production deployments as an Advanced Deployment Protection feature, while Cloudflare requires a new DNS/JWT-validation operating surface.

Instead, the known Admin hosts, generated `ccpun-admin*.vercel.app` aliases and exact `localhost` development host enter the project/environment boundary across all application paths; root enters the boundary on every host. Only the immutable Admin Project ID may make a generated Preview an Admin lane; Web and unknown projects retain their own lane and Admin surfaces fail closed. Dedicated local Admin lanes still require their exact configured port after host matching. The only pre-login Admin paths are the Auth.js endpoints, login page bootstrap, `robots.txt` and required framework assets. All other unauthenticated Admin pages redirect to the CCPun login and unauthenticated APIs return `401`; public or unknown paths on a dedicated Admin lane use the branded `404`. The request origin must exactly equal `AUTH_URL`; a mismatch returns `404`. Public `ccpun.com` remains outside this host-scoped perimeter, while generated deployment URLs keep Vercel Standard Protection.

This remains defense-in-depth without duplicate login screens:

1. Google/Auth.js verifies an allowlisted human once; Production accounts must use Google 2-Step Verification.
2. Server RBAC and hard-deny policy authorize each operation independently of the page guard.
3. Exact Vercel Project ID, application lane and Sanity project/dataset binding fail closed.
4. Least-privilege Sanity credentials, revision checks, atomic audit records and Human Publish contain the remaining blast radius.

The A2 read-back recorded a `Hobby` workspace and made no plan purchase. Treat plan status as historical until it is re-read live; it is not a current blocker assertion in this file.

The A0 register and approved remediation are recorded in [`a0-production-content-inventory.md`](./a0-production-content-inventory.md). After a verified full backup and revision-guarded transaction, the three UAT-only Draft documents are absent. The final count is 39 logical Articles, duplicate slug groups are zero and the A0 acceptance gate passes. Draft-only supporting references and missing featured images remain explicit per-Article publish checks.

Studio and Draft Preview routes use the same Auth.js allowlist as the Control Plane. Studio additionally requires the current owner-level `draft:apply` permission. Local Production permits native Article creation/editing, Human Publish, Unpublish and scheduled Drafts for the authenticated owner only. Permanent Delete is hidden while a Published version exists, so a live Article must be Unpublished before its remaining Draft can be deleted. UAT keeps these actions disabled; the future Cloud Production Admin retains its narrower action set until a separate promotion review. This action filter is defense-in-depth, not a substitute for least-privilege Sanity membership and recoverable backups.

The audit authority is intentionally split: Neon `ccpun_admin.audit_log` records Control Plane mutations with request IDs, while direct Studio Draft edits and Human Publish rely on Sanity History. Before Production Admin, verify Sanity History retention and least-privilege access, document administrator-email retention, and give the owner an explicit path to both histories. Do not claim the Control Plane log alone covers Studio actions.

## Website 4.1 Owner-only release contract

The first Website 4.1 Production release is intentionally smaller than the complete 4.1 product backlog. It may promote the verified Owner-only Control Plane, Auth.js boundary, deterministic SEO audit, Research Snapshot reads, human Review Queue and Draft-only Apply workflow. Multi-user runtime identities, AI workload identity, Redirect Manager, bulk SEO, advanced Growth metrics and live cloud provider refresh remain later milestones.

Release evidence for candidate `0a60ba6656cf68516c431994281c349b66dc735c` on 2026-08-27:

- Foundation, Vercel, analytics and Admin contracts pass; Admin tests are `154/154` and the production dependency audit reports zero vulnerabilities.
- Web and Admin survivor Previews are READY while the Production baseline remains `v4-production@ffdd20c75767ed3fe5fa66a0bcab122f09ed61a2`.
- The Owner Auth.js session endpoint returned authenticated status with an eight-hour remaining lifetime; the authenticated session token was not visible to browser JavaScript.
- Two UAT-only Draft proposals were created for release QA. Concurrent Edit accepted one request and rejected the stale contender with `409`; Reject returned the terminal `rejected` state. `/snt-admin/audit/` showed both `seo-suggestion:edit` and `seo-suggestion:reject`.
- Public Web Preview returned `404` plus `noindex` for `/snt-admin/`, `/studio/` and the Admin session API. Homepage title, H1 and canonical matched current Production.
- GSC, GA4 and Vercel Growth sources reported `not-connected`; no fake metric or automatic Production provider fallback was used. Ubersuggest live OAuth/query remains local-only.

### Retention and rollback

- Control Plane audit and review rows in Neon have no automatic deletion. Keep them and the legacy Sanity rollback copies until the COO approves a later retention policy; do not add a purge job merely to complete this release.
- Sanity History remains the authority for direct Studio Draft edits and Human Publish. Human Publish is a separate explicit COO action and is not authorized by a code release.
- Record the release commit and both survivor deployment IDs before promotion. Code rollback returns both survivor Projects to the previous verified Production commit; for this candidate the baseline is `ffdd20c75767ed3fe5fa66a0bcab122f09ed61a2`.
- Data rollback uses the affected Draft revision in Sanity History. Never overwrite or republish a Published document automatically. Credential exposure requires provider revocation/rotation before local cleanup.
- If authentication, project/dataset identity or Draft-only isolation fails after promotion, stop the Admin release and restore the previous verified deployment. Domain, environment, credential and Production mutations still require an exact COO approval.

The candidate can move from Draft PR to final release approval after the documentation and Preview evidence are attached. This contract does not authorize merge, Production deployment, Sanity Publish, domain movement or provider activation.

### A1 threat controls

| Failure mode | Enforced control |
|---|---|
| Dataset changed to `production` in Lab/UAT | Lane/dataset mismatch fails closed |
| Public Production relabeled as `production-admin` | Current Vercel Project ID must also match the dedicated configured Admin Project ID |
| Missing Vercel system identity | Production Admin data plane and Studio stay disabled |
| Public user probes private routes | Public `production` returns 404 before Admin routing |
| AI/system attempts approval, Apply, Publish or Delete | Policy hard deny; whitelisted Draft mutation remains human-only |
| Proposal or target changes after review | Frozen approval fields, Neon row-version claim and exact Sanity revision/value checks reject stale work |
| Cross-store result is ambiguous | Suggestion becomes `reconciliation-required`; automatic replay is forbidden |
| Control Plane mutation succeeds without trace | Server request ID and sanitized Neon audit are finalized with the operational row |
| Human publishes in Studio | Separate Sanity-authenticated Human Publish action; Sanity History is the audit source |

## Sanity Project Isolation

The approved project split is active:

| Sanity project | Dataset | Allowed consumers |
|---|---|---|
| `kyfxgjnq` — Production | `production` | Web survivor Published reads and the private Admin survivor workflow only |
| `ccb9lnw5` — Non-Production | `uat` | Admin survivor branch Preview and approved local UAT only |

The legacy Lab/UAT Projects are no longer allowed consumers even if old variable rows remain. Admin survivor Preview and approved local UAT use the Non-Production trust domain and must never reuse Production credentials. The UAT export was copied into `ccb9lnw5/uat`; the old `kyfxgjnq/uat` dataset remains temporarily as rollback evidence and is not an allowed runtime target. Do not add automatic Production fallback or automatic dataset copying.

## Local-First Provider Promotion Gates

Ubersuggest, deterministic SEO/GEO and the Growth Dashboard may proceed through the Local Mac-first architecture without Vercel Pro or `admin.ccpun.com`, but only after these safety gates:

1. Local UAT foundation and authenticated workflow QA pass.
2. The same commit passes the protected branch Preview inside the Admin survivor with Sanity `uat`.
3. The `local-production → kyfxgjnq/production` invariant and public-Production deny path have focused tests.
4. The Local Production lane binds only to loopback, exact Google/Auth.js owner identity and `kyfxgjnq/production`; public Production and mismatched hosts fail closed.
5. U1 runs first against `ccb9lnw5/uat` with provider scope, quota, validation, freshness, idempotency and atomic audit evidence.
6. U2 may write normalized research/audit snapshots to `kyfxgjnq/production` only through a separately approved least-privilege persistence boundary; it never reuses UAT credentials or enables Publish.
7. GEO and dashboard reads use the accepted Local connector boundaries and remain human-reviewed.
8. The owner performs any real Publish separately after Preview and final adversarial security acceptance.

## Historical Deferred Cloud Promotion

This section records the former A2–A7 plan. It does not override the active survivor topology or authorize a paid plan, DNS/domain change, Production credentials, Production Draft mutation or publication. Any remaining external step still requires explicit approval and live read-back.

## Important Rules

1. A feature is never developed directly against the `production` dataset.
2. Production editorial tooling is private and never treated as a public CMS surface.
3. The public `ccpun.com` runtime reads Published content only.
4. Draft/Preview/Admin access remains authenticated and noindex.
5. Human publishing remains a separate approval action even after an Admin feature has been promoted from UAT.
6. Every Production Published/Draft Article must be reconciled and visible before owner handoff; UAT documents must never appear in the Production Admin.

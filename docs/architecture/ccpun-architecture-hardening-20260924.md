# CCPun Architecture Hardening — 2026-09-24

Status: Draft PR #242, pending owner review
Branch: `hardening/architecture-boundaries-20260924`
Base: `v4-production` @ `1ba9063bc6a692ca6f9c820439a417cf3ebfeb71` after PR #241

## Objective

Harden existing Web / Admin / Sanity / Neon / Auth / Local-AI boundaries so CCPun can keep shipping features faster without creating cross-feature blast radius.

This is not a redesign. No new infrastructure, data plane, URL model, calculator behavior or Production mutation is authorized by this workstream.

## Working rules

1. Audit before mutation.
2. Fix at the owning boundary, not page-by-page.
3. Preserve fail-closed environment/security guards.
4. Do not create a second source of truth.
5. Optional sidecars must not make core content disappear.
6. A transient dependency failure should be isolated where correctness permits it.
7. Production deploy, Production DB mutation, Sanity publish/unpublish and credential changes remain approval-gated.
8. Completion status must distinguish implemented, ready for deploy, and deployed/verified.

# Work split

## High

Use High for changes whose owner/boundary is already proven and whose safe behavior can be captured by deterministic tests.

### H1 — Legacy Draft normalization

Audit evidence:

- Production Sanity currently has one Draft Article without an author reference: `tisa-guide`.
- UAT contains legacy Draft fixtures without authors.
- Vercel Admin runtime logged `listArticles:record-skipped` with `authorName invalid_type`.
- Published content remains required to have an author.

Decision:

- tolerate missing/null author only at the raw Sanity adapter boundary;
- preserve Published author as a hard invariant;
- do not patch Production content merely to satisfy the parser;
- do not invent a persisted author value.

Implementation on this branch:

- `baseArticleSchema.authorName` accepts null/missing legacy Draft data;
- article normalization emits an empty presentation value only for Draft compatibility;
- Published Article normalization throws when author is absent;
- regression tests lock both sides of the contract.

### H2 — LINE metadata isolation

Audit result: already fixed in Production baseline; no new patch needed.

Evidence already in `v4-production`:

- `lineTitle` / `lineDescription` use tolerant sidecar parsing;
- invalid LINE-only copy becomes undefined rather than dropping the Article;
- regression test exists in `tests/admin/public-article-line-copy-tolerance.test.ts`;
- the old `lineDescription too_big` error appears in the 7-day window but not the latest 24-hour window.

Decision: preserve existing contract; do not duplicate the fix.

### H3 — Portable Text legacy null normalization

Audit result: already fixed in Production baseline; no new patch needed.

Evidence:

- `lib/admin/seo-audit.ts` normalizes legacy null `markDefs`;
- regression coverage exists in `tests/admin/seo-audit-portable-text-regression.test.ts`;
- the historical Zod error exists in the 7-day log window but not the latest 24-hour window.

Decision: preserve and regression-test; no content mutation.

### H4 — Local-AI build routing

Audit evidence:

- `workers/local-ai/` is not a Public Web runtime owner.
- Existing runtime-boundary scanner did not scan `workers/`, so a future accidental Web import would not be part of that graph.
- `scripts/vercel-ignore-build.mjs` did not classify `workers/local-ai/`, so worker-only Production changes could trigger unnecessary Web builds.

Decision:

- add `workers` to the runtime dependency scan;
- explicitly forbid Public Web reachability into `workers/local-ai/`;
- classify `workers/local-ai/` as a dedicated worker-only build class.
- worker-only diffs skip both Vercel Web and Admin because the runtime owner is the Hostinger VPS, while any shared/app/lockfile change remains conservative and rebuilds the affected Vercel survivor(s).

Implementation on this branch:

- `scripts/check-app-runtime-boundaries.mjs` scans `workers/` and fails if Web reaches Local-AI worker code;
- `scripts/vercel-ignore-build.mjs` treats `workers/local-ai/` as worker-only and skips both Vercel applications for worker-only diffs;
- `tests/vercel-build-routing.test.mjs` covers the worker path.

# Extra High

Use Extra High where a wrong fix could weaken authentication, create a second source of truth, or change public availability semantics.

## XH1 — Auth.js PKCE

Current evidence:

- package: `next-auth 5.0.0-beta.32` (exact pin);
- current auth uses Google OAuth, JWT sessions, strong secret guard, explicit secure `AUTH_URL`, dedicated Production/UAT cookie namespaces and PKCE/state/nonce cookie names;
- Auth.js beta.32 includes the current patch for the 2026 OAuth check-cookie advisory;
- Auth.js supports overriding only cookie names while missing cookie options inherit its defaults;
- Production proxy accepts Auth.js traffic only on the configured Production origin; generated Vercel aliases enter the Admin boundary but do not satisfy the Production configured-origin gate;
- Vercel logged two `InvalidCheck: pkceCodeVerifier value could not be parsed` events, last seen 2026-09-22.

Conclusion:

There is not enough evidence to justify changing PKCE, SameSite, Secure, `trustHost`, cookie scope or OAuth provider checks.

Do NOT:

- disable PKCE;
- change SameSite to `none` as a guess;
- weaken Secure cookies;
- accept arbitrary generated aliases as Production auth origins;
- rotate credentials merely to test.

Next diagnostic should establish the exact request host / callback origin / cookie namespace on a reproduced failure before mutation.

## XH2 — Category Registry public availability

Current evidence:

- public runtime still logs `[sanity-category-registry] request-failed`;
- `listCategoryRegistry()` already isolates malformed category rows and returns an unavailable registry on upstream request failure;
- Blog root degrades to no category menu rather than inventing categories;
- physical `/blog/[category]` intentionally refuses to resolve routing when registry availability is unknown and currently throws `Category registry unavailable`.

Architecture constraint:

Sanity Category Registry is the physical category Source of Truth. A static code fallback containing duplicate category rows would violate ownership.

Do NOT:

- copy category records into code as an availability fallback;
- fall back to another Sanity project/dataset;
- turn an unknown category state into a guessed redirect/canonical.

Candidate hardening paths for Codex to evaluate in order:

1. same-project/same-dataset published CDN fallback only after the primary Sanity API request fails;
2. bounded retry for transport/5xx/429 failures only;
3. if neither preserves the fresh-content contract safely, retain fail-closed route ownership and improve explicit degraded handling/observability instead of inventing data.

Acceptance:

- no Production/UAT cross-lane fallback;
- no duplicate category registry;
- no canonical/redirect guess;
- valid rows remain isolated from malformed rows;
- public Article list remains available when category menu/featured sidecars fail where route ownership is not required.

## XH3 — Featured settings

Read-only Sanity audit shows no `blogSettings` document in Production or UAT. Missing settings is therefore a valid state.

`listBlogFeaturedArticleIds()` already returns an empty/nullable sidecar behavior. The observed error group means the Sanity request itself failed, not that the document was absent.

Treat this as the same upstream-availability problem as XH2. Do not create a settings document only to silence runtime logs.

## XH4 — Sanity remote schema registry

Read-only remote registry result:

- `kyfxgjnq/production`: no deployed schema.
- `ccb9lnw5/uat`: no deployed schema.

Repository has a real local Studio source in `sanity.config.ts` and `cms/sanity/schema/`.

Decision for this hardening round: no remote schema deployment.

Reason:

- not a Production outage;
- local source remains authoritative;
- Sanity guidance for a repo with local Studio source is to manage/deploy schema from that source, not create an MCP-managed parallel schema;
- adding registry sync is lower priority than runtime correctness.

A future explicit tooling task may evaluate `sanity schema deploy`/drift checks, but it must not create a second schema owner.

# Runtime evidence

Latest checked Vercel windows:

## Public Web

Grouped runtime-error history included Category Registry / Featured failures from Preview deployments. A scoped check of the current Production Web deployment found no matching Category Registry or Featured errors in the latest 24-hour window.

The hardening branch therefore treats the bounded retry as preventive resilience, not evidence of an active Production outage.

Historical but not in latest 24-hour Production evidence:
- LINE description validation dropping an Article.

## Admin

Latest:
- Draft Article skipped because `authorName` was missing.

Historical:
- Portable Text `markDefs:null` Zod error.
- two PKCE InvalidCheck events.

# Rollback

All branch changes are code/test-only.

Rollback is a normal Git revert of this hardening PR.

No Production content, DB schema, credentials, OAuth provider settings or Vercel Production configuration are changed by this branch.

# Status vocabulary

- **implemented and verified locally/CI**: code and deterministic checks pass on branch.
- **ready for owner approval**: CI + relevant Vercel Preview pass; merge and Production deployment remain gated.
- **deployed and verified in Production**: only after an explicitly approved merge/deploy plus post-deploy evidence.

Do not collapse these states.


# High / Extra High work completed in Chat

## H5 — Same-lane Sanity sidecar resilience

Implemented:

- added a bounded transient-read retry helper;
- default is two total attempts (one retry);
- retries only network-style failures, 408, 425, 429 and 5xx;
- 4xx auth/config/validation failures are not retried;
- Category Registry and global Featured settings use the helper;
- retry reuses the exact same configured Sanity project, dataset, perspective and query;
- there is no Production/UAT fallback and no static duplicate Category Registry.

Current Production evidence:

- the current Public Web Production deployment had no Category Registry / Featured error log matches in the latest 24-hour scoped check;
- earlier grouped errors were associated with Preview deployments, so this resilience patch is preventative/narrow rather than evidence of a current Production outage.

## XH1 — Auth.js PKCE hardening without security downgrade

Implemented:

- NextAuth remains on the existing v5 architecture;
- exact installed versions confirmed: next-auth 5.0.0-beta.32 and @auth/core 0.41.3;
- next-auth is pinned exactly to 5.0.0-beta.32 in package.json and package-lock.json so a future beta is not accepted accidentally;
- no PKCE, SameSite, Secure, trustHost, Google provider, RBAC or AUTH_URL control was weakened;
- Auth callback/error diagnostics were added around the existing Auth.js handlers;
- diagnostics record only host/origin-match, protocol, status, boolean presence of PKCE/state/nonce/callback/CSRF cookies, safe redirect flags and error name;
- diagnostics never record cookie values, OAuth code, email, token, query payload or callback URL value;
- current Admin Production had no PKCE log match in the latest 24-hour scoped check.

Stable-release policy:

- do not downgrade to v4 merely because v5 is beta;
- when a stable non-beta v5 exists, perform a dedicated targeted compatibility upgrade;
- that upgrade must preserve Google OAuth, PKCE, custom-domain AUTH_URL, UAT/Production cookie namespaces, RBAC and fail-closed environment guards;
- it must pass Auth tests, Foundation CI and Web/Admin shadow builds before any merge/deploy decision.

## XH2/XH3 — Category / Featured availability

Resolved in Chat to the safe boundary that can be changed without inventing data:

- same-lane bounded retry implemented;
- malformed Category rows remain isolated;
- Blog Featured remains an optional sidecar;
- no fallback Category source was added;
- no blogSettings document was created merely to silence logs;
- physical category route ownership remains fail-closed when source-of-truth availability is truly unknown.

Any further availability strategy that changes caching/CDN semantics remains a separate measured optimization, not required for this hardening branch.

## XH4 — Sanity schema registry

Audit complete; no mutation.

Production and UAT remote schema registries remain empty. This branch deliberately does not deploy a remote schema because the repository local Studio/schema source is authoritative. A future explicit schema-registry task must use the local Sanity CLI/source workflow rather than creating an MCP-managed parallel schema owner.


## H6 — Neon / Local AI runtime credential boundaries

Read-only source audit completed.

Verified runtime credential ownership:

- Admin operations uses `CCPUN_ADMIN_DATABASE_URL` and verifies database, runtime role, system identity and migration ledger.
- Social runtime uses `CCPUN_SOCIAL_DATABASE_URL` and resolves the exact Social lane before querying.
- Admin Local-AI control-plane reads use `CCPUN_ADMIN_DATABASE_URL` and verify the expected Local-AI identity plus runtime role.
- Public LINE private ingestion uses `CCPUN_LINE_INGEST_DATABASE_URL` plus exact Neon project/branch/database and Web Vercel lane checks.
- Local-AI worker requires `CCPUN_LOCAL_AI_DATABASE_URL`, exact Neon project/branch identity, database `neondb`, SSL, and username `ccpun_local_ai_runtime`.

No audited runtime module falls back to generic `DATABASE_URL`, `POSTGRES_URL`, `NEON_DATABASE_URL` or an owner/backfill credential.

Regression coverage added in `tests/admin/runtime-database-boundary.test.ts`.

Decision: no runtime credential refactor is needed in this hardening round.

## H7 — Legacy Sanity UAT lane

The active UAT lane remains `ccb9lnw5 / uat`.

Legacy `kyfxgjnq / uat` is not an accepted runtime lane. The existing environment resolver already rejects it; this branch adds an explicit regression test so a future refactor cannot silently reintroduce that fallback.

No Sanity project/dataset mutation is required.


# Chat-completed hardening addendum

The following work is now implemented on this branch rather than deferred to Codex:

## H5 — Worker-only Vercel routing

`workers/local-ai/` now has its own `worker-only` classification.

Behavior:

- worker-only diff → Web skips;
- worker-only diff → Admin skips;
- worker + shared/app/package change → conservative mixed build;
- Public Web dependency scanner still forbids runtime reachability into Local-AI worker code.

This avoids creating meaningless Vercel deployments for VPS-only code without weakening fail-safe behavior for mixed changes.

## H6 — Sanity transient read resilience

Category Registry and global Featured settings now use a bounded same-lane retry policy:

- maximum two total attempts by default;
- retry only transport-style failures, 408, 425, 429 and 5xx;
- no retry for auth, validation, configuration or ordinary 4xx failures;
- same Sanity project, dataset, perspective and query on every attempt;
- no Production/UAT fallback;
- no static duplicate Category source;
- no canonical/redirect invention.

The public route ownership semantics remain unchanged. If Category Registry availability is still unknown after the retry, physical category routing remains fail-closed.

## XH5 — Auth.js observability without security downgrade

Auth.js configuration is unchanged:

- PKCE remains enabled;
- Secure/SameSite behavior is not weakened;
- Production custom-domain origin contract is not broadened;
- generated Vercel aliases are not accepted as alternate Production auth origins.

The Admin Auth route now emits sanitized diagnostic metadata only for callback/error exchanges. Diagnostics contain:

- environment;
- request/forwarded host and protocol;
- configured-origin match boolean;
- presence booleans for PKCE/state/nonce/callback/CSRF cookies;
- response status;
- redirect error/origin-match booleans;
- error class name.

Diagnostics never include:

- cookie values;
- OAuth code;
- state/nonce/PKCE values;
- email/user identity;
- access/refresh token;
- Auth secret.

This provides evidence for any future `InvalidCheck` event without changing authentication semantics.

## XH6 — Auth dependency policy

The current patched v5 beta is pinned exactly:

`next-auth = 5.0.0-beta.32`

Lockfile verifies:

- `next-auth 5.0.0-beta.32`
- `@auth/core 0.41.3`

Caret/tilde upgrades are prohibited by regression test while v5 remains beta.

When NextAuth/Auth.js v5 stable becomes available, migration must be handled as a targeted dependency upgrade:

1. verify official stable release;
2. audit Next.js 16/App Router/Auth.js API compatibility;
3. update package manifest + lockfile on a dedicated branch;
4. run auth boundary tests, Admin typecheck/build, Foundation CI and Preview;
5. open a Draft PR;
6. do not merge/deploy Production automatically.

## Evidence correction

The Category Registry / Featured error groups originally surfaced from mixed Vercel project history and included Preview deployments. On the currently inspected Production Web deployment, no matching Category/Featured logs were found in the latest 24-hour scoped query. Therefore these items are resilience hardening, not a claimed current Production outage.

The missing-author issue was independently verified on the current Admin Production deployment and remains a valid Production root cause addressed by H1.

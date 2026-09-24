# Architecture Hardening PR #242 — handoff

Updated: 2026-09-24 Asia/Bangkok

Repository: `punniix/CCPun-Update-4.0`
Base: `v4-production`
Branch: `hardening/architecture-boundaries-20260924`
PR: `#242`

PR #241 Agent OS is already merged into `v4-production` at `1ba9063bc6a692ca6f9c820439a417cf3ebfeb71`. PR #242 was synchronized with that base through PR #243. Its diff must contain only Architecture Hardening changes. Recheck the live branch/base before further work; these SHAs are a handoff snapshot.

## Scope

Finish the existing branch with the smallest proven fixes. Preserve Agent OS behavior, public URLs, analytics, consent, calculator behavior, Production/UAT separation, and the existing infrastructure. Do not recreate PR #241 or import its changes into PR #242 again.

The design and evidence record is [`ccpun-architecture-hardening-20260924.md`](./ccpun-architecture-hardening-20260924.md). Runtime/data ownership is in [`platform-data-architecture.md`](./platform-data-architecture.md).

## Implemented contracts to verify

- Legacy Draft Articles tolerate a missing/null author at the Sanity adapter boundary. Published Articles still fail closed without an author. Existing Portable Text `markDefs:null` and LINE-copy tolerance remain unchanged.
- Category Registry and global Blog Featured reads retry only transient same-lane Sanity failures once. No Production/UAT fallback, static duplicate category registry, or guessed redirect/canonical is allowed. Unknown physical category ownership remains fail closed.
- The dependency scanner includes `workers/` and forbids Public Web runtime reachability into `workers/local-ai/`. A worker-only diff skips both Vercel apps; mixed or unknown diffs build conservatively.
- Auth.js callback/error diagnostics contain structural host/origin, cookie-presence, status, and error-class evidence only. Never log cookie values, OAuth codes, state/nonce/PKCE values, user identity, tokens, or secrets. PKCE, Secure, SameSite, Google OAuth, RBAC, and Production custom-domain origin controls remain unchanged.
- `next-auth` is exactly `5.0.0-beta.32`, with `@auth/core` locked to `0.41.3`. A stable-v5 upgrade is a separate task.
- Runtime DB connections remain purpose-specific and identity-checked. Active Sanity UAT is `ccb9lnw5/uat`; legacy `kyfxgjnq/uat` is rejected. Production Web reads Published only.
- Remote Sanity schema registries were empty when audited; this PR does not deploy a remote schema. The repository Studio/schema source remains authoritative.

## Verification

Inspect the exact branch status and diff against the current `v4-production`, GitHub checks/reviews, and Web/Admin Vercel Preview state. Classify local dirty/untracked files before removing anything. Preserve unrelated user work.

Run focused contracts:

```bash
node --import tsx --test tests/admin/public-article-line-copy-tolerance.test.ts tests/admin/content-sidecar-resilience.test.ts tests/admin/auth-diagnostics.test.ts tests/admin/auth-dependency-policy.test.ts tests/admin/runtime-database-boundary.test.ts tests/content-runtime-environment.test.ts
node scripts/check-app-runtime-boundaries.mjs
node --test tests/vercel-build-routing.test.mjs
```

Then run Web/Admin shadow typechecks and builds, `npm run check:foundation`, and the Sanity privacy boundary CI. Fix only failures caused by this branch. Follow the build → verify → fix loop for at most three iterations.

Inspect the installed `next-auth` and `@auth/core` code to confirm custom cookie names inherit default options and the wrapped GET/POST handlers preserve request/response behavior. Reproduce PKCE only if a safe Preview/UAT flow is practical without provider or credential changes. Otherwise record that it was not reproduced and leave security settings intact.

## Cleanup and handback

Remove only confirmed temporary/obsolete hardening artifacts. Keep the final diff within PR #242 scope and the worktree clean. Consolidate the many Chat commits into a small logical series only if the branch can be rewritten safely; a remote history rewrite requires an exact-head check and scoped owner approval. Re-run checks after any history/content change.

Update the PR body with exact passed checks, Preview state, Auth.js result, PKCE reproduction result, changed files, rollback path, and remaining gates. PR #242 stops at **ready for owner approval**. Merge, Production deployment, Production/UAT DB mutation, Sanity publication, provider/credential changes, and new infrastructure require separate exact authorization. A revert of the PR merge is the code rollback path after an approved release.

The final report must give the final head SHA, logical commits, `git status --short --branch`, preserved unrelated files, checks and failures, Preview state, and explicit unverified items. PR #241 Production/activation reporting is a separate workstream.

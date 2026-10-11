# P1 — Four-lane release and source ownership (2026-10-08)

Status: SOURCE-GUARD IMPLEMENTED; NO HOSTINGER DEPLOYMENT OR RELEASE PROMOTION IN THIS CHANGE.

## Canonical provider/runtime ownership

The machine-readable authority is `lib/runtime/deployment-lanes.mjs`; the supported topology is locked in `docs/architecture/ccpun-four-lane-deployment-contract.md`. Do not treat four hosts as four unrelated repositories.

| Host | Lane | Source workspace | Runtime/data boundary |
| --- | --- | --- | --- |
| `ccpun.com` | Web Production | `apps/web` | Sanity Production, indexing/analytics enabled |
| `test.ccpun.com` | Web UAT | `apps/web` | Sanity UAT, noindex, analytics off |
| `admin.ccpun.com` | Admin Production | `apps/admin` | Sanity/Neon Production; noindex |
| `admin-test.ccpun.com` | Admin UAT | `apps/admin` | Sanity/Neon UAT; noindex, Cloud workers off |

The `app/` root is an **existing compatibility/legacy mirror**, not the owner for the four Hostinger apps. Root-level `features/`, `components/`, `lib/`, and `cms/` are shared by import, not copied into a new app directory.

## Source audit and ownership

`scripts/audit-monorepo-boundaries.mjs` now traverses the actual `apps/web`, `apps/admin`, legacy `app/`, shared packages, and workers. It reports active per-app roots/reachability separately from the legacy mirror; ambiguous route paths and forbidden cross-workspace imports are explicit findings. `scripts/check-app-runtime-boundaries.mjs` remains the fail-closed Web secret/Admin-runtime isolation guard.

Existing legacy file pairs are listed in `qa/monorepo-compatibility-mirrors.json`, and `tests/monorepo-lane-ownership.test.mjs` prevents adding matching `app/` copies without a deliberate reviewed baseline update. Removing a legacy pair is allowed after consumer/build/rollback verification; the baseline does not force retaining dead compatibility paths.

Never delete, consolidate, or redirect a matching route solely because the contents happen to match. Protect public URLs, SEO/sitemaps, and Admin authentication. Keep the `apps/web/public` link to the canonical shared `public/`; Hostinger build packaging materializes actual assets for deployment.

## Git and pinned Production release policy

`v4-production` is the reviewed **source-of-truth integration branch**, not a floating branch to connect blindly to a running Hostinger Production app. Production Hostinger releases use SHA-bound deployment refs (`codex/hostinger-release-production-<40-character-sha>`) and a matching `CCPUN_GIT_REF`/`CCPUN_GIT_SHA`/release identity. This is deliberate and enforced by `lib/runtime/hostinger-production-release.mjs`.

At the time of this inspection (2026-10-08), Hostinger Web and Admin Production each showed current SHA `a8ef55a6e3b4adc2553beda2cc04b89f13528c17`. The remote `v4-production` had since advanced to `193f9b1d4c21b7d414b4e21869d11f242b2498da` (nine commits ahead). **Those newer source changes are not proof of a live deployment**, particularly the security patch. Do not flip Production to the moving branch, or claim the newer Next.js patch is live. An approved release needs an exact SHA, successful UAT/security and rollback gates, a pinned release ref, matched Hostinger env identity, and Web/Admin smoke checks before promotion.

The independently changing Web UAT UX lane must not be overwritten as a side effect of Production/Source housekeeping. Four-lane release parity is reviewed per lane, not inferred from matching source repo names.

## Acceptance / out of scope

- Run `node --test tests/monorepo-lane-ownership.test.mjs` and `npm run test:architecture` as well as Hostinger identity/runtime tests.
- In this P1 source-only pass: no DNS, Sanity/Neon, GTM, Vercel rollback, secrets, Production branch switch, UAT redeploy or destructive cleanup.
- If a stale release is to be promoted, treat it as a separate production release with explicit verification and rollback evidence, not a cleanup side effect.

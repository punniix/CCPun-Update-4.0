# CCPun Runtime Baseline — 2026-10-06

Status: **CURRENT OBSERVED BASELINE / READ-ONLY RECONCILIATION**

This document records the live runtime state observed after Production merge `b77a6c62` and is the current provider-placement reference for Phase 0. It does not authorize deployment, DNS changes, provider retirement, data mutation, or secret changes.

## Current four lanes

| Lane | Domain | Current provider | App lane | Content lane | Indexing | Observed release state |
| --- | --- | --- | --- | --- | --- | --- |
| Web Production | `ccpun.com` | Hostinger | `production` | Sanity `kyfxgjnq/production` | indexable | Hostinger current deployment at `b77a6c62` |
| Web UAT | `test.ccpun.com` | Hostinger | `web-uat` | Sanity `ccb9lnw5/uat` | blocked | Phase 2 UAT candidate at `77e4c4b9` |
| Admin Production | `admin.ccpun.com` | Hostinger | `production-admin` | Sanity Production + Production Neon | blocked | Hostinger-served live Admin; exact current source ref was not reconfigured in Phase 0 |
| Admin UAT | `admin-test.ccpun.com` | Hostinger | `admin-uat` | Sanity UAT + UAT Neon | blocked | Hostinger current deployment at `3162cd26` |

Observed provider evidence on 2026-10-06:
- all four public hosts returned Hostinger platform evidence;
- Web Production and Web UAT returned the expected Sanity CSP endpoints;
- both Admin hosts returned `X-Robots-Tag: noindex, nofollow, noarchive`;
- Web UAT returned `X-Robots-Tag: noindex, nofollow, noarchive` and block-all `robots.txt`;
- Web Production returned the public `robots.txt`, sitemap index, live GTM, and Money Story as indexable;
- `admin.ccpun.com` resolves directly to a Hostinger-served address while the other checked public/UAT hosts are currently behind Cloudflare. This baseline records provider ownership only and does not infer a Cloud Startup/VPS tier from DNS alone.

## Current release facts

Production Git baseline:
- `v4-production = b77a6c62878065aa12f1c5a2e7ca34628ee81143`
- PR #360 four-lane deployment contract merged as `6f7b7489`
- PR #361 Money Story responsive typography merged as `b77a6c62`
- Hostinger Web Production pinned release branch currently points to `b77a6c62`
- Web UAT pinned release branch currently points to Phase 2 candidate `77e4c4b9c893ce70a12826f71f5154aaca1776ed`.

Phase 1 restored Web UAT source/runtime parity with the current Production baseline. Phase 2 keeps that isolated UAT contract while applying the Money Story responsive HUD fix. The UAT deployment remains a separately packaged Hostinger standalone runtime, so parity means reviewed source and public behavior parity—not identical provider packaging.

## Known configuration drift to resolve after Phase 0

1. Web UAT uses the Hostinger standalone packaging shape: root `apps/web`, output `.next/standalone`, entry `.next/standalone/server.js`. Phase 1 records this as the current UAT build contract rather than pretending it matches Production packaging.
2. Admin Production/UAT are live on Hostinger, while the first merged four-lane contract still named Vercel. Contract version 2 corrects provider placement only; deeper Admin runtime hardening remains a later phase.
3. Historical architecture documents still contain Vercel-era provider placement. They remain useful for history and rollback context, but current placement must be read from this baseline plus `lib/runtime/deployment-lanes.mjs`.
4. The primary local migration worktree predates the current Production baseline and contains unrelated uncommitted SEO post-publish work. It must not be used as the base for new Money Story or deployment work.

## Phased next work

### Phase 0 — Re-baseline / SSOT
Current scope:
- update the four-lane provider SSOT to the observed Hostinger placement;
- record the current Production/UAT release split;
- point architecture/current-work docs at this baseline;
- mark older provider-placement statements as superseded where needed;
- no merge to Production, no deploy, no DNS/provider mutation, no data mutation.

### Phase 1 — Restore Web UAT parity — completed 2026-10-06
Accepted UAT release: `2a4c168f07a961c9fc9d530c1417d5f2237fc1c8`. Verified live: Hostinger deployment Completed, Money Story 200, current responsive typography markers present, Sanity UAT CSP (`ccb9lnw5`), `X-Robots-Tag: noindex, nofollow, noarchive`, block-all robots, Production GTM absent, and Shadow parity passed with zero failures after making the parity gate honor isolated UAT Blog membership.

### Phase 2 — Money Story UX/UI — UAT candidate awaiting owner acceptance
Previously accepted UAT release: `43f8d7fa365024cb924fb4a646982d95edf5b277` (Hostinger deployment `01a1101f-9cd4-70f6-9e9c-9676c078086b`). Current UAT candidate: `77e4c4b9c893ce70a12826f71f5154aaca1776ed`.

Responsive audit covered 320×568, 360×800, 393×852, 430×932, 768×1024, 1024×768, 1280×800 and 1440×900. The mobile month/status HUD keeps month/seed and Undo on the first row and shows cash plus portfolio as two structured status cells below. The 1024px landscape layout uses the tablet two-column shell instead of squeezing the three-column desktop shell. No horizontal overflow was observed across the audited viewports. The current follow-up raises mobile Undo and character-return controls to 44px minimum touch targets without changing desktop layout or responsive typography.

The current live UAT candidate still returns `noindex, nofollow, noarchive`, block-all `robots.txt`, and Sanity UAT `ccb9lnw5`; the updated 44px mobile touch-target CSS is being served live. Character-selection cards now pin the income/expense row to the bottom of each equal-height card, and selected-character stat cells pin their values consistently. Production remains pinned at `b77a6c62` and was not redeployed. Promote only the exact owner-reviewed UAT SHA.

### Phase 3 — Admin lane hardening
Reconcile exact Hostinger Admin Production/UAT build, runtime, scheduler/worker and release identities. Do not infer completion from HTTP 200 alone.

### Phase 4 — Vercel retirement / cleanup
Audit remaining Vercel execution, cron, OIDC, callback, deployment, rollback and credential dependencies. Retirement is a separate acceptance gate and is not performed by Phase 0.

## Authority order

For runtime placement questions, use:
1. live provider read-back;
2. this runtime baseline;
3. `lib/runtime/deployment-lanes.mjs`;
4. the four-lane deployment contract;
5. older migration/history documents only for historical context.

If live read-back contradicts this baseline, stop and re-baseline before changing infrastructure.

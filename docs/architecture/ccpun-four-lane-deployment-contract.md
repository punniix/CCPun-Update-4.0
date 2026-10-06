# CCPun 4-Lane Deployment Contract

Status: **provider placement re-baselined 2026-10-06**. This contract locks lane identity and data/indexing boundaries. It does not by itself certify that all migration/retirement work is complete.

## Canonical lanes

| Lane | Domain | Current provider | App environment | Sanity | Indexing | Production analytics |
| --- | --- | --- | --- | --- | --- | --- |
| Web Production | `ccpun.com` | Hostinger | `production` | `kyfxgjnq/production` | allowed | on |
| Web UAT | `test.ccpun.com` | Hostinger | `web-uat` | `ccb9lnw5/uat` | blocked | off |
| Admin Production | `admin.ccpun.com` | Hostinger | `production-admin` | `kyfxgjnq/production` | blocked | off |
| Admin UAT | `admin-test.ccpun.com` | Hostinger | `admin-uat` | `ccb9lnw5/uat` | blocked | off |

The machine-readable source of truth is `lib/runtime/deployment-lanes.mjs`. Current release observations are recorded separately in `docs/architecture/ccpun-runtime-baseline-20261006.md`.

## Locked Web Hostinger build shapes

Both Web lanes use Node 24 and the reviewed `@ccpun/web` source, but current Hostinger packaging differs by lane:

- Web Production: repository root `./`, build `npm run build`, output `apps/web/.next`.
- Web UAT: root `apps/web`, build `npm run build`, output `.next/standalone`, entry `.next/standalone/server.js`.

Phase 1 verified that this UAT packaging serves the same reviewed application behavior while retaining Sanity UAT, noindex and analytics-off boundaries. Do not infer that provider packaging must be byte-identical to call the source/runtime lane current.

Production must never silently become a local lane. A deployed lane without its approved Sanity identity is an error rather than an empty local-content fallback.

## Admin placement boundary

Both canonical Admin hosts are currently Hostinger-served. This contract therefore rejects stale Vercel project identity as the current Admin lane identity.

This provider placement statement does **not** certify:
- Article Scheduler execution ownership;
- background worker/cron completion;
- provider-neutral Web/Admin trust;
- Vercel retirement;
- exact Cloud Startup versus VPS placement for every private/background component.

Those remain separate acceptance items.

## Fail-closed behavior

- Web Production with a UAT/local/provider/content mismatch blocks Production analytics and indexing.
- UAT can never use Production Sanity, Production analytics, or public indexing.
- Admin UAT/Production must retain their exact UAT/Production Sanity and operational data boundaries.
- Deployed content lanes cannot silently fall back to the local content provider when Sanity configuration is invalid.
- Hostinger build/bootstrap and readiness checks consume the same lane contract used by runtime boundary checks.
- A stale `VERCEL_PROJECT_ID` must not be used to make a Hostinger lane appear valid.

## Change policy

Any change to domain, provider, Sanity project/dataset, indexing policy, analytics policy, workspace, Node major, build command, root directory, or Web output directory must update the contract and pass the architecture/Hostinger tests before merge.

Vercel retirement remains a later migration phase. Updating current provider placement is not permission to delete Vercel projects, credentials, callbacks, cron jobs or rollback deployments.

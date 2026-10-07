# CCPun 4-Lane Deployment Contract

Status: **P0 provider placement closed 2026-10-07**. This contract locks lane identity and data/indexing boundaries. Operational worker activation and destructive rollback-asset cleanup remain separate post-P0 work.

## Canonical lanes

| Lane | Domain | Current provider | App environment | Sanity | Indexing | Production analytics |
| --- | --- | --- | --- | --- | --- | --- |
| Web Production | `ccpun.com` | Hostinger | `production` | `kyfxgjnq/production` | allowed | on |
| Web UAT | `test.ccpun.com` | Hostinger | `web-uat` | `ccb9lnw5/uat` | blocked | off |
| Admin Production | `admin.ccpun.com` | Hostinger | `production-admin` | `kyfxgjnq/production` | blocked | off |
| Admin UAT | `admin-test.ccpun.com` | Hostinger | `admin-uat` | `ccb9lnw5/uat` | blocked | off |

The machine-readable source of truth is `lib/runtime/deployment-lanes.mjs`. Current release observations are recorded separately in `docs/architecture/ccpun-runtime-baseline-20261007.md`.

## Locked Web Hostinger build shapes

Both Web lanes use Node 24 and the reviewed `@ccpun/web` source, but current Hostinger packaging differs by lane:

- Web Production: repository root `./`, build `npm run build`, output `apps/web/.next`.
- Web UAT: root `apps/web`, build `npm run build`, output `.next/standalone`, entry `.next/standalone/server.js`.

Phase 1 verified that this UAT packaging serves the same reviewed application behavior while retaining Sanity UAT, noindex and analytics-off boundaries. Do not infer that provider packaging must be byte-identical to call the source/runtime lane current.

Production must never silently become a local lane. A deployed lane without its approved Sanity identity is an error rather than an empty local-content fallback.

## Front-plane placement boundary

All four canonical browser-facing hosts belong to the Hostinger application/front plane. Web/Admin application runtime is a Cloud Startup responsibility; the VPS is the automation/private-compute plane and must not become the steady-state browser-facing Web/Admin owner.

Residual Web/Admin containers or routes on the VPS are migration residue, not provider-placement authority. They may be retired only after current Cloud Startup origin/read-back and dependent callback checks prove they are unused.

This placement statement does **not** activate Article Scheduler, Social or LINE provider execution. Private worker activation remains a separate post-P0 acceptance gate.

## Fail-closed behavior

- Web Production with a UAT/local/provider/content mismatch blocks Production analytics and indexing.
- UAT can never use Production Sanity, Production analytics, or public indexing.
- Admin UAT/Production must retain their exact UAT/Production Sanity and operational data boundaries.
- Deployed content lanes cannot silently fall back to the local content provider when Sanity configuration is invalid.
- Hostinger build/bootstrap and readiness checks consume the same lane contract used by runtime boundary checks.
- A stale `VERCEL_PROJECT_ID` must not be used to make a Hostinger lane appear valid.

## Change policy

Any change to domain, provider, Sanity project/dataset, indexing policy, analytics policy, workspace, Node major, build command, root directory, or Web output directory must update the contract and pass the architecture/Hostinger tests before merge.

Vercel is retired from required runtime and autonomous execution. Recoverable Vercel projects, credentials, aliases and deployments may remain as rollback/history assets until a separately approved destructive-retirement gate; their existence must not be interpreted as current runtime ownership.

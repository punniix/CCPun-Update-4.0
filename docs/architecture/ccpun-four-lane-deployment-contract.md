# CCPun 4-Lane Deployment Contract

Status: locked for current providers. Provider migration is deliberately out of scope for this contract.

## Canonical lanes

| Lane | Domain | Provider | App environment | Sanity | Indexing | Production analytics |
| --- | --- | --- | --- | --- | --- | --- |
| Web Production | ccpun.com | Hostinger | production | kyfxgjnq/production | allowed | on |
| Web UAT | test.ccpun.com | Hostinger | web-uat | ccb9lnw5/uat | blocked | off |
| Admin Production | admin.ccpun.com | Vercel | production-admin | kyfxgjnq/production | blocked | off |
| Admin UAT | admin-test.ccpun.com | Vercel | admin-uat | ccb9lnw5/uat | blocked | off |

The machine-readable source of truth is lib/runtime/deployment-lanes.json.

## Locked Web Hostinger build shape

Both Web lanes use Node 24, repository root ./, build command npm run build, workspace @ccpun/web, and output directory apps/web/.next.

Production must never silently become a local lane. A deployed lane without its approved Sanity identity is an error rather than an empty local-content fallback.

## Fail-closed behavior

- Web Production with a UAT/local/provider/content mismatch blocks Production analytics and indexing.
- UAT can never use Production Sanity, Production analytics, or public indexing.
- Deployed content lanes cannot silently fall back to the local content provider when Sanity configuration is invalid.
- Admin Production/UAT remain pinned to the existing Vercel Admin project until a separately approved provider migration changes this contract.
- Hostinger build/bootstrap and readiness checks read the same contract used by runtime boundary checks.

## Change policy

Any change to domain, provider, Sanity project/dataset, indexing policy, analytics policy, workspace, Node major, build command, root directory, or Web output directory must update the contract and pass the architecture/Hostinger tests before merge.

Moving Admin from Vercel is explicitly a separate migration and must not be bundled into routine development work.

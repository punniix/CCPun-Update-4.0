# Hosting portability foundation

> **Provider-placement note (2026-10-07):** this foundation predates the Hostinger cutover. Current placement and release authority are defined by [`ccpun-runtime-baseline-20261007.md`](./ccpun-runtime-baseline-20261007.md) and `lib/runtime/deployment-lanes.mjs`. All four canonical lanes are Hostinger lanes; the provider-neutral identity/fail-closed design below remains applicable.


CCPun separates deployment **provider** from application **environment** and **role**.

## Identity contract

Server-side runtime identity uses these CCPun variables:

| Variable | Class | Purpose |
| --- | --- | --- |
| `CCPUN_APP_ENV` | runtime, private | Existing lane: `web-uat`, `admin-uat`, `production`, `production-admin`, local lanes |
| `CCPUN_DEPLOYMENT_PROVIDER` | runtime, private | Explicit non-Vercel provider. Phase 1 supports `hostinger` and `local`; Vercel is inferred from its project ID |
| `CCPUN_DEPLOYMENT_ROLE` | runtime, private | `web` or `admin`; required for Hostinger |
| `CCPUN_GIT_REF` | runtime, private | Provider-neutral release branch/ref |
| `CCPUN_GIT_SHA` | runtime, private | Provider-neutral commit SHA |
| `CCPUN_RELEASE_ID` | runtime, private | Optional provider-neutral release/deployment identifier |

No new `NEXT_PUBLIC_*` identity variable is required. Identity checks that protect Admin, Sanity, Neon, LINE, Social, or scheduler mutations must remain server-side.

Hostinger is the current provider for the canonical Web/Admin lanes. `VERCEL_*` identity remains only as bounded rollback/test compatibility and must not be required for accepted Hostinger runtime. Hostinger must never imitate Vercel by setting a fake `VERCEL_PROJECT_ID`.

Current Hostinger Web Production provides at least:

```
CCPUN_DEPLOYMENT_PROVIDER=hostinger
CCPUN_DEPLOYMENT_ROLE=web
CCPUN_APP_ENV=production
CCPUN_GIT_REF=v4-production
CCPUN_GIT_SHA=<commit>
CCPUN_RELEASE_ID=<release>
```

Admin uses `CCPUN_DEPLOYMENT_ROLE=admin` and `CCPUN_APP_ENV=production-admin`.

## Safety

Contradictory provider, role, environment, or Vercel project identity fails closed. Production data-plane guards remain independent from the compute provider.

Phase 1 does not change DNS, domains, Sanity/Neon data, OAuth, production cron ownership, Workflow backend/state, URLs, canonical, redirects, sitemap, or SEO behavior.

## Rollback

The provider-neutral identity layer has no independent data migration. Normal application rollback is Hostinger release N -> Hostinger release N-1 while preserving the same Sanity/Neon lane. Retained Vercel projects are recoverable rollback assets only; reactivating them is an explicit emergency recovery decision, not the steady-state rollback mechanism and not a required runtime dependency.

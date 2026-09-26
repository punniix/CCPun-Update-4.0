# Hosting portability foundation

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

Vercel remains the production provider. Existing `VERCEL_*` system variables are adapted into the same identity contract. Hostinger must never imitate Vercel by setting a fake `VERCEL_PROJECT_ID`.

A future Hostinger Web production runtime is expected to provide at least:

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

The foundation has no external-state migration. Rollback is a code revert to the prior Vercel-specific identity path; Vercel, Sanity, Neon, DNS, and scheduled-job ownership remain unchanged.

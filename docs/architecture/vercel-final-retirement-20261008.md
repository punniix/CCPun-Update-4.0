# Vercel Final Retirement Receipt — 2026-10-08

Status: **FULLY DELETED / VERCEL PROVIDER RETIREMENT COMPLETE**

This receipt records the final non-destructive and custom-domain retirement of the two legacy Vercel projects after Hostinger release alignment and full runtime verification.

## Projects

- `ccpun-web` — `prj_dxwjITkd0av5QiJQv2snUlIASUWu`
- `ccpun-admin` — `prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN`

Before deletion, both projects reported `live: false` and were paused.

Phase C additionally set both projects to:

- disable Preview deployments;
- disable automatic custom-domain assignment;
- disable Preview feedback;
- disable Production feedback.

## Canonical domain detachment

The stale canonical domain attachments were removed from Vercel:

- `ccpun.com`
- `www.ccpun.com`
- `admin.ccpun.com`

Vercel now retains only project-owned `.vercel.app` aliases:

- Web: `ccpun-web-v4-prod.vercel.app`
- Admin: `ccpun-admin-prod.vercel.app`

Post-detachment HTTP read-back remained on the accepted Hostinger path:

- `ccpun.com` -> HTTP 200 through Cloudflare/Hostinger;
- `www.ccpun.com` -> HTTP 308 to `https://ccpun.com/`;
- `admin.ccpun.com` -> HTTP 307 to the Hostinger Admin login path with LiteSpeed origin evidence;
- no `x-vercel-id` or `x-vercel-cache` header was observed on canonical hosts.

Removing the Vercel domain attachments did not require or change DNS.

## Deployment / Git retirement

Before deletion, both projects were paused/non-live with Preview deployment creation and automatic custom-domain assignment disabled.

The Vercel Git settings no longer expose an active repository/deploy-hook path for the retired Web project. The projects are not accepted deployment owners regardless: current Web/Admin release authority is Hostinger.

Historical Vercel deployments remain stored as audit/history objects until project deletion.

## Environment variables

Before deletion, Vercel still stored historical project environment-variable metadata/secrets inside the paused projects. They were no longer execution dependencies and could not affect canonical Hostinger runtime while the projects were paused/non-live and canonical domains were detached.

Before deletion, the connected Vercel control surface exposed edit/list operations but no supported bulk project-environment deletion action. The owner then completed permanent project deletion, which removed the remaining project-scoped Vercel state.

## Irreversible deletion completed

The owner completed the irreversible Vercel deletion confirmation for both retired projects on 2026-10-08.

Post-delete provider read-back confirms:

- Vercel project list for the team returns zero projects;
- direct project lookups for both `ccpun-web` and `ccpun-admin` return `404 not_found`;
- canonical Hostinger hosts remain healthy after deletion.

## Acceptance

Vercel final retirement is operationally sealed because:

1. both projects were paused and `live:false` before deletion;
2. Preview deployments and automatic custom-domain assignment were disabled before deletion;
3. all canonical custom-domain attachments are removed from Vercel;
4. canonical HTTP service remains healthy on Hostinger after detachment;
5. Vercel owns no operational cron/background executor;
6. residual deployments/envs were isolated inside paused projects before deletion and were removed with project deletion;
7. both legacy Vercel projects are permanently deleted.

At this point Vercel has no remaining CCPun project, canonical serving authority, or execution authority.

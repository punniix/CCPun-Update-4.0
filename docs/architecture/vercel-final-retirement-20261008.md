# Vercel Final Retirement Receipt — 2026-10-08

Status: **PROVIDER RETIREMENT SEALED / PROJECT DELETE CONFIRMATION LEFT TO OWNER**

This receipt records the final non-destructive and custom-domain retirement of the two legacy Vercel projects after Hostinger release alignment and full runtime verification.

## Projects

- `ccpun-web` — `prj_dxwjITkd0av5QiJQv2snUlIASUWu`
- `ccpun-admin` — `prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN`

Both projects report `live: false` and are paused.

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

Both projects are paused and non-live. Preview deployment creation is disabled and automatic custom-domain assignment is disabled.

The Vercel Git settings no longer expose an active repository/deploy-hook path for the retired Web project. The projects are not accepted deployment owners regardless: current Web/Admin release authority is Hostinger.

Historical Vercel deployments remain stored as audit/history objects until project deletion.

## Environment variables

Vercel still stores historical project environment-variable metadata/secrets inside the paused projects. They are no longer execution dependencies and cannot affect canonical Hostinger runtime while the projects are paused/non-live and canonical domains are detached.

The connected Vercel control surface exposes edit/list operations but no supported bulk project-environment deletion action. Permanent project deletion will remove the residual project-scoped state in one irreversible operation.

## Irreversible deletion boundary

The Vercel deletion endpoint is exposed to ChatGPT only as `requires_user_action`.

Therefore ChatGPT can prepare the Delete Project section but cannot click the final irreversible confirmation for the owner.

The only remaining Vercel-side action is the owner's explicit deletion confirmation for:

1. `ccpun-web`
2. `ccpun-admin`

This confirmation is not a runtime migration blocker.

## Acceptance

Vercel final retirement is operationally sealed because:

1. both projects are paused and `live:false`;
2. Preview deployments and automatic custom-domain assignment are disabled;
3. all canonical custom-domain attachments are removed from Vercel;
4. canonical HTTP service remains healthy on Hostinger after detachment;
5. Vercel owns no operational cron/background executor;
6. residual deployments/envs are isolated inside paused projects;
7. project deletion is reduced to an explicit owner-only irreversible confirmation.

At this point Vercel has no canonical serving or execution authority for CCPun.

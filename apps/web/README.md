# CCPun Public Web

This app root is the Vercel survivor for `ccpun.com` and `www.ccpun.com`.

## Deployment ownership

- Web-owned runtime and Web-only support changes should build `ccpun-web` and skip `ccpun-admin` in Production.
- Admin-owned changes should not rebuild this project.
- Shared or unknown repository changes intentionally remain fail-safe and may build both projects.
- Preview branch suppression is defined in `apps/web/vercel.json`; Production changed-path routing is owned by `scripts/vercel-ignore-build.mjs`.

## Production isolation proof

This non-runtime Web-owned file was added on 2026-09-17 as a live Production routing probe after the shared-root classifier fix. Its merge is expected to create a `ccpun-web` Production deployment without creating a `ccpun-admin` Production deployment candidate.

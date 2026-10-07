# Phase 5 Final Migration Closure — 2026-10-07

Status: **CODE/RUNTIME CLOSURE COMPLETE / VERCEL PROJECT DELETION REQUIRES OWNER CONFIRMATION IN VERCEL**

Phase 5 closes the remaining migration-era compatibility and security work without manufacturing a deployment or provider mutation that is not required by the live runtime.

## Production release alignment

Hostinger Web Production and Admin Production deployment settings both currently pin the reviewed release branch:

`codex/hostinger-release-production-26658e389348a4e7b1fffaa362531a3ece3cbbff`

The current source SSOT after Phase 4 is `3530597a20c31c7787b16a888c2bc78629ab1ba8`.

A direct Git diff from `26658e38` to `3530597a` contains architecture/documentation receipts and the deployment-contract checker only. It contains no Web/Admin application runtime source change. Therefore Phase 5 does **not** redeploy Production merely to change a governance SHA. That would add deployment risk without changing runtime behavior.

A future real application promotion must move branch/ref/SHA/release identity together through the normal release gate.

## Legacy `/snt-admin/*` retirement

The live-caller audit covered:

- repository runtime callers;
- VPS process/config references;
- private-worker launchers;
- cron/systemd ownership;
- an export of all 108 n8n workflows.

No active callback, worker, n8n workflow, or private runtime caller depended on `/snt-admin/*` or `/api/snt-admin/*`.

Phase 5 therefore removes the active compatibility behavior:

- legacy page route mapping is removed;
- legacy API method-preserving rewrites are removed;
- editorial capability aliases are removed;
- canonical `/api/admin/*` and current Admin page routes are the only active contract.

The proxy/robots patterns may retain legacy path strings only as **deny/privacy fences** so an old request fails closed instead of bypassing Admin protection. Historical receipts retain original strings for audit evidence.

Targeted routing/auth/editorial tests pass after retirement.

## Security Phase 2

The directly patchable `http-cache-semantics` advisory is pinned to `4.3.0`.

After that patch:

- full lock audit: 13 high, 0 critical;
- Production dependency audit: 11 high, 0 critical;
- `http-cache-semantics` is no longer in the finding set.

The remaining findings are the upstream Sanity/next-sanity/CLI glob stack plus the Next ESLint glob stack. `npm audit fix --dry-run` proposes incompatible major downgrades (`sanity 5.7.0`, `next-sanity 11.6.13`, `eslint-config-next 14.2.35`) rather than a compatible patched current line. Those downgrades conflict with the current Next 16 / next-sanity peer contract and were not adopted.

This is recorded as upstream residual security debt, not silently represented as zero findings. Architecture/typecheck and targeted Admin boundary tests remain green, and the deployed Hostinger vulnerability view was already clear in the Production baseline.

## Vercel retirement

Both Vercel projects remain `live: false` and have now been paused:

- `ccpun-web`
- `ccpun-admin`

No operational Vercel cron or runtime owner remains.

Vercel still records historical project-domain attachments, including `ccpun.com`, `www.ccpun.com` and `admin.ccpun.com`, but canonical HTTP service is Hostinger. The available connected Vercel control surface does not expose project-domain removal or irreversible project deletion as an in-chat mutation.

Permanent project deletion is therefore the only provider-side destructive step not executable by the migration agent: Vercel requires the owner to open the Delete Project section and confirm the irreversible deletion in its UI.

## Historical cleanup

Migration plans dated before the current baseline remain explicitly historical evidence rather than current authority. Old VPS Web/Admin migration build trees were already removed in Phase 2; private worker releases were reduced to the selected Production/UAT releases in Phase 3.

Historical source snapshots used by Local AI are not deleted merely because they contain old strings; deletion requires proving they are not part of the active Local AI build/runtime path.

## Acceptance

Phase 5 code/runtime closure is complete when this receipt merges:

1. no active legacy Admin alias/rewrite remains;
2. canonical routing tests and architecture contracts pass;
3. the directly patchable security finding is closed;
4. incompatible audit downgrades are rejected and residual upstream findings are documented;
5. both Vercel projects are paused and non-live;
6. Production is not redeployed when the source delta is governance-only;
7. destructive Vercel deletion is isolated as an explicit UI confirmation instead of being conflated with migration runtime completion.

At this point the Vercel-to-Hostinger runtime migration is complete. The only remaining action is optional irreversible deletion of the two paused Vercel rollback projects by the owner in Vercel.

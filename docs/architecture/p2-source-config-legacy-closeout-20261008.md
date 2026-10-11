# CCPun P2.2–P2.4 source and config cleanup — 2026-10-08

Status: **CLOSED for non-destructive architecture cleanup, compatibility classification and drift control.** No authority to delete retained legacy routes, caches, old releases, migration history or live config.

## P2.2: Route/source duplication

The P1 inventory grandfathered **104 source mirror pairs** under the legacy `app/` tree. P2.2 consolidated **seven implementation groups** through PR #385 (Privacy/Cookie/Not Found) and #386 (four sitemap handlers) while retaining both sets of required Next.js route entrypoints. The final inventory is `qa/p2-source-mirror-inventory.json`: 104 pairs, 74 byte-identical, 30 divergent, and seven shared-handler routing pairs. All 104 are explicitly classified by canonical lane and retention status.

The remaining identical files are **compatibility entrypoints**, not confirmed dead or safe-to-delete files. The 30 divergent implementations have semantics that might reflect legacy rollback, route security or separate Web/Admin ownership. They remain deliberately retained; they are *not* a claim that every duplicate implementation was eliminated. No Admin API root mirror was deleted. P2.2 closes the **safe** deduplication scope; future Admin API refactors need an independent feature-specific authorization, consumer proof, CI and rollback gate.

The root `app/globals.css` and separate `apps/web/app/globals.css`/`apps/admin/app/globals.css` are styling compatibility files and are **not** route-pair baseline entries. The CSS copies remain retained.

## P2.3: Single source of truth for navigation/config

Canonical navigation is `lib/nav-config.json`, and `public/nav-config.json` is a required public compatibility mirror with byte-for-byte parity. `scripts/sync-public-nav-config.mjs` provides:
- `npm run nav:check`: read-only schema, route and parity verification.
- `npm run nav:sync:write`: explicit owner-invoked regeneration of the public mirror from the canonical source, never automatic build mutation.

The drift check is integrated into `npm run test:architecture` and CI. Dynamic domain/lane/secret configuration remains owned by `lib/runtime/deployment-lanes.mjs` and the four-lane contract. Do not consolidate live Web/Admin environment variables or change their Hostinger Node/build/output settings during P2.

## P2.4: Legacy Vercel and Migration retention

All known Vercel configs, `.vercelignore`, Vercel build gate, legacy auth compatibility, historical Vercel receipts and URL-ledger evidence are inventoried in `qa/p24-legacy-retention-policy.json`. None are active Vercel deployment authority. They are retained because build-routing security regression tests still read them, historic rollback/release receipts remain useful, or web search/URL parity depends on legacy evidence.

`scripts/check-p2-source-config-closeout.mjs` enforces that no operational Vercel `crons` or `functions` sneak back into any Vercel config and every retained evidence file exists. The test also protects the full original 104-pair compatibility baseline. Old instructions in historic Vercel-era documents do not override `docs/architecture/ccpun-four-lane-deployment-contract.md` or the exclusive-VPS execution contract.

No `apps/admin/vercel.json` crons, DNS, Vercel project, provider execution owner, Sanity, Neon, CMS content or hosted runtime was changed in this cleanup. No migration SQL, public blog media, Hostinger cache or runtime release was deleted.

## Protected concurrent work and signoff

- Web UAT `test.ccpun.com` and UX Improvement branch `codex/ux-uat-20261008` remain untouched.
- Draft Investment Allocation PR #165 remains separate; do not deploy or merge it as housekeeping.
- Original 14-file WIP on `prep/hostinger-migration-readiness-20260929` remains untouched; its newer Post-Publish implementation is source-merged through #387/#388, but the local dirty files are not automatically deleted or reset.
- P2.1 already completed its four-lane filesystem inventory and shared npm-cache classification without deleting active runtime. No additional Hostinger filesystem cleanup is authorized.
- **Source closeout does not equal runtime promotion.** Any later Production deploy requires SHA-pinned release, four-lane smoke/SEO/security readback and rollback plan. Do not change the active Web UAT UX release while it is owned by the separate UX track.

References: `qa/monorepo-compatibility-mirrors.json`, `docs/architecture/p22-legacy-route-implementation-dedup-20261008.md`, `docs/architecture/hostinger-p21-filesystem-inventory-20261008.md`, `docs/architecture/repository-architecture.md`.

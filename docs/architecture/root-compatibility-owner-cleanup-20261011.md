# Runtime ownership consolidation — 2026-10-11

Scope: code-only structural changes on the UAT integration source. Baseline: `3d90961371a538fe9c7ee8e8f309085ab904850f`. No provider, Production, authentication, customer-data, source install, dependency version or UI changes by this writer. Other writers' investment/Footer/Money Story changes are excluded from the structural commits.

## Decisions and resulting owners

| Previously identified debt | Result | Retained boundary and reason |
| --- | --- | --- |
| Root `app/` duplicates of isolated app implementations | All **47** nontrivial byte-identical pairs now delegate to actual `apps/admin/app/` or `apps/web/app/` implementation owners. Exact pair/export inventory: `qa/root-runtime-owner-migration.json`. Root implementation bytes: **103,233 → 3,762**. | Root entries remain because `scripts/build-root.mjs` explicitly invokes native root `next build` for its non-Hostinger-workspace fallback. `dynamic` / `maxDuration` remain literal at the entry. This reduces maintenance copies; it does not claim a measured browser speed increase. |
| Root versus Web route ownership | Tests of current handler/Home logic read canonical owners. Public graph tooling now starts at actual Web/Admin apps, with public rendering roots restricted to Web. | Already-thin feature wrappers, root mixed-host `layout.tsx` and `robots.ts`, and differing historical compatibility handlers remain. They implement different root fallback contracts, not a second byte-identical implementation. Their historical tests are named explicitly and preserved. |
| Global CSS owned by legacy app root | One owner: `components/styles/global-foundation.css`. Web imports it directly; root bridge imports it; Admin imports the existing root bridge. | Tokens, Kanit, focus, theme/defaults, print and motion are unchanged. Tailwind source/import paths resolve to the same components/features/styles. The entire foundation body after its import/source prelude is byte-identical to baseline. Compiled Tailwind output still requires full CI/build confirmation. |
| Repeated CSP/security header builder | One pure builder: `lib/runtime/security-headers.mjs`. Runtime policy delegates to it; existing `apps/next-security-headers.mjs` is an export compatibility boundary for Admin config. Web config imports the pure builder directly. | Web build-time trimmed project/review inputs and runtime untrimmed project/exact review inputs remain distinct intentionally. Studio frame-ancestor transformation and stricter sealed runtime identity stay intact. No expanded CSP origin or relaxed HTTPS gate. |
| Repeated Web environment parsing | `lib/runtime/web-build-config.mjs` owns the Web environment projection used by Web config and runtime. | Build-time Sanity validation and runtime sealed deployment/Sanity validation remain separate; runtime still calls the stricter content/deployment contract. Fixed Vercel ID inputs remain rollback/local compatibility, not evidence of current Vercel hosting. |
| Repeated Web redirect table | One ordered table in `lib/runtime/web-build-config.mjs` feeds Web config, Hostinger proxy, and root fallback. | Root explicitly excludes the newer Web tax migration, preserving its original three redirects. Web config uses permanent redirects only outside Hostinger; Hostinger proxy preserves explicit tax301/other308, query and POST/data request handling. |
| Navigation mirror | `lib/nav-config.json` remains canonical; `/nav-config.json` remains its generated public URL compatibility mirror. | `scripts/sync-public-nav-config.mjs` plus the existing architecture contract prevent drift. Deleting a served compatibility URL would change the contract. |
| Vercel references / formula legacy code | Classified rather than deleted blindly. Deployment identity IDs, deny-only host matchers, config fixtures and app-root files retain rollback/local compatibility tests. | Current Hostinger workspace dispatch and provider contract are unchanged. Frozen CI/FHC formula references remain explicit test owners. Historical references do not imply live Vercel execution. |

## Gate record

The fence rejected literal Next bracket path names as globs. Those root files remained untouched until the COO explicitly approved the bounded twelve-path artifact `root-dynamic-route-owner-migration-20261011.patch`, relayed by `/root` on 2026-10-11. All twelve are now applied; no other rejected path is authorized. Fence/instruction files are unchanged. Other source/test/package writes used accepted exact development cards.

## Evidence

- All 47 canonical bodies match their frozen baseline SHA256; the original implementation remains unchanged. The manifest records before hashes and exact wrappers. The CI ownership check validates wrapper mappings/static exports without freezing future legitimate canonical implementation edits.
- `node --test tests/root-runtime-owner-migration.test.mjs tests/web-foundation-config-parity.test.mjs tests/vercel-app-root-config.test.mjs`: **24 PASS**. Includes 18 unchanged frozen config/CSP/proxy result digests from Production1843, 132 content-to-Web environment combinations, ordered root redirect output, and canonical ownership/static config checks. Existing digests were not regenerated or weakened.
- Actual-app CSS ownership audit: 10 shared classes, 242 Website43 classes, zero unused references, zero duplicate base owners, zero orphan contextual overrides, one responsive stylesheet owner. Assets audit: zero unowned non-Blog assets.
- Repository architecture contract PASS; public architecture graph audit PASS; public shell performance PASS; Home LCP composition PASS; Website43 layout regression **19 PASS**.
- Selected Admin API security/audit/control/SEO checks: 52 PASS, one local bootstrap limitation below. Admin Media + environment checks **31 PASS**, legacy API inventory **3 PASS**, route migration **4 PASS**, affected Social tests **105 PASS**. These tests use mocks/synthetic fixtures; no real provider sends.
- Native Next `loadConfig` from `apps/web` on **Node v24.11.1**, both Hostinger UAT and Production public fixtures: PASS; standalone output, two header rules, Hostinger redirect array `[]`. This is actual Next config loading, not a private transpiler probe and not a full build.
- Native root config load reaches the workflow plugin but fails locally resolving `workflow/internal/builtins` without root-installed dependencies. No install/link workaround made. Full root/Web/Admin builds remain required before release.

## Local dependency limits and required next checks

Execution-only installed CLI runtime used: `../ccpun-ux-uat-20261008/node_modules`; no dependency source inspected, installed or linked. CJS checks use `NODE_PATH` and TS checks execute the external tsx loader. ESM `react`/`jsdom` cannot resolve through `NODE_PATH`, so the full Vercel-native continuation / Hostinger test-file bootstrap is **NOT VERIFIED locally**. The hermetic provider-growth child clears inherited loader paths and likewise cannot resolve `tsx`. These failures are environment bootstrap limitations, not acceptance results; CI with repository-owned dependencies must run the unmodified real suites.

The new owner check is registered in existing `test:foundation-contracts`. Parent/independent QA owns full CI, typecheck, real Next builds, compiled CSS/route-table/metadata parity, GA/Meta lifecycle checks and UAT target verification. Production remains a separate user gate.

Root fallback build with normal CI dependencies (synthetic public lane; no provider action):

```sh
CCPUN_DEPLOYMENT_PROVIDER=local CCPUN_DEPLOYMENT_ROLE=web CCPUN_APP_ENV=development NEXT_PUBLIC_SANITY_PROJECT_ID=ccb9lnw5 NEXT_PUBLIC_SANITY_DATASET=uat CCPUN_UAT_MODE=1 npm run build
```

This explicitly takes `scripts/build-root.mjs`'s `next build` branch instead of selecting `@ccpun/web`/`@ccpun/admin`. Compare baseline/candidate route tables and metadata, then run existing native Web/Admin workspace builds and Foundation/Monorepo/Hostinger suites on the frozen final source.


## Remaining ownership — allowed partial closeout (2026-10-12)

Frozen baseline: `467c1323f2cf755a713aa747dfce27168ee4faf7`. The original 104-pair inventory consists of 47 migrated nontrivial implementations, 20 existing thin adapters, seven shared-handler boundaries and 30 divergent pairs (28 distinct root paths). The divergent group is 20 Admin UI entries, two Studio entries, three API entries, and five intentional mixed-lane layout/robots/home pairs.

This partial adds **17** accepted root adapters: 16 Admin UI entries and the Ubersuggest sync API. The strict manifest/CI contract now checks **64** migrations; it does not claim 72. Canonical UI bodies are unchanged. The root social/posts entry explicitly forwards both `metadata` and `default`, and the ownership check verifies actual public exports, including canonical named reexports.

The remaining eight literal-bracket root entries are **unapplied** pending a fresh bounded COO exception, separately from the earlier twelve-file permission. Exact proposed changes are in `root-remaining-dynamic-owner-migration-20261011.patch`. No fence/instruction rule was changed or bypassed. Five mixed-lane pairs remain intentionally composed: root layout/robots can serve both host lanes and root home delegates to Web while Admin has its own authenticated landing. They are not redundant implementations.

Three layouts now import `components/styles/critical-foundation.ts`; the exact 2,538-byte inline CSS, its original head position and all surrounding layout composition are preserved. SHA256: `577096749764481408b823a1135d361535d7bae18f56e5a4dbad36c0a3e00666`. This removes three source literals, not the browser's first-paint CSS. The 17 replaced root bodies fall from 114,607 to 1,442 raw source bytes; no load-time gain is claimed from source bytes.

The canonical Ubersuggest handler now owns the frozen previous root's reviewed-import/provider-sync contract. An existing UAT reviewed-import form is an actual consumer. Production reviewed imports remain denied; same-origin, human identity, RBAC/policy, strict schema, provider-cache/in-flight deduplication and redacted error contracts are tested. Existing canonical proxy already enforced same-origin requests; this change is consolidation and reviewed-import reconciliation, not a claim of a previously demonstrated origin exploit. Canonical authentication/scheduler/privacy owners are unchanged. Root proxy gains only capability-aware landing/private-route fences while retaining its prior mixed-host origin/auth/mutation checks. `apps/admin/proxy.ts` is untouched.

Current implementation readers in existing tests now read the actual Admin owners and shared presentation/data sources. Historical root route existence and literal static configuration checks remain separate. Obsolete root-only English/UI structure expectations were aligned to the unchanged canonical owner's current presentation; security/authentication/read-only assertions remain. The new proof freezes canonical implementations and protected boundaries independently of wrappers, and the real-handler synthetic tests exercise supported and denied requests without external provider calls.

### Exact local verification and remaining release gates

- `npm run test:architecture`: PASS (full existing command).
- `npm run test:foundation-contracts`: PASS (full existing command, including 64-owner and new remaining-structure proof).
- `npm run test:vercel`: PASS (full existing command; actual article renderer, GA analytics and consent/remount/native fallback component lifecycle, public layout/motion/LCP/redirect/crawler checks).
- Focused owner/auth/proxy/Ubersuggest/route-migration checks: **25 PASS**. Earlier expanded API/closure/audit owner checks: **37 PASS**.
- ESLint on root proxy, new critical CSS owner, canonical Ubersuggest handler and its new test: PASS. `git diff --check`: PASS.
- Full Admin suite with execution-only dependency runtime: **1,056 total, 1,021 PASS, 33 FAIL, two SKIP**. This is **NOT a full Admin pass**. The 33 remaining failures are the same isolated dependency/bootstrap categories as baseline: hermetic children clear inherited tsx resolution; native bundles cannot resolve local next-sanity/rxjs/zod; omitted pg; Neon ESM export resolution. No assertion was disabled or changed to suppress those failures. Real dependency installation, native root/Web/Admin builds, all three CI lanes, independent QA and exact UAT live acceptance are still parent-owned gates.

Execution-only local dependency invocation uses `NODE_PATH=../ccpun-ux-uat-20261008/node_modules` plus native Node registerHooks for external bare-package resolution and the installed tsx loader; no dependencies are installed/read for content/linked, and no secrets or provider mutations are involved. CI uses its normal repository dependencies, not this local resolver.

### Admin UAT port boundary

Compared all 22 modified runtime source paths between combined baseline `467c1323f2cf755a713aa747dfce27168ee4faf7` and Admin UAT `05ea8e53d22a1bdc4e3d36b2c31c603e6070ddf8`: their pre-change contents are byte-identical, including root proxy, canonical/root Ubersuggest routes and the three layouts. Adapters resolve the target branch's own canonical owners. Do not copy canonical Admin page bodies from the combined lane.

Four frozen `canonicalPreserved` proof entries differ in the target Admin lane: `apps/admin/app/(control-plane)/dashboard/inbox/page.tsx`, `dashboard/page.tsx`, `layout.tsx`, and `seo/page.tsx`. Freeze those exact target originals before port and update only those four proof hashes to the target baseline; do not rewrite their source. The target's other existing canonical differences and `apps/admin/proxy.ts` redirect308 behavior must remain. This writer does not perform the port or deploy. Production is unchanged by this partial.

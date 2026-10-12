# Production code-only preparation — 2026-10-12

Baseline is the actual live source `341aeefafdc8fee1b5e8dab013db70c535aa73ac`, on isolated `codex/code-only-production-20261012`. The remote Production branch differs from this live source; no remote merge, push or provider action is included. Source helpers come from scoped structural commits `6f9744f5` (pure Money engine), `056bc61c` (CSS/security/environment/redirect ownership), and canonical adapter definitions from `53b91a54`, after verifying each Production root/canonical pair. No full UAT branch was cherry-picked.

## Included owners and boundaries

- 48 root adapters: original 47 plus the loading entry, only where the original live root body is byte-identical to its own Production canonical app body. All 48 canonical bodies stay unchanged. Literal Next route settings stay at root; default/metadata forwarding is checked. Exact inventory is `qa/root-runtime-owner-migration.json`.
- Global foundation body moves to `components/styles/global-foundation.css`; the root/Web/Admin import bridges resolve to the same source. All original tokens, declarations, font/focus/motion/print and their order remain.
- The original 2,538-byte critical CSS is kept inline in the same head position in each of the three layouts, with one source constant. Reverse-normalizing the extraction restores each original layout byte-for-byte.
- Shared pure CSP/header and Web environment/ordered redirect owners remove repeated implementation while preserving original sealed runtime validation and root/Web-specific differences. Existing 18 frozen config output cases and exhaustive environment projection checks remain registered.
- Money Story pure state/event/debt/recovery responsibilities move to focused engine modules; CSS, rendered components, analytics calls, text, game rules, event data and character data are unchanged. Existing synthetic 12-month/recovery/debt/seed traces retain frozen output hashes.

## Explicit exclusions

All Footer/navbar/typography/spacing/UX/mock article changes, PR165/SEC/investment APIs/tools/feature availability, and canonical Admin presentation changes are excluded. The 17 divergent UAT root adapters are excluded, including Ubersuggest reviewed-import reconciliation; root proxy capability/landing changes are excluded. Production `lib/analytics.ts`, `lib/deployment-environment.ts`, root proxy, all actual app canonical bodies and menu/feature gates remain their own live versions. The eight pending literal-path changes remain untouched.

## Exact gate authority

All non-bracket writes passed the current exact development route card. The fence rejected 12 literal-path adapters as globs. Their same relative paths were explicitly approved earlier by the COO via `root-dynamic-route-owner-migration-20261011.patch`; the current COO instruction authorizes Production **code improvement only**. Parent confirmed this bounded combination covers only these same 12 adapters after independent Production byte-equality verification. No new eight-path permission is inferred; no gate rule was changed.

## Verification boundary

`qa/production-code-only-parity.json` freezes 48 canonical owners and 286 protected Production UI/CSS/SEO/tracking/auth source files, plus inverse-layout and global CSS body proof. The tests use these checked-in hashes without fetching old Git history. Existing consumer tests read canonical implementation owners while preserving assertions. Existing package scripts/dependencies remain except registering owner and release parity tests in the existing foundation group. Current local tests, line totals, independent QA and final SHA will be recorded after the candidate checks. Native builds, CI, exact-source review and live release acceptance belong to the parent. This preparation is not a deployment or a completed Production claim.


## Candidate verification and source totals

- Full `npm run test:architecture`: PASS.
- Full `npm run test:foundation-contracts`: **37 PASS**, including 96 actual Navbar DOM disclosure states, four Footer DOM variants, active stylesheet declaration/media order, Money Story presentation/events and seeded financial transitions, 18 frozen CSP/config outputs and environment/redirect results.
- Full `npm run test:vercel`: PASS, including actual Article renderer, Production layout/motion/LCP contracts, redirects, crawlers and GA consent/remount/native fallback lifecycle.
- Focused config/engine/owner/release baseline proof: **30 PASS**. Focused inventory/provider read-only tests after owner migration: **14 PASS**. Runtime/new module ESLint: PASS; diff check: PASS.
- Full local Admin rerun result is recorded below. Isolated child fixtures clear inherited runtime resolution and cannot find bare `tsx`; external execution-only dependency resolution also exposes known Neon/pg/esbuild bootstrap limits. No test is disabled, weakened or rewritten to suppress these. Final CI with repository-installed dependencies and native root/Web/Admin builds is mandatory.

Actual code-only runtime paths: **68 files**, **4,047 → 1,894 lines**, **180,878 → 73,672 raw source bytes**. This includes new focused helper modules and retained bridges; tests/fixtures/docs/package registration are counted separately. The 48 redundant root implementation bodies specifically shrink **103,503 → 3,847 raw bytes**. These are maintenance/source-size figures, not measured browser speed or bundle-size improvements. The canonical Web bundles, rendered DOM, stylesheet order, event contracts and metadata remain protected.

Provider contract is parent-observed current Production: Node24 / Next.js application / root `./` / output `apps/web/.next` / build `build` / no custom entry. This preparation changes none of the provider settings or existing build dispatcher/release-identity source. It does not import UAT's `other`/custom standalone deployment contract. Remote `v4-production` is `d07b598695e21cc7c396482272724fb2bb6d709a`, which differs from live341; importing that branch wholesale is excluded. Parent owns reviewed exact-live-source reconciliation and the pinned Production release reference.


Full local `test:admin` equivalent executed all 164 existing files: **1,026 tests / 991 PASS / 33 dependency/bootstrap FAIL / two SKIP**, real exit1. This is explicitly not a full Admin pass. Two initially exposed source-consumer mismatches were repaired without changing assertions: the API inventory keeps its legacy route ledger while inspecting only the 48 explicit canonical owners, and the templated Meta/YouTube/TikTok discovery reader points to the unchanged canonical implementations. The exact relevant tests pass14/14; every prior identity, human-only, same-origin, provider-write and payload-validation assertion remains. Source walkers now include both canonical app directories, retaining deny-only robots exceptions. Full CI and native builds remain mandatory.

Final candidate scope: **106 changed files** = 68 runtime source paths plus38 verification/report/script/package paths. The new proof explicitly verifies unfinished `features/investment-allocation`, Web tool/API routes and `lib/runtime/investment-availability.ts` remain absent. No UAT beta catalog, mock article, navigation label or styling enters this branch.


Independent QA reported GREEN on the staged code-only candidate against actual341: all48 canonical and286 protected hashes,18 actual341 config outputs, real React Footer SSR, seeded Money transition/recovery/Undo comparisons, GA/GTM lifecycle and10-step actual Meta lifecycle remain equivalent. Of1,832 pre-existing assertion calls,1,809 remain structurally identical;23 pure-builder/redirect source assertions were reviewed for unchanged meaning with complete output-parity proof. No17 divergent Admin adapters, root proxy behavior, UX/PR165/SEC source or pending-eight path entered this candidate. QA performed no source writes. Parent must verify the resulting frozen SHA in CI/build/review and the live target before claiming Production completion.

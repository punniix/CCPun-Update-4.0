# Admin Phase 1: source ownership

Baseline: actual Admin Production `c354cb4e12f20686d8384b5ba8d4e36714ef3b32`.
Owned branch: `codex/phase1-admin-source-ownership-20261012`.
Authority: current COO Phase 1 complete-course request; parent reviewed API six literal paths, UI six literal paths, and the existing SEO-review pair. Parent owns shared state, external CI and release.

## Implemented

The 30-pair ledger is `qa/phase1-admin-source-ownership-ledger.json`. Shared bodies have meaningful domain owners. Existing thin selectors retain their distinct routing contracts. The legacy SEO-review Inbox shares `SeoReviewInboxPage` with canonical `/dashboard/reviews/`; canonical LINE customer Inbox remains byte unchanged. This additional route is recorded separately from the 30 pairs.

| Source/config scope | Files | Before | After | Removed |
|---|---:|---:|---:|---:|
| API and small entry boundaries | 27 | 739 | 632 | 107 |
| Admin domain UI/layout ownership | 41 | 3,666 | 2,886 | 780 |
| Total runtime source | 68 | 4,405 | 3,518 | 887 |

These counts include 45 changed existing entries and 23 new implementation owners. Tests, frozen fixtures, reports and patches are excluded. This is source maintainability improvement, not evidence of faster deployment or smaller browser payload.

Per-lane wording, markup, metadata, dataset formatters, review destinations, permission/capability ordering, cache and failure outputs remain own c354 behavior. Canonical SEO preserves the Production owner post-publish recheck, including role/environment/queue short circuits before the article read. Root Auth exports the same direct handler objects; canonical observation retains the method receiver and exact Response/Error objects. Root schedule retains eager legacy SDK loading; canonical retains native/disabled/lazy legacy selection.

## Evidence

The original `qa/production-code-only-parity.json` remains unchanged: 48 original canonical owners, 619 protected files/assets and eight intentional variants. A reviewed composition projection admits only the 45 explicit entry changes: current entry and all actual new-owner digests are sealed, frozen original digests remain checked, and named old/current runtime fixture coverage is registered. This is a test-only composition projection, not a claim that current source bodies are byte-identical. Binary protected assets retain raw-byte hashing.

Actual fixture execution compares old/current complete markup, metadata, redirects, exception status/body/headers, call and module-initialization order, synthetic action props and private error suppression. It includes Login/Error/404/Studio/robots; Articles/SEO/detail/Calendar/Audit/Health/Settings/Dashboard; navigation/logout across roles, capabilities and lanes; UB cache/concurrent requests/errors; both scheduler lanes and invalid JSON/null inputs; Auth receiver and object identity. Domain services in scheduler/API fixtures are synthetic mocks; separate existing pure validation tests cover actual schemas, dates and policy. No real provider, workflow or customer action is invoked.

Current-source guard readers follow only actual runtime imports to reviewed owners. Tests preserve prior assertions; the SEO button binding check now explicitly links the entry render argument to the helper article ID. Negative tests reject entry, owner, original-fixture and coverage tampering, verify every new owner has an import consumer, and prove unlisted source reads actual current bytes.

Local verification: complete foundation contracts and architecture passed; current consumer assertions 32/32 passed; actual GA/Meta semantics, consent, remount and native fallback passed. Scoped lint has no errors after renaming a test-local module binding; unused-variable warnings are reported separately. Proper dependency-installed CI, actual provider build and live authenticated acceptance remain parent release gates. SWC prebundle driver, provenance guards, security, private workers, customer data, tracking implementation, dependencies and Money Story remain unchanged.

## UAT port contract

Port onto current `1f19562560e5e2de47cf643a4dbe7f27a9a91348` in a separate branch after a clean status check. Freeze UAT originals first. Keep all 73 root aliases byte-identical; extract only UAT's own canonical bodies and shared helpers. Preserve Admin 5.0 P1 callbacks, capabilities, native scheduler, jobs and redesign. Do not copy Production legacy root routes or Production UI wording into UAT. Record UAT-specific proof and rerun actual original/current outputs. Parent owns both UAT and Production deployment.

## Retained for later phases

Large Social/CRM/provider modules and browser CSS payload optimization remain Phase 2. Distinct analytics, public/Admin entry, LINE/review domains and Local AI selectors are intentional contracts, not missing shared-body extraction. No generic version factory or duplicate whole-component variant was introduced.

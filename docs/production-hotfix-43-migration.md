# Production hotfix → Website 4.3

Prepared 2026-09-05. Local implementation only; no merge, push, deployment, GTM publication or Sanity write.

## Exact baseline and ownership

- Production source: `5ec8b5b37ba780d1f0797efdcf7d337b45cb9ef6`, verified against `ccpun.com` deployment `dpl_EA17L6bhwVRTU9CjLDheqUx8xsrj`.
- Hotfix branch: `codex/production-hotfix-43-prep-20260905` in its own worktree. The cached local `v4-production` label was stale; do not substitute it for the verified SHA.
- Website 4.3 comparison snapshot: `fb915c4e1f6057d9bccaeee1345d2783746d83d5`. Recheck the active branch before integration; a passing rehearsal on this SHA does not approve a later SHA.
- Keep one hotfix lineage. Carry the hotfix commits into 4.3 once, through a separate integration branch, rather than copying files or merging the whole 4.3 branch into Production.

## Implemented changes

| Change | Owner | Preserved behavior |
|---|---|---|
| Semantic mode skips the app's second GA initialization and loader; GTM owns GA initialization | `features/analytics/components/GoogleAnalytics.tsx` | Consent updates, safe site version, LINE listener; native fallback remains available |
| Google consent commands use the canonical Arguments queue, not arrays | GA/GTM queue constructors | Default denied before GTM startup; grant/revoke behavior reaches the provider |
| A duplicate event no longer clears earlier queued events or the dedupe set | `lib/analytics.ts` | Revocation still discards pending events; event names and parameter allowlist remain unchanged |
| Move crawler infrastructure into `lib/observability/ai-crawler.ts` | Proxy imports shared infrastructure; tests/docs follow the move | Crawler implementation byte-identical; existing Admin routing unchanged |
| Load CI/FHC image generators only after download click | Existing calculator download buttons | Same local-only renderer, formulas, image content, loading/error messages and layout |

No dependencies added. `app/` remains route/composition ownership; calculator behavior stays in its feature; cross-feature image rendering stays in `lib/shared/`. Moving folders alone is not a speed improvement. Dynamic imports remove export code from the eager client graph; no claim about measured LCP improvement is made.

## GTM change still required: reviewable manual specification

The public `GTM-5DKMGSK3` resource in the Production audit showed Google tag ID 4, legacy LINE tag ID 6 and semantic GA event tag ID 27. These are runtime identifiers, not a GTM API export or an importable container. Obtain and save the current authenticated container export/version before editing; match by behavior as well as ID.

In one GTM workspace/version:

1. Keep the existing Google tag for `G-5BMX2SKJLZ` as the initialization owner. Preserve its existing consent-mode configuration; do not add another Google tag.
2. Add `line_oa_click → line_oa_click` to the existing semantic GA event-name lookup (macro 9 in the audited runtime). Keep its other mappings intact.
3. Route LINE through the existing semantic GA event tag with **all** existing conditions: `event = ccpun_event`, `event_schema_version = 1`, `analytics_consent = granted`, and a mapped event name. Include the existing allowlisted `contact_channel`, `cta_location`, `surface_group`, `site_version` parameters.
4. Pause/remove only the old GA LINE tag driven by `gtm.linkClick` and `Click URL contains lin.ee` in the same version. Do not remove shared click listeners used by unrelated tags. Do not carry forward its raw `click_url`/`click_text` payload into the semantic contract.
5. Leave Meta, calculator event mappings and consent defaults unchanged. Do not publish the workspace until Preview/Tag Assistant confirms the matrix below.

| Scenario | Expected GA LINE events |
|---|---|
| No consent / analytics denied (including social-only consent) | 0 |
| Analytics granted: navbar, mobile navbar, home hero, home contact, FHC landing, article CTA | 1 per click, correct safe surface/location |
| Repeat consent notification or component remount | No additional event without another click |
| Privacy/cookie-policy pages or calculator result contacts | No generic LINE event; keep existing calculator-specific contact events |
| Revoke analytics, then click | 0 |

Also verify one intended GA page view per actual initial/navigation view, plus CI/FHC starts, results and contacts. Local tests block provider requests and cannot prove production delivery or page-view counts. The code fix can ship independently with semantic mode enabled because the current container already initializes GA; the LINE gap remains until this GTM change is approved and published. Do not claim the LINE fix is live after deploying source alone.

Rollback: restore the prior approved GTM version as a unit if LINE routing fails; revert the GA ownership commit if the expected GTM Google tag is absent. Do not enable the native fallback as an unreviewed workaround while the same GTM GA tags still fire—it retains the legacy dual-initialization behavior. Never publish only half of the LINE cutover.

## Safe integration procedure

1. Record the final hotfix commit(s), current deployed SHA and exact current 4.3 SHA. If Production moved since the audit, review its delta before release.
2. Require clean status in a new disposable worktree based on that exact 4.3 SHA. Do not use or reset the active UAT checkout.
3. Verify ancestry with `git merge-base --is-ancestor <hotfix-commit> HEAD`; if already included, skip it. Otherwise cherry-pick only the recorded hotfix commit(s), in order, onto the integration branch. Stop on conflict; do not use blanket ours/theirs or replace whole feature directories.
4. Run `npm run check:foundation`, `node --import tsx tests/result-actions-regression.ts`, Public Web and Admin builds, and tracking QA with semantic mode matching the build. The new analytics component test is included in `test:vercel` and the foundation gate.
5. Run 4.3's responsive/visual QA at mobile, tablet and desktop widths. Check real CTA surfaces: 4.3 must preserve the existing tracking selectors or adopt an explicitly reviewed equivalent. Code application without conflicts does not prove selectors, content or visual equivalence.
6. Review the integration diff against the untouched 4.3 snapshot. Only then request review of the Preview/release unit. Production merge, GTM publish and 4.3 launch remain separate explicit actions.

## 4.3-specific launch work outside this hotfix

- Recheck the earlier snapshot-only article finding against the target 4.3 SHA: confirm approved content-provider delivery and canonical, metadata and schema contracts in the new presentation. Do not redo fixes already present in 4.3.
- Verify 4.3 LINE CTA locations, real links/buttons and calculator event contracts against the rendered page.
- Optimize oversized hero assets at their intended breakpoints after visual comparison. This hotfix makes no crop, typography or layout changes.
- Resolve any 4.3-only architecture/lint failures on the integration branch; do not weaken shared checks to accept the migration.

## Rehearsal result for the recorded 4.3 snapshot

Applied source commits `6e55325dd9d3a1da23b5b8d5e0aa41172a2df6f4` and `b90fd48ad63e8e045961f132a7961519c99513c4` to a disposable branch `codex/hotfix-43-rehearsal-20260905`. The active UAT checkout was untouched.

One conflict occurred in `tests/analytics-regression.ts`: 4.3 already had the CTA dedupe and pending-queue assertions. Resolve only that test region using the hotfix's superset (same CTA/queue assertions plus result-download dedupe and revocation coverage, with cleanup). Keep 4.3's existing nested consent/dedupe implementation in `lib/analytics.ts`; its fix is already equivalent. Do not replace the whole analytics file, which also contains 4.3 changes. The crawler source/import relocation was already present; only its missing documentation and the on-demand download imports applied.

The resolved rehearsal source commits are `822fd58` and `51d736d`. Analytics/component tests and the full foundation gate passed after resolution. This is an inspected resolution for `fb915c4`, not a universal conflict recipe for later versions.

See the accompanying task report for actual build, regression and migration-rehearsal results. Authenticated GTM delivery, Vercel Preview and final 4.3 visual UAT remain release checks.

## Release validation addendum: consent command protocol

Real GTM execution revealed that the inherited array-based `gtag` shim was ignored for consent: fresh and persisted-denied sessions created GA cookies. With the canonical Arguments command queue used in Google's [official consent integration](https://developers.google.com/tag-platform/security/guides/consent), the same container created no GA cookies while denied and received the correct consent transitions. This correction must travel with the release and with the 4.3 migration; the earlier 46-check provider-blocked test alone did not catch it.

Both queue constructors now preserve the Google Arguments protocol. The component regression asserts the raw command type and default-consent order before normalization. Browser QA adds these two contracts (48 checks). Actual GTM validation permits only its script downloads and blocks all collection endpoints before navigation; it verifies cookie state and attempted dispatch, not GA server-side collection. Existing advanced consent-mode cookieless pings are not disabled by this correction.

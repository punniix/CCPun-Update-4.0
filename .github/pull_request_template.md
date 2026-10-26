## Summary

Describe the user/business outcome and the smallest implementation that achieves it.

## Task scope

Task-ID: <!-- required for agent branches; must equal the branch task, e.g. heart-activated-at-20261023 -->
Agent: <!-- claude | codex | khai | owner -->

- [ ] This PR covers only the assigned task scope; out-of-scope findings are listed as follow-ups, not included.
- [ ] After merge/close I will run `node scripts/agent-guard.mjs cleanup --apply` and remove the head branch.

## Change type

- [ ] Feature
- [ ] Fix
- [ ] Refactor
- [ ] Performance
- [ ] SEO/content architecture
- [ ] Analytics/consent
- [ ] Infrastructure/foundation

## Production safety

- [ ] I did **not** edit `v4-production` directly.
- [ ] This change is validated on a branch / Vercel Preview before Production merge.
- [ ] This PR does **not** publish, unpublish, delete, or bulk-change Sanity Production content.
- [ ] If Sanity Production changes are intended, the exact approved action is documented below.

## SEO / URL contract

- [ ] No published slug, canonical, redirect, indexability, physical category path, robots, or sitemap ownership changed.
- [ ] OR: an explicitly approved SEO migration/indexability change is described below with redirect/canonical/sitemap/internal-link/schema coverage.
- [ ] Existing `qa/legacy-url-ledger.json` mappings remain valid unless this PR is the approved migration release.
- [ ] Search intent ownership was checked before creating a new indexable URL.

SEO/URL notes:

<!-- State "No URL contract change" or describe the approved contract change. -->

## Analytics / consent contract

- [ ] No existing production event name, GA4/GTM/Meta integration, tracking ID, or consent behavior changed.
- [ ] Application events still use the central analytics/event layer rather than ad-hoc provider calls.
- [ ] No personal, financial-input, health, or other sensitive data was added to analytics payloads.
- [ ] OR: the approved tracking contract change is documented below with migration/validation evidence.

Tracking notes:

<!-- State "No tracking contract change" or describe the approved contract change. -->

## Validation

- [ ] `npm run check:foundation`
- [ ] Relevant SEO/URL regression tests when routing/SEO changed
- [ ] Browser-level `npm run qa:tracking` when tracking/consent changed and its CDP environment is available
- [ ] Vercel Preview checked for affected user-facing routes

Preview URL:

<!-- Paste Vercel Preview URL when available. -->

## Risk and rollback

Risk:

Rollback:

## Agent completion note

- SEO URLs/canonicals changed: Yes / No
- Sanity Production written/published: Yes / No
- Analytics/consent changed: Yes / No
- User-facing UI changed: Yes / No

# CCPun Next.js Security Baseline — 2026-10-22

## Scope
All four Hostinger lanes (Web/Admin, Production/UAT) and all future development work in
punniix/CCPun-Update-4.0 must use the security baseline or newer compatible patches.
Critical upstream fixes: Next.js Oct 14 2026 advisories GHSA-673q-mjm6-r5xr,
GHSA-2464-fhr4-w9xw / CVE-2026-96889 and GHSA-p3m5-59mp-jv5r.

- Pinned baseline: next and eslint-config-next 16.4.2; react and react-dom 19.2.9.
- The shared npm lockfile must agree with root, @ccpun/web, and @ccpun/admin.
- The locked sharp must be at least 0.35.5.
- npm run check:security-baseline is mandatory before tests, merges and releases.
- predev and prebuild guard root / Web / Admin entrypoints. GitHub Actions checks all
  pushes and PRs to v4-production; treat patched-dependencies as a required check
  under GitHub branch protection/rulesets.
- Old worktrees/feature branches must rebase or merge the patched base before
  being integrated. Do not reset, rewrite or auto-upgrade other developers live worktrees.
  CI blocks unsafe dependency reintroductions but cannot force upgrades to dormant branches.
- Never deploy a moving branch implicitly. Pin the reviewed commit; validate UAT Web and
  Admin builds, identity, auth, SEO/noindex boundaries, and provider-stamped release.
  Record rollback evidence before Production promotion.
- A passed source-control gate is not proof of deployed runtime versions. Verify Hosting
  release artifact or deployment logs for each domain after every release.
- Future advisories raise the baseline with a review; the current floor is a minimum,
  not a guarantee that every future version above it is safe.

Official advisory: https://nextjs.org/blog/nextjs-security-update-october-14-2026

## Residual security work
The 2026-10-22 npm audit --omit=dev check reported 0 critical and 12 high findings,
primarily through Sanity CLI, next-sanity, glob/match dependencies and Vite.
They are outside this tightly scoped Next.js/React patch. Do not apply npm audit fix --force
or downgrade Sanity without separate UAT verification and content-publishing regression.


# Admin user-language audit — 2026-09-19

## Scope and evidence

This audit covers the current `apps/admin` control plane and its shared `features/admin` presentation components. The route inventory was generated from source, not assumed: 38 authenticated control-plane page files plus the login, controlled not-found, and Sanity Studio entry surfaces.

The reviewed surface groups are:

- Dashboard, reviews, campaigns, customer inbox, and evidence
- Content, articles, calendar, research, and Studio entry
- SEO, audits, opportunities, search analytics, and conversion analytics
- Social overview, posts, calendar, provider accounts, operations, and analytics
- LINE discovery, customer/advisor operations, privacy requests, and provider activation controls
- Operations, jobs, deployment status, local AI status, health, and audit history
- Settings, authentication, error, empty, and not-found states

## Language rule

Primary labels, instructions, warnings, and actions use ordinary Thai that a business operator can understand without development knowledge. Product and provider names such as LINE, Sanity, Neon, Vercel, Meta, Google, GA4, GSC, UAT, and SEO remain where they identify a real system. Internal identifiers, environment values, hashes, scopes, and raw states are secondary and appear under a clearly labelled technical-details disclosure where practical.

The audit does not rename database values, API contracts, journey IDs, provider fields, or exported machine-readable columns. It changes presentation copy only.

## Material changes

- Renamed navigation and page headings around user tasks rather than system architecture.
- Replaced reconciliation, desired/actual state, provider-operation, readback, rollback, and deployment jargon in primary controls with action-and-consequence wording.
- Rewrote social marketing labels and explanations into Thai, including visibility, interest, deep engagement, completeness, and data-quality warnings.
- Rewrote SEO/analytics advice so it describes searches, visits, clicks, page titles, and calls to action in ordinary terms.
- Rewrote empty, error, login, configuration, and status messages to say what happened and what the user can do next.
- Kept sensitive provider activation semantics unchanged: hold stops automatic adjustment; restore returns to the previously approved provider state.

## Verification contract

`tests/admin/admin-user-language.test.ts` guards the main navigation, LINE activation actions, social and search terminology, and placement of technical identifiers. The full Admin test suite, Admin TypeScript check, and Admin production build must pass before promotion.

Authenticated production pages cannot be visually inspected without a human Admin session. Production verification therefore uses reviewed source, regression tests, successful build/deployment evidence, public login/error boundaries, unauthenticated API fail-closed checks, and post-deploy runtime logs. A human authenticated walkthrough remains the final visual-content check for account-specific data.

## Data and provider impact

This language change performs no database migration, Sanity schema update, provider mutation, customer messaging, private-data export, or environment-variable change.

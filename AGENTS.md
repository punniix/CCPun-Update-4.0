<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CCPun Engineering Constitution

This repository powers `ccpun.com`. Treat SEO continuity, consent, analytics continuity, and production content as protected contracts rather than ordinary implementation details.

Read `docs/engineering-workflow-v1.md` before making repository-wide, SEO, analytics, Sanity, routing, or deployment changes.

Before any design, public copy, SEO metadata, asset, or CMS preview change, read and follow `docs/architecture/design-content-release-protocol.md`. This applies to AI agents, developers, designers and ChatGPT plugins. The current design remains the implementation baseline; new FigCraft colour/design prototypes require explicit owner design approval before implementation. UAT development/deployment approval does not approve a prototype or Production release.

## Repository architecture

Read `docs/architecture/repository-architecture.md` before adding significant files or features.

Runtime baseline: Public Web and Admin both use Node.js 24.x. Do not introduce Node 22-only dependencies or configuration; keep local, CI and Hostinger builds on Node 24.

Before creating a source file:

1. Identify its feature/domain owner and prefer an existing directory.
2. Keep `app/` focused on routes and composition.
3. Put feature-specific UI/logic under `features/`.
4. Put cross-feature UI under `components/` and shared infrastructure under a named `lib/` domain.
5. Do not create a new top-level directory or a second naming convention without architectural justification.
6. Do not recreate legacy paths merely because old code used them.
7. Run `npm run test:architecture` after structural changes.

Before modifying Sanity:

1. Treat schema type and field names as persisted data contracts; never rename a schema `name` casually.
2. Put editorial documents in `cms/sanity/schema/documents/`, reusable objects in `cms/sanity/schema/objects/`, and system intelligence records in `cms/sanity/admin/schema/`.
3. Preserve environment/project/dataset isolation, Article URL locks, review/publish guards, and Studio lifecycle restrictions.
4. Keep URL/taxonomy ownership in `lib/content/`, not CMS schema.
5. Never modify Production content without explicit task-specific approval.
6. Validate the schema and Admin/environment boundaries after changes.

### Production editorial routing

- `admin.ccpun.com` is the owner-facing Production editorial control plane, pinned to Sanity `kyfxgjnq/production`.
- Article Edit must preserve the logical Sanity document ID and open its Edit Intent directly; never route normal editing through generic Sanity Manage, project selection, or dataset selection.
- Website 4.2 and Admin Preview remain pinned to `ccb9lnw5/uat`. Never cross the Production and UAT lanes.

### Concurrent workstream isolation

- Production hotfixes branch from the latest `v4-production`, target `v4-production`, use a dedicated worktree, and stay narrow.
- Website 4.2 branches normally use `codex/website-42-`, Admin Preview/UAT, and `ccb9lnw5/uat`; do not stack a Production hotfix on them.
- Never reuse another active worktree, mix unrelated work in one commit, or copy a hotfix independently into every feature branch. Stop and report an unexpected cross-workstream dependency.

## 1. Delivery workflow

- Production branch: `v4-production`.
- Never edit `v4-production` directly. Work on a feature/fix/refactor branch.
- Normal path: branch -> implementation -> tests -> Pull Request -> CI -> authorized Hostinger UAT deployment -> human review -> separately authorized merge/release.
- Do not merge a PR or trigger a Production deployment unless the user explicitly asks for that action in the current task.
- Hostinger `test.ccpun.com` and `admin-test.ccpun.com` are the validation targets. Use the existing Hostinger Node.js applications via the Hostinger connector; do not deploy/promote through Vercel. `ccpun.com` is not a test environment.
- Keep changes surgical. Do not mix unrelated URL, content, analytics, and visual changes in one experiment when the effects need to be measured separately.

## 2. Environment and Sanity safety

- Production Sanity is read-only by default for agent work.
- Use Sanity UAT for drafts, schema experiments, and content experiments unless Production write/publish is explicitly approved.
- Importing or staging content is not publication.
- Never publish, unpublish, delete, bulk-migrate, or rewrite Production content unless the user explicitly asks for that exact Production action.

### Mandatory CCPun owner editorial review / publication gate

- **Every article, whether new or an optimization to an existing Published article, must be reviewed and explicitly approved by the CCPun owner before publication.** Agent completion, successful QA, `ready-for-coo`, and app `Always Allow / full_access` permissions are never publication authorization.
- **New articles and substantial rewrites:** Prepare a complete Draft, perform content/fact/SEO/compliance checks, leave it unpublished and `review.status: content-review` (or `ready-for-coo` for owner review), and show the current version to the owner. For never-published drafts keep `seo.noindex: true` and `publishedAt` unset. Never set `review.status: approved` or approval timestamps on behalf of the owner.
- **Small, narrowly scoped optimizations to existing Live articles:** The owner may review **inside the ChatGPT conversation** instead of opening Sanity Studio. Show the specific article(s) and the exact proposed before/after wording or link/metadata changes, as well as their scope. Wait for an explicit approval of the displayed changes, e.g. "โอเค โพสต์เลย" or "เสร็จแล้ว โพสต์ได้". After approval, edit/publish only those exact existing articles using revision guards and verify Live state. A subsequent different change must be shown again before publishing.
- Generic phrases ("ลุย", "ทำให้เสร็จ", "optimize ทั้งหมด") do not by themselves waive this review gate. ChatGPT's permission to execute Sanity writes is separate from the owner's editorial authorization to publish.
- Do not route reviewable changes through a different document version, change URL/canonical/indexability, or republish unrelated Drafts. Keep each publication scoped to the approved article IDs, versions, and changes.
- **Stop before any `publish_documents`, Admin Publish action, automated publication, or release** if the owner has not reviewed and expressly approved the specific version. If in doubt, ask first.

- Preserve the existing environment boundaries in `lib/admin/environment.ts`, `cms/sanity/policy/studio-policy.ts`, and their tests.
- Never commit tokens, API keys, OAuth secrets, Vercel secrets, Sanity tokens, or private credentials.

## 3. SEO and URL safety

The current physical URL structure is a stability layer. Semantic topic classification is a separate knowledge-graph layer.

- Do not assume a semantic topic must equal the physical category segment in the canonical URL.
- Do not change a published slug, canonical, redirect, category path, sitemap ownership, or indexability merely to make the URL look semantically cleaner.
- Any URL migration requires explicit approval and a coordinated release covering redirect, canonical, sitemap, internal links, schema, and regression tests.
- Check `qa/legacy-url-ledger.json`, `lib/content/url.ts`, `lib/content/taxonomy.ts`, and `cms/sanity/migration-contract.md` before touching URL ownership.
- Avoid redirect chains. Historical URLs must resolve directly to the final approved canonical destination.
- One Search Intent = One Owner. Do not create a new indexable URL when an existing owner can satisfy the same intent.
- Protect winner pages from destructive rewrites while migration signals are consolidating.
- AIA Health CI Hero is health/medical-expense insurance with critical-illness conditions/triggers. It is NOT critical-illness lump-sum insurance and must not be routed to `/ci-planning/` as a lump-sum product.
- Before UX/UI 4.2, AIA Health Happy and AIA Health CI Hero have approved final physical/canonical owners under `/blog/health-insurance/...`. Their former `/blog/life-insurance/...` paths and historical WordPress URLs must redirect directly to those Health URLs with no intermediate hop.
- Other semantic/physical exceptions may remain until separately approved; do not infer a physical URL migration from semantic topic alone.

Protected SEO surfaces include, at minimum:

- `lib/content/url.ts`
- `lib/content/taxonomy.ts`
- `qa/legacy-url-ledger.json`
- `app/robots.ts`
- `app/sitemap.xml/`
- `app/sitemaps/`
- article metadata/canonical generation
- Sanity SEO canonical/noindex controls

## 4. Analytics and consent safety

The existing application event layer and consent behavior are historical-data contracts.

- Application components should emit semantic business events through the existing analytics layer rather than calling GA4, Meta, or future ad providers directly.
- Preserve `lib/analytics.ts` as the central event/mapping boundary unless an explicitly approved migration replaces it.
- Do not bypass `trackEvent()` by adding ad-hoc `gtag`, `fbq`, or provider calls inside feature components.
- Do not disable, remove, or delay GA4/GTM/Meta/Consent functionality just to improve performance scores without explicit approval and tracking evidence.
- Consent must remain authoritative. Never emit analytics or social events that violate the stored consent state.
- Never send calculator answers, financial values, health details, names, emails, phone numbers, or other personal/sensitive data to analytics unless an explicitly reviewed data contract allows it.
- Do not silently rename existing production events. Historical continuity matters.
- Preserve the tracking/consent regression contracts in `tests/analytics-regression.ts` and `qa/tracking-consent-regression.mjs`.

Protected tracking surfaces include, at minimum:

- `lib/analytics.ts`
- `lib/cookie-consent.ts`
- `features/analytics/components/GoogleAnalytics.tsx`
- `features/analytics/components/GoogleTagManager.tsx`
- `features/analytics/components/MetaPixel.tsx`
- `features/analytics/components/CookieConsent.tsx`
- `qa/tracking-consent-regression.mjs`
- `tests/analytics-regression.ts`

## 5. Required checks

Before opening or updating a PR, run the repository checks that are available in the execution environment.

Baseline:

```bash
npm run check:foundation
```

For URL/SEO routing changes, also run the relevant URL/topic regression suite. Live Production HTTP checks must be read-only.

For analytics/consent changes, run the analytics regression suite and, when the browser/CDP test environment and required public IDs are available, `npm run qa:tracking`.

Never make a failing test pass by deleting the assertion, weakening a safety contract, disabling consent, or excluding the affected route unless the underlying contract was explicitly changed and approved.

## 6. Agent completion report

Every substantial task should report:

1. What changed and why.
2. Files/surfaces affected.
3. Tests run and their results.
4. Exact source SHA, Hostinger UAT build status and custom-domain verification when applicable.
5. Whether SEO URLs, Sanity Production, analytics, or consent changed.
6. Known risks and rollback path.

If a requested change conflicts with these rules, stop the risky part, explain the conflict, and propose the safest implementation that preserves the user's intended outcome.

## Mandatory Next.js security baseline (2026-10-22)

All new Codex/agent/developer work must start from the patched v4-production baseline and run npm run check:security-baseline before build, PR, merge or deployment. Never reintroduce Next.js below 16.4.2 or React/React DOM below 19.2.9; update all three package manifests and lockfile together. Feature worktrees based on older commits must rebase/merge the patched branch without discarding uncommitted work. See docs/architecture/nextjs-security-baseline-20261022.md. Do not deploy Production until UAT and rollback gates pass.

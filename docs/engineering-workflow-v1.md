# CCPun Engineering Workflow v1

Status: Foundation for Website 4.1 maintenance and the upcoming UX/UI 4.2 work.

Current delivery policy: Hostinger Node.js applications on Node 24. Before changing design, public text, metadata, assets or preview, follow [Design and content release protocol](architecture/design-content-release-protocol.md). Keep the current design until the owner explicitly approves a proposed prototype for implementation.

## Goal

Make every engineering change easy to review and hard to accidentally push into Production with broken SEO, tracking, consent, or content behavior.

## The simple flow

```text
User / Product decision
        |
ChatGPT or Codex Cloud
        |
feature branch
        |
implementation + tests
        |
GitHub Pull Request
        |
CCPun Foundation CI
        |
Authorized Hostinger UAT deployment
        |
human review / approval
        |
v4-production
        |
Separately authorized Hostinger Production deployment -> ccpun.com
```

GitHub is the source of truth for code. Hostinger `test.ccpun.com` and `admin-test.ccpun.com` validate branch changes. Sanity UAT validates draft/content experiments. Do not deploy or promote this repository through Vercel.

## Who does what

### Human owner

- Decides product direction and approves risky Production changes.
- Approves URL migrations, Production content publication, tracking-contract changes, and the final merge when required.

### ChatGPT

Best suited for analysis, SEO/GSC decisions, architecture, connected-data audits, small surgical changes, and cross-system validation.

### Codex Cloud

Best suited for implementation-heavy tasks, refactors, test creation, performance investigations, and multi-file engineering work.

Both agents follow the same delivery path. Neither gets a special path around GitHub, CI, Preview, SEO contracts, or consent contracts.

## Branch convention

Use one branch per coherent change. Examples:

```text
feature/health-hub
fix/blog-canonical-guard
perf/mobile-lcp-phase-2
seo/health-happy-v2
foundation/engineering-seo-tracking-20260824
ux42/article-layout
```

Do not use `v4-production` as a working branch.

## Environment boundaries

### Branch / Preview

- Code: feature branch.
- Web/Admin validation: the existing Hostinger UAT applications, using a verified immutable source ref.
- Content experiment: Sanity UAT.
- Production Sanity: read-only unless the user explicitly authorizes a Production write.

### Production

- Code branch: `v4-production`.
- Site: `https://ccpun.com`.
- Production is a release target, not a test target.

## SEO safety model

CCPun intentionally separates two concepts:

1. **Physical URL / canonical** — the stable address Google and historical links use.
2. **Semantic topic** — what the content actually means in the knowledge graph.

Those values do not have to match during a migration. A health article can remain on an approved historical `/life-insurance/` canonical path while the semantic topic, breadcrumb, and schema classify it as Health.

Before changing URL ownership, inspect:

- `qa/legacy-url-ledger.json`
- `lib/content/url.ts`
- `lib/content/taxonomy.ts`
- `cms/sanity/migration-contract.md`
- URL/topic regression tests

A URL migration is one coordinated release: redirect + canonical + sitemap + internal links + schema + tests. Do not perform these changes piecemeal.

### Search intent rule

Use **1 Search Intent = 1 Owner**.

If an existing page can answer the intent, improve that owner rather than creating another indexable URL that competes with it.

### Product semantic rule

AIA Health CI Hero is health/medical-expense insurance with critical-illness conditions/triggers. It is not CI lump-sum insurance.

## SEO controls in CMS

Normal editorial controls such as SEO title and meta description are lower-risk.

High-risk controls include:

- published slug
- canonical override
- noindex/indexability
- redirect destination
- physical category path

High-risk controls should be changed only as part of an approved migration or indexability decision with regression coverage. Do not use them for cosmetic URL cleanup.

## Tracking and consent safety model

The intended application flow is:

```text
User action
    |
semantic event / trackEvent()
    |
lib/analytics.ts
    |
consent + allowlist + mapping
    |
dataLayer / GA4 / Meta according to the current cutover mode
```

Feature components should not invent direct GA4/Meta integrations.

Hard requirements:

- Respect stored consent.
- Preserve historical event names unless a migration is approved.
- Do not send calculator inputs or personal/sensitive data.
- Do not remove tracking or consent code to improve performance metrics.
- Validate tracking changes with the existing automated contracts.

## Pull Request gate

Every PR into `v4-production` should answer four questions:

1. **Code:** Does it lint, type-check, test, and build?
2. **SEO:** Did URL/canonical/indexability/sitemap/schema behavior change?
3. **Tracking:** Did event names, provider loading, IDs, or consent behavior change?
4. **Content:** Did it write or publish anything in Sanity Production?

If the answer to SEO, Tracking, or Production Content is yes, the PR must describe the exact intended contract change and rollback path.

## Baseline check

Agents should run:

```bash
npm run check:foundation
```

GitHub CI runs the shared regression gate and read-only Production HTTP contracts where configured.

The browser-level `npm run qa:tracking` suite requires its CDP/browser test environment and public tracking IDs; run it for tracking/consent changes when that environment is available.

## Hostinger UAT review

For visual or behavior changes, validate the Preview before merging. At minimum check the affected route on a mobile and desktop viewport when the change is user-facing.

For SEO-sensitive changes, verify the rendered canonical, robots, structured data, redirect behavior, and sitemap membership that the change is expected to affect.

## Merge and rollback

Normal release:

```text
approved PR -> separately authorized merge to v4-production -> separately authorized Hostinger Production deployment
```

Rollback should prefer reverting the responsible merge/commit rather than manually editing Production into an unknown state.

Never use a second untracked Production hotfix path unless an emergency explicitly requires it.

## Definition of ready for UX/UI 4.2

The foundation is ready when:

- agents have one written safety contract (`AGENTS.md`),
- PRs have a consistent review checklist,
- the general CI gate protects code + SEO + analytics contracts,
- Hostinger UAT is the standard review target,
- Production Sanity remains protected by environment policy,
- UX/UI work can change presentation without silently changing URLs, event contracts, or consent behavior.

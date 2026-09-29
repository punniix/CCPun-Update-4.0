# CCPun Search Intent Owner Registry v1

Status: backend/QA foundation. No UX/UI 4.2 work is included.

## Purpose

CCPun uses the rule:

> 1 Search Intent = 1 Owner

The registry prevents two pages from being deliberately assigned the same search intent and provides a stable ownership contract that is independent from changing GSC/Ubersuggest metrics.

Source of truth:

`qa/search-intent-owner-registry.json`

## What the registry stores

Each reviewed intent records:

- stable `intentId`
- `primaryQuery`
- equivalent `queryVariants`
- broad `searchIntent` class
- one canonical `ownerUrl`
- `semanticTopic`
- current owner publication state
- ownership basis
- legacy migration mapping when the owner came from WordPress migration
- an optional protected semantic rule for exceptional pages

The registry intentionally does not store search volume, ranking position, clicks or impressions. Those values belong to the measurement layer and change over time.

## Seed state

v1 seeds only the five currently published CCPun article owners. Production currently has no populated `seo.focusKeyword` or `seo.searchIntent` values for these pages, so this registry is an explicit reviewed ownership contract rather than an automatic copy of CMS keyword metadata.

The owner URLs match the frozen destinations in `qa/legacy-url-ledger.json`. This prevents ownership from drifting back to legacy WordPress URLs.

## CI contract

`tests/search-intent-owner-regression.mjs` fails when:

- an `intentId` is duplicated
- the same normalized primary query or query variant appears in more than one registry entry
- an owner points outside `https://ccpun.com`
- an owner contains query/hash state
- an owner points to a legacy source URL
- a migrated owner's URL differs from the frozen migration destination
- a Semantic Topic or Search Intent class is unsupported
- the protected AIA Health CI Hero ownership/semantic rule is lost

The regression runs inside `npm run test:foundation-contracts`, so it becomes part of `npm run check:foundation` and the existing Foundation CI.

## Ownership workflow

Before creating a new SEO page or article:

1. identify the intended user question / search intent
2. normalize it against existing `primaryQuery` and `queryVariants`
3. if an owner already exists, improve/link to that owner instead of creating a competing page
4. if the intent is genuinely new, add one reviewed registry entry in the same PR that introduces the new owner
5. use GSC/Ubersuggest as evidence for the decision, but do not hard-code volatile metrics into the registry
6. require normal Preview/CI/human review before publication

A page may answer several closely related questions, but a specific normalized intent/query form must not be assigned to multiple owners.

## Semantic vs physical URL

Search-intent ownership does not imply URL migration. The registry stores the current canonical owner URL and a separate Semantic Topic.

AIA Health CI Hero remains:

- owner: `https://ccpun.com/blog/health-insurance/aia-health-ci-hero-guide/`
- Semantic Topic: `health-insurance`
- product meaning: Health / medical-expense insurance, not critical-illness lump-sum insurance

## Non-goals for v1

- no automatic keyword research
- no automatic GSC/Ubersuggest ingestion
- no AI-generated owner decisions
- no automatic article creation
- no Sanity Production writes
- no URL/canonical/redirect changes
- no changes to analytics or Consent Mode
- no Control Plane UI yet
- no UX/UI 4.2 work

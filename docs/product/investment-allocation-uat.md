# CCPun Investment Allocation Tool — UAT Product / UX / Data Handoff

Status: Preview/UAT implementation specification
Date: 2026-09-17
Production merge: **not authorized by this document**

## 1. Product boundary

CCPun Investment Allocation Tool is a planning/explanation layer. The customer defines the amount, allocation and selected funds. The tool deterministically shows what those choices imply from supported factual data.

Phase 1 must not:

- recommend, rank, score, shortlist or auto-select a fund;
- label a fund as best, top pick, suggested or best match;
- generate buy / hold / sell actions;
- infer expected return;
- convert fund Risk Spectrum into a portfolio risk score;
- use an LLM in the runtime calculation or result-generation path;
- infer an asset allocation, liquidity term or regulatory fact from a fund name when the data source is unsupported.

`selection_source` is explicitly `customer` for every selected fund.

Risk Spectrum 1–8 is displayed as a product fact layer and is not a suitability decision. Liquidity is a separate factual layer and is not treated as a return or risk proxy.

### UAT v2 journey decision

The default journey is now **Single Fund / Simple Mode**:

```text
Amount → Fund category → geography → optional AMC filter → browse active funds → customer selects fund → select share class when needed → SEC facts → Pun review
```

The original allocation builder remains available as **Multiple Funds / Advanced Mode**. This avoids forcing a customer who wants one mixed fund to construct an asset-allocation portfolio first.

Customer-facing language rule: raw integration terms and identifiers (`policy_desc`, `spec_code`, `proj_id`, endpoint names, environment labels and internal provenance codes) stay in the system/audit layer. The public UI uses plain Thai such as “กองทุนหุ้น”, “ข้อมูลจาก ก.ล.ต.” and “ขายคืนแล้วรับเงินเมื่อไร”. Fund project IDs are not shown on normal fund cards.

Fund taxonomy is derived from SEC fields, not fund-name heuristics:

- broad category: exact `policy_desc` (`ตราสารทุน`, `ผสม`, `ตราสารหนี้`, `ทรัพย์สินทางเลือก`, fallback `other`);
- geography: `invest_country_flag`;
- equity UI mapping: flag `3` → หุ้นไทย, flags `1/2` → หุ้นต่างประเทศ, flag `4` → หุ้นไทย + ต่างประเทศ;
- Money Market: SEC Fund Specification `spec_code=MM`; it remains inside the fixed-income family. A dedicated Money Market catalog filter is deferred until the ingestion cache can avoid a cold full-specification scan.

Read-only UAT observation on 2026-09-17: 4,923 active class rows (`Registered` + `IPO`) representing 2,370 unique fund projects were returned by the SEC profile API. These counts are observations for UAT validation, not permanent constants.

## 2. Audit baseline and reuse

Audited before implementation:

- `AGENTS.md`
- `docs/engineering-workflow-v1.md`
- `docs/architecture/repository-architecture.md`
- `docs/architecture/platform-data-architecture.md`
- Financial Health Check feature
- CI Planning feature
- Website 4.3 shared layout / visual tokens
- analytics and cookie-consent boundary
- Public Web / Admin runtime split
- tool sitemap and metadata patterns

Reusable surfaces used:

- `components/layout/website-43/Website43Shared.tsx`
- `components/layout/website-43/Website43Navbar.tsx`
- `components/layout/website-43/Website43.module.css`
- `components/ui/FunctionalMotion.module.css`
- `lib/analytics.ts`
- `lib/deployment-environment.ts`
- `apps/web` thin-route ownership pattern

The feature remains Public Web-owned. No new CRM, Admin runtime or database migration is introduced for UAT.

## 3. UX research synthesis — Refero

Interaction research used Refero flows:

- Award Pool Setup: editable form + live contextual summary + inline validation + disabled progression until inputs are valid.
- Monthly Award Distribution Review: explicit target-versus-actual review, plain-language status and a short progressive flow.

Patterns adopted:

1. User edits the primary values in the main panel while a compact live summary updates alongside it.
2. Invalid allocation totals remain editable; progression is disabled until a final 100% is reached.
3. Numeric inputs are the source of truth and are fully keyboard-accessible.
4. Result comparisons always include text, not just a visual indicator.
5. Complexity is progressively disclosed rather than shown as a financial dashboard.

Patterns rejected:

- copying another product's visual language;
- dense fintech dashboard layout;
- academic risk/return charts;
- efficient frontier / scatter plots;
- traffic-light colors that imply an investment is good, bad, safe or unsafe;
- recommendation badges or ranking states.

CCPun styling remains Website 4.3: Kanit, burgundy/deep surfaces, gold accent, restrained glass, existing spacing rhythm and functional motion only.

## 4. Figma-ready handoff

A Figma connector was not available in this execution session, so a new Figma file was not created. The implementation and the frame specification below are the handoff source for a later Figma parity pass; no claim is made that Figma review has already occurred.

### User flow

```text
Entry
  → Choose Single Fund (default) or Multiple Funds

Single Fund
  → Amount
  → SEC category
  → SEC-backed geography subcategory
  → Browse/search active SEC fund projects
  → Customer selects one fund (100%)
  → Select share class when required
  → Risk / raw asset allocation / subscription-redemption facts
  → Save locally or copy summary + open LINE

Multiple Funds
  → Amount + Fund Construction Allocation
  → Customer Fund Search / Selection
  → Optional Target Asset Allocation
  → Effective Allocation / Risk / Liquidity result
```

### Frames

Create each state at Desktop 1440 px and Mobile 390 px:

1. `IA / 01 Allocation / Empty`
2. `IA / 01 Allocation / Editing <100`
3. `IA / 01 Allocation / Valid 100`
4. `IA / 02 Fund Search / Empty`
5. `IA / 02 Fund Search / Loading`
6. `IA / 02 Fund Search / UAT Synthetic Results`
7. `IA / 02 Fund Search / SEC Partial Results`
8. `IA / 02 Fund Search / SEC Unavailable`
9. `IA / 02 Selection / Invalid Weight`
10. `IA / 02 Selection / Valid 100`
11. `IA / 03 Target / Unset`
12. `IA / 03 Target / Editing`
13. `IA / 03 Target / Valid 100`
14. `IA / 04 Result / Complete Data`
15. `IA / 04 Result / Unknown Coverage`
16. `IA / 04 Result / Missing Risk`
17. `IA / 04 Result / Missing Liquidity`
18. `IA / 04 Result / UAT Synthetic Warning`
19. `IA / 04 Result / Saved Locally`
20. `IA / 04 Result / Handoff Copied`

### Layout behavior

Mobile:

- one content column;
- builder first, live summary follows normal document flow;
- minimum 44 px interactive targets;
- numeric keyboard for amount / percent inputs;
- no horizontal scrolling for the Risk 1–8 rail;
- result panels stack vertically.

Desktop:

- main builder + narrower live-summary column;
- summary may be sticky when viewport permits;
- result stays readable as stacked sections instead of turning into a multi-widget dashboard.

### Core components

- Website 4.3 navbar/footer
- UAT/Product boundary badge
- Amount input
- Allocation row: name + paired percent / amount inputs (editing either updates the other)
- 100% progress / validation block
- Fund search input + search action
- Fund result card + factual badges
- Customer-selected fund row + weight input
- Optional Target Asset panel
- Effective Allocation horizontal bars
- Target vs Effective textual comparison rows
- Risk Spectrum 1–8 rail + Unknown row
- Liquidity condition cards
- Provenance / freshness block
- Factual warnings list
- Result actions

### Visual token intent

Use the existing Website 4.3 tokens from `Website43.module.css`, especially:

- `--w43-deep`
- `--w43-bg`
- `--w43-surface`
- `--w43-border`
- `--w43-gold`
- `--w43-ink`
- `--w43-muted`

Do not introduce a separate investment product palette.

## 5. Allocation model

Three concepts remain separate:

### Fund Construction Allocation

How the user intends to assemble the plan using fund categories, for example mixed / equity / fixed income / money market.

### Target Asset Allocation

The asset-level target the user may already have. It is optional. The tool never generates one for the customer.

### Effective Allocation

Asset-level contribution calculated from selected fund weights × disclosed fund asset allocation.

If a fund only discloses 60% of a usable allocation, the remaining 40% stays `unknown`. The known 60% is never renormalized to 100%.

If unknown coverage exists, Target-vs-Effective delta is marked inconclusive rather than asserting that an asset is definitively above or below target.

## 6. SEC data feasibility matrix

Only currently verified v2 paths are called. Unsupported data is not invented.

| UI field / capability | SEC v2 mapping used in UAT | Status | UAT behavior / limitation |
| --- | --- | --- | --- |
| Browse active fund catalog | `GET /v2/fund/general-info/profiles` with `fund_status=Registered` then `IPO`, `page_size=100`, `next_cursor` | Verified live | Public API returns unique fund projects through an opaque CCPun cursor instead of downloading all rows to the browser |
| Search fund | `project_info` on Profiles | Verified live | Search by project id / Thai or English project information / abbreviation supported by SEC behavior |
| Broad fund category | Profile `policy_desc` | Verified live | Exact SEC values normalized to equity / mixed / fixed income / alternative / other; never inferred from fund name |
| Domestic / foreign scope | Profile `invest_country_flag` | Verified live | Equity UI maps flag 3 to หุ้นไทย, flags 1/2 to หุ้นต่างประเทศ, flag 4 to หุ้นไทย + ต่างประเทศ |
| Money Market classification | `GET /v2/fund/general-info/specifications`, exact `spec_code=MM` | Verified live | Shown as a factual specification after selection; dedicated universe-wide filter deferred until ingestion cache removes the cold full-scan cost |
| Share classes | Profile `fund_class_*` fields | Verified live | User selects class when a project has multiple classes before class-specific dealing facts are shown |
| Risk Spectrum | `GET /v2/fund/factsheet/risk-spectrum?proj_id=...&latest=true` | Verified live | `RS1`…`RS8` displayed as levels 1–8; unsupported codes remain raw facts with a warning |
| Asset allocation | `GET /v2/fund/factsheet/asset-allocation?proj_id=...&latest=true` | Verified live | Displays raw `asset_name` / `asset_ratio` (%NAV). Negative rows are preserved and totals are never renormalized |
| Subscription / redemption timing | `GET /v2/fund/factsheet/subscription-redemption-periods?proj_id=...&latest=true` | Verified live | `period`, `redemp_period_oth`, and raw `settlement_period` are class-specific factual terms, not date guarantees |
| Master fund / feeder structure | Profile `feederfund_master_fund`, `feederfund_country` | Verified live where present | Displayed as factual profile data only |
| Fund specifications | `GET /v2/fund/general-info/specifications?proj_id=...` | Verified live | Supports facts such as Money Market / tax or structural specification codes without using name heuristics |
| Fees / minimums | SEC v2 endpoints exist and were inspected, but are not needed in the current Single Fund result | Deferred UI | Do not show until the product copy and field mapping are reviewed |
| Cut-off time | Not present in the verified dealing mapping used here | Unsupported in current UAT | Do not invent a cut-off time |
| Daily NAV | `GET /v2/fund/daily-info/nav` | Verified endpoint, not used for recommendation | No expected-return, score, or ranking logic is built from NAV |
| Source date | Factsheet `start_date` / profile `last_upd_date` | Supported | Kept separate from fetch time |
| Fetch time | Server fetch timestamp | Supported | Stored separately as `fetchedAt` |

The public consumer receives normalized CCPun planning objects only. Raw SEC payloads and subscription keys are not exposed to the browser.

## 7. SEC architecture

Target architecture remains:

```text
SEC Open API
  → ingestion
  → raw snapshot
  → normalization / entity resolution
  → planning API
  → public tool
```

Current UAT implementation:

```text
Browser
  → /api/investment-allocation/catalog      (browse/search normalized active fund projects)
  → /api/investment-allocation/detail       (selected project/class facts)
  → /api/investment-allocation/funds        (Advanced Mode compatibility)
  → server-only SEC v2 adapter + cached GETs
  → normalized CCPun planning objects
  → browser
```

Server-only key contract:

1. `SEC_API_PRIMARY_KEY`
2. fallback `SEC_API_SECONDARY_KEY`
3. sent only in `Ocp-Apim-Subscription-Key`
4. never serialized to browser output

The UAT adapter caches supported SEC GET calls and fails soft. When no key is configured, it switches to explicitly labelled synthetic UAT data.

Persistent raw snapshots are intentionally deferred in this branch because Public Web is not allowed to hold Admin/Neon write credentials. A later ingestion worker/Admin-owned capability can persist immutable snapshots without breaking the Public Web boundary.

## 8. Provenance and methodology

Every normalized fund carries:

- source (`sec_v2` or `uat_synthetic`)
- source date where supported
- fetched-at timestamp
- data state (`fresh`, `stale`, `partial`, `unavailable`, `demo`)
- snapshot references
- limitation notes

The deterministic calculation contract is versioned as:

`investment_allocation_v1`

## 9. Liquidity methodology

Normalization is intentionally conservative:

- exact `T+1` → `T+1`
- exact `T+2` → `T+2`
- exact `T+3` → `T+3`
- any other non-empty wording → `other`
- missing value → `unknown`

Examples such as `T +2`, `ภายใน 2 วันทำการ`, or platform-specific wording are not silently converted to a T+ bucket. Raw wording must be retained alongside the normalized bucket when a supported live source is introduced.

Liquidity describes the fund's disclosed condition; it is not a promise that cash will arrive on an exact date.

## 10. Risk methodology

- Risk Spectrum is distributed by selected fund weight.
- Levels 1–8 remain separate.
- Missing risk remains `unknown`.
- No averaging, weighting or conversion into a portfolio risk score.
- Risk is not translated into expected return.
- No inference that a user is suitable for a risk level is made by this public tool.

## 11. Advisor handoff contract

Future Admin transport consumes a versioned payload with:

- `plan_id`
- `investment_amount`
- `fund_construction_allocation`
- `target_asset_allocation`
- `selected_funds`
- `selected_weight_percent`
- `selection_source=customer`
- `effective_allocation`
- `risk_distribution`
- `liquidity_summary`
- `warnings`
- `sec_snapshot_ids`
- `methodology_version`
- `created_at`

UAT transport does **not** write this payload into Admin/Neon. `Save` stores it only in browser Local Storage. `Send to Pun Review` copies a human-readable summary to the clipboard and opens the CCPun LINE OA. No financial values are placed in the LINE URL.

## 12. Analytics / privacy

Analytics is consent-gated through the existing CCPun analytics layer.

Allowed Investment Allocation metadata is categorical only:

- tool name
- step number
- safe CTA location
- safe surface group
- contact channel

The allowlist deliberately discards:

- investment amount
- fund IDs
- fund names
- fund weights
- plan IDs
- target allocation values
- effective allocation values
- risk distribution values
- liquidity values

The Investment Allocation contact event is GA-only in Phase 1 and does not emit a Meta `Contact` event containing financial context.

## 13. UAT synthetic dataset

Synthetic funds are intentionally obvious and prefixed `UAT`.

They cover:

- mixed fund with complete look-through
- equity fund
- fixed-income fund
- money-market fund
- other asset fund
- partial mixed fund with 40% unknown coverage, missing risk and missing liquidity

Every synthetic record says it is **not real SEC fund data**.

### Suggested QA scenario — test data, not an investment recommendation

Use this only to exercise the UI and formulas:

- Investment amount: 500,000
- Fund construction: Mixed 40 / Equity 30 / Fixed Income 20 / Money Market 10
- Search: `UAT`
- Select the four matching UAT example funds
- Fund weights: 40 / 30 / 20 / 10
- Optional Target Asset: Equity 50 / Fixed Income 35 / Cash 15 / Other 0

Expected synthetic result:

- Effective Equity 48.8%
- Effective Fixed Income 36.8%
- Effective Cash 14.4%
- Unknown 0%
- Risk 2 = 10%, Risk 4 = 20%, Risk 5 = 40%, Risk 6 = 30%
- Liquidity T+1 = 10%, T+2 = 60%, T+3 = 30%

For the unknown-state test, set Fund Construction to Mixed 100% and choose `UAT กองข้อมูลไม่ครบตัวอย่าง` at 100%. Expected asset coverage is 60% known + 40% unknown and Target delta must be inconclusive.

## 14. QA gates

Automated UAT gates:

- exact 100% final allocation validation
- 99.99% does not pass as 100%
- percentage-to-amount math
- mixed-fund effective allocation
- unknown coverage is retained and not renormalized
- target delta becomes inconclusive with unknown coverage
- Risk Spectrum 1–8 + unknown
- conservative liquidity normalization
- construction-bucket weights match the user's construction target
- advisor payload preserves `selection_source=customer`
- analytics discards financial values / fund identifiers / weights / plan IDs
- TypeScript compilation
- repository architecture checks
- public-Web build

Manual UAT review still required before Production merge:

- mobile 390 px flow
- desktop flow
- keyboard-only use
- screen-reader labels and live validation
- reduced-motion behavior
- search loading / unavailable copy
- synthetic-data labelling clarity
- LINE clipboard handoff
- Local Storage save messaging
- real SEC data mapping after SEC key + endpoint feasibility are available
- production LCP comparison against the current Website 4.3 baseline

## 15. Production blockers / non-blockers

UAT is allowed to run with synthetic fixtures when SEC keys are absent because the UI explicitly labels the data as synthetic and does not represent it as a SEC fact.

Production activation of real fund planning remains blocked until:

1. SEC classification mapping is verified;
2. SEC asset-allocation / look-through mapping is verified;
3. liquidity / redemption fields are verified or explicitly excluded;
4. the persistent ingestion/snapshot owner is approved;
5. a compliance/legal review confirms the service boundary for the final operating model;
6. Figma parity/accessibility review is completed;
7. Preview/UAT findings are resolved.

No Production merge is included in the UAT scope.

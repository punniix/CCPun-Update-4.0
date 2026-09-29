# Marketing / Analytics / Export architecture audit — 2026-09-29

Status: **PRE-DEPLOY / SOURCE-ONLY**. This branch contains architecture fixes, tests and additive migration sources. No Admin deployment, n8n publish, Production migration, or Production merge is authorized by this receipt.

## Decision summary

The deterministic file-export boundary is correct and remains unchanged in principle:

- CSV/XLSX reads stored Admin/Neon models and is generated directly by Admin.
- Google Sheets is asynchronous orchestration through n8n.
- Provider collection and AI analysis belong to n8n + canonical Admin/Neon stores, not CSV generation.

The former 77-node `CCPun — Owner Export to Google Sheets` source graph contained two disconnected roots with no execution edge between them. Source control now prepares two graphs:

1. `owner-export-google-sheet.direct.json` — 30-node Owner Export component. The existing production workflow ID `XOQHPkio5WzZIz0l` must keep its webhook identity when an approved cutover happens.
2. `marketing-daily-ai.direct.json` — 47-node Daily collection + Weekly AI + Monthly AI + learning component. It is inactive source only and has no approved live workflow ID yet.

Weekly and Monthly AI remain together because the execution graph has a real dependency chain: Daily factual checks → Weekly analysis → Monthly analysis → learning summary. Splitting them now would require a new durable handoff/idempotency contract and would increase failure surface.

## End-to-end dependency map

```text
External providers
  GSC / GA4 / Meta / Ubersuggest
        |
        v
n8n Daily orchestration
  collection + bounded backfill + canonical identity refresh
        |
        v
Admin internal collection APIs
        |
        v
Neon canonical / immutable facts
  analytics_completed_report
  marketing_* native daily facts
  social clean mart / snapshots
  CRM / LINE business read models
  Agent Runtime Jobs
        |
        +--------------------------+
        |                          |
        v                          v
Deterministic marketing read   Other owner read models
admin_read_marketing_v3       CRM / conversion / operations
        |                          |
        v                          |
Data Quality Gate                 |
        |                          |
        +-- ready --> n8n Local AI / approved Cloud review
        |               |
        |               v
        |          deterministic evidence validation
        |               |
        |               v
        |          Neon persisted analysis
        |
        v
Admin Dashboard / stored workspace
        |
        +--> direct CSV
        +--> direct XLSX
        |
        +--> Admin Google-Sheet job
                 |
                 v
          n8n Owner Export
                 |
                 +--> internal deterministic export API
                 +--> Google Sheets owned tabs / CAS-preserved Action Plan
```

## Export Center dataset matrix

| Dataset | Source of truth | Refresh mechanism | n8n responsibility | Admin file route | Direct / async | Freshness / quality | Owner output | Legacy / duplicate notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `performance-marketing` | Neon marketing native facts + `admin_read_marketing_v3`; persisted validated analysis | Scheduled GSC/GA4 native collection, identity sync, measurements | `marketing-daily-ai.direct.json` is the prepared source boundary; current live cutover is intentionally not performed | `/api/admin/marketing/export/?format=csv&sheet=...` and `?format=xlsx` | CSV/XLSX direct; Google Sheet async | Common mature cutoff, equal-duration comparison, source health, Data Quality Gate, manifest hash, traffic anomaly check | 7 tabs: Performance Overview, Top Content, Opportunities, Content Performance, Campaign & Funnel, Action Plan, Data Notes | Owner Google Sheet remains on existing central webhook; no second active export workflow is created |
| `marketing-analytics` | Stored Analytics datasets from Neon `readAnalyticsDashboard()` | Daily provider collection | Daily collector component; Google Sheet publication uses Owner Export | `/api/admin/analytics/export/?format=csv|xlsx` plus optional analysis view | direct files; async Sheet | dataset source-as-of / collected-at / batch hash; Analytics export lineage and invalid-window checks | stored raw/report exports plus `seo-review`, `measurement-gaps`, `campaign-performance`, `marketing-activities` | no provider request during export |
| `social-performance` | Stored `social-performance` Analytics report; canonical Social mart remains richer evidence source for Performance Marketing | Daily Meta collection | Daily collector; Owner Export for Sheet | `/api/admin/exports/csv/?dataset=social-performance` | direct CSV; async Sheet | native snapshot semantics; source timestamp; owner lineage; social quality columns | stored Meta post-performance export | legacy `POST /api/admin/social/export/sheets/` still exists; current Social UI points to Export Center. Do not delete until production usage is independently proven zero |
| `seo-intelligence` | Stored Analytics SEO report assembled from stored Research + AISV/Ubersuggest evidence | stored Research/AISV refresh and Daily Ubersuggest collection where applicable | Daily collector for stored analytics; Owner Export for Sheet | `/api/admin/exports/csv/?dataset=seo-intelligence` | direct CSV; async Sheet | source window/timestamp/hash; migration scope warning; no live provider call from export | keyword research + AISV rows | `buildSeoIntelligenceExport()` is a collection-time transformer, not a second active file-export path |
| `crm-overview` | Advisor Inbox operational read model | CRM / LINE ingestion outside Marketing export | no Marketing collection dependency; Owner Export only publishes | `/api/admin/exports/csv/?dataset=crm-overview` | direct CSV; async Sheet | point-in-time deterministic read; generated-at cutoff + read-model snapshot hash | aggregate CRM counts | none identified |
| `crm-leads` | Advisor Inbox operational read model | CRM / LINE ingestion | Owner Export only publishes | `/api/admin/exports/csv/?dataset=crm-leads` | direct CSV; async Sheet | point-in-time deterministic read; source timestamps remain in rows | owner-friendly lead list | raw conversations are intentionally excluded |
| `crm-follow-ups` | Advisor Inbox operational read model | CRM / LINE ingestion | Owner Export only publishes | `/api/admin/exports/csv/?dataset=crm-follow-ups` | direct CSV; async Sheet | point-in-time deterministic read; follow-up timestamps | owner follow-up work list | none identified |
| `growth-funnel` | `readConversionAnalytics()` governed LINE/business-intelligence read model | LINE journey / business outcome ingestion | Owner Export only publishes | `/api/admin/exports/csv/?dataset=growth-funnel` | direct CSV; async Sheet | read-model `ready` gate + point-in-time lineage | lead → qualified → implementation → won/lost/revenue aggregates | separate from CI/FHC behavioral event funnel; do not mix behavioral events with confirmed outcomes |
| `customer-insights` | `readConversionAnalytics()` question frequency + content-gap model | LINE/business intelligence | Owner Export only publishes | `/api/admin/exports/csv/?dataset=customer-insights` | direct CSV; async Sheet | read-model `ready` gate + point-in-time lineage | FAQ/content-gap inputs | no AI-generated fact is substituted for missing source data |
| `automation-runs` | Agent Runtime / operations job read model | runtime job writes from Agent OS, scheduler, social systems | Owner Export only publishes | `/api/admin/exports/csv/?dataset=automation-runs` | direct CSV; async Sheet | point-in-time status / timestamps / retries | recent automation status | no workflow execution payload or secret error body is exported |

## Root-cause fixes prepared in source

### Reporting windows

The stored marketing SQL could return `currentStart > currentEnd` while merely marking `availability=no_mature_data`. The new additive window logic returns the latest mature equal-duration comparable period when the requested calendar period is not mature. The Admin read model also has a deterministic fallback guard so an invalid period does not escape to dashboard/export/AI.

### Metric semantics

Metrics now distinguish `period_activity`, `lifetime_snapshot`, and `point_in_time_snapshot`. Native Social counters are lifetime snapshots. They expose `snapshotAt`, have no fake prior/change fields, and are deduplicated from week/month Content Performance views rather than being presented as WoW/MoM activity.

### Social content identity and caption

Stored Meta reports and the Social clean mart already contain real `text_content`. The former Marketing projection reduced the title to Provider Object ID and marked every post unmapped. The additive v3 read path enriches Social assets with:

- canonical `contentEntityId` where available;
- separate `providerObjectId`;
- actual `textContent` / caption;
- `linked`, `standalone`, or `unresolved` mapping semantics;
- lifetime snapshot semantics and provenance.

A Social-native post is valid standalone content; it is not automatically `unmapped`.

### Data Quality Gate and AI boundary

`assessMarketingDataQuality()` evaluates reporting validity/comparability, freshness, snapshot semantics, denominators, content identity coverage, SEO migration context and traffic contamination evidence. AI preparation fails closed unless status is `ready`. The Admin page also suppresses current AI recommendations when Data Quality is not ready.

### SEO migration context

Search evidence is explicitly separated into:

- `current` — `ccpun.com` / `www.ccpun.com`;
- `legacy` — `blog.ccpun.com`;
- `combined` — current + legacy.

The Admin headline Search KPI is labelled with its scope. Admin and export views include current/legacy/combined breakdown rows. A mixed Search scope blocks AI decisioning until the distinction is visible; a combined decline is never automatically labelled a current-domain SEO decline.

### Traffic classification and 2026-09-16 anomaly

Traffic supports `production`, `internal`, `qa`, and `unknown`. Raw event facts are preserved. The prepared quality signal identifies the mirrored CI/FHC pattern on 2026-09-16 as `unknown` evidence rather than deleting or reclassifying it. Any selected analysis window covering an unresolved anomaly is blocked from AI decisioning.

### CI Planning / FHC funnel separation

Performance Marketing exports derive separate event-count summaries for CI Planning and FHC with Landing / Start / Complete / Completion rate, followed by raw event evidence. These remain behavioral event counts, not distinct-user cohort conversion and not confirmed leads.

### Export lineage

Performance Marketing and Analytics exports carry generated-at, cutoff, source-available-through, data-quality status, source/read-model hash, schema version, analysis version, AI analysis IDs when present, metric semantics, limitations and pipeline correlation ID when the request comes from an Agent Runtime Google-Sheet job. Direct CSV/XLSX has no fabricated pipeline ID.

Point-in-time CRM/business/operations datasets use generation time as their read cutoff and a deterministic snapshot hash. Existing detailed Analytics lineage is preserved rather than overwritten by the generic owner-export wrapper.

## Duplicate / legacy audit

1. `POST /api/admin/social/export/sheets/` + `lib/admin/social/sheets-export.ts` remains a guarded legacy direct-Google implementation. Current Social UI uses Export Center. Code-level current caller is absent, but removal is **not** approved until production usage is proven zero.
2. `buildSocialPerformanceExport()` has no current Export Center caller. It is not treated as an active export route. Keep it until the Social legacy cleanup is approved because it may still be useful as a migration/read-model transformer.
3. CSV/XLSX is intentionally **not** routed through n8n. Adding n8n to deterministic file generation would create a duplicate failure domain without adding source freshness.
4. The prepared n8n source split removes the accidental coupling between Owner Export and scheduled Marketing collection/AI. It does not create a second active Owner Export path.

## Acceptance status before deployment

| # | Acceptance criterion | Source / local status |
| ---: | --- | --- |
| 1 | Every Export Center dataset has documented lineage | **PASS** — matrix above |
| 2 | CSV/XLSX deterministic from stored canonical data | **PASS** |
| 3 | Google Sheet uses central n8n path or justified split | **PASS SOURCE** — Owner Export isolated; Daily/AI split prepared, not deployed |
| 4 | No unnecessary duplicate active export implementations | **PARTIAL GATE** — legacy Social route retained pending production-usage proof |
| 5 | No invalid reporting window | **PASS SOURCE** — equal-duration mature fallback + tests |
| 6 | Snapshot not treated as period activity | **PASS SOURCE** |
| 7 | Content Performance knows caption/text + canonical identity | **PASS SOURCE** via additive v3 read migration |
| 8 | SEO migration cannot make headline KPI misleading | **PASS SOURCE** — current/legacy/combined scope exposed and mixed scope blocks AI |
| 9 | Internal/QA traffic separable from production | **PASS SOURCE MODEL** — four-state classification + unresolved anomaly signal; raw evidence preserved |
| 10 | CI/FHC funnels separate | **PASS SOURCE** |
| 11 | AI blocked when DQ insufficient | **PASS SOURCE** |
| 12 | Every output has source/quality/freshness provenance | **PASS SOURCE** |
| 13 | Regression tests cover CSV/XLSX/Google Sheet/Admin Dashboard | **PASS LOCAL** — existing suite + dedicated integrity suite |
| 14 | Validate Production wiring before merge | **NOT RUN BY DESIGN** — deployment/runtime mutation explicitly frozen |

## Local verification receipt

- Admin TypeScript: **PASS** — npx tsc -p apps/admin/tsconfig.json --noEmit --incremental false.
- Marketing / Analytics / Export / Social / workflow regressions: **115 / 115 PASS**.
- Vercel build-routing regressions: **11 / 11 PASS**.
- Final local total: **126 / 126 tests PASS**.
- git diff --check: **PASS** before checkpoint.
- n8n source split preservation: **77 original nodes = 30 Owner Export + 47 Daily/AI**, **105 / 105 connections preserved**, **45 credential bindings preserved**.
- Only two existing n8n node definitions intentionally changed: ดึงข้อมูล Export and Marketing · อ่าน SQL Workspace, both only to pass an existing Agent Runtime correlation ID into export lineage. Their credential and error-policy bindings are unchanged.
- Both source graphs remain active: false; no live n8n workflow was created, published or activated by this work.
- No Admin deployment, Production DB migration, Production n8n mutation or merge was performed.

## Pre-deploy gates

No Production action should occur until an owner-approved release turn. At that point the sequence is:

1. Re-run full local/Admin tests and `git diff --check`.
2. Apply additive migrations in a disposable/UAT database lane and read back checksums/functions/least privilege.
3. Create the dedicated Daily/AI workflow **inactive**, bind the existing credentials, validate schedule/settings/node graph, and execute bounded manual tests.
4. Verify the existing live `XOQHPkio5WzZIz0l` workflow still owns `ccpun-owner-export-sheet` before changing its graph.
5. Coordinate the n8n cutover so the existing 06:00 schedule is never removed before its replacement exists and is verified.
6. Deploy Admin preview/UAT and validate Dashboard + CSV + XLSX + Google Sheet against the same stored facts.
7. Validate Production wiring, SHA, runtime output and Agent Runtime Job correlation.
8. Only then consider merge / Production migration / Production workflow publish.

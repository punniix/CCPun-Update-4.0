# Performance Marketing operations

Neon owns historical facts, current provider revisions, deterministic comparisons and action measurements. The existing n8n workflow XOQHPkio5WzZIz0l remains the single 77-node runtime and source-controlled workflow. It has two independent roots inside one graph: the Owner Export webhook and the 06:00 Asia/Bangkok Daily collection/AI schedule. No duplicate Daily/AI workflow is created. Admin /analytics/performance/, CSV/XLSX and the existing Google workspace use the same stored definitions. Exports never call source APIs.

## Data and reuse

Additive migrations `20260927_marketing_foundation_v1` and `20260927_marketing_local_analysis_v2` extend `ccpun_admin`. Both require exact UAT/Production identities and prerequisite checksums. Native facts retain batch/resource/report/date/grain and immutable raw hashes; latest complete coverage replaces provider keys without deleting old snapshots. Canonical assets reuse published Sanity document IDs and verified public tool routes; aliases disclose unmapped pages.

GSC page totals and query/page details remain separate. GA4 organic acquisition, native source/medium/campaign/landing acquisition and content events retain daily grain. Facebook/Instagram metrics remain native snapshots; Reach/users are not additive. Existing Ubersuggest and AI Visibility snapshots retain provenance. No fabricated historical rows, qualified conversations, costs or attribution are generated.

Historical GSC/GA4 collection uses the existing authenticated `/api/internal/marketing/refresh` route with `{ "operation": "backfill", "source": "gsc" | "ga4", "cursorEnd": "YYYY-MM-DD" }`. Each call writes at most one 56-day native-grain window and returns `nextEnd` for the next n8n call. Persist that cursor in the existing orchestration and stop on `backfillStatus` other than `continue`; `needs-review` means a provider report was omitted, truncated or failed, and `already-collected` requires manifest readback before choosing a new cursor. Never infer completeness from a successful HTTP status alone. GSC `earliestAllowedStart` is its rolling 16-month retention floor; GA4's is the current CCPun 1095-day database guard, not a claim about when tracking began. The actual first provider row and each report's gaps must be verified after backfill. Social, Ubersuggest and AI Visibility need their own native historical evidence; an older post date or CSV snapshot is not an older daily performance measurement.

Rules enforce minimum current/previous volume, complete coverage, internal CTR benchmark cohorts and source freshness. Business-calendar week/month labels use the common provider-mature cutoff; if the requested calendar period is not mature, the read model uses the latest mature equal-duration comparable period and labels that fallback explicitly. Search scope is separated into current `ccpun.com`, legacy `blog.ccpun.com`, and combined evidence so a combined decline is not presented as a current-domain decline. Lifecycle needs sufficient historical coverage. CI Planning and FHC are shown as separate Landing / Start / Complete event-count summaries while retaining raw event evidence; these are repeatable behaviors, not confirmed leads or a distinct-user cohort funnel.

## Human action and learning

Admin/Neon is the action authority. Version/CAS protects human owner/status/priority/notes/hypothesis. Execution fixes asset, metric and measurement window. Baselines remain pending until mature complete evidence, then pin once; completed equal-window pre/post observations persist with manifests and definition version. Provider revisions cannot rewrite a recorded result. Improvement after an action is observational, not proof of causation.

Google Action Plan imports only a strict human-field whitelist. Stable IDs/import keys and a final reread protect against stale versions, row movement and duplicate drafts. Refresh writes system fields only; detected conflicts preserve Action Plan while factual tabs refresh. Google collaboration has no spreadsheet-wide CAS; simultaneous editing can still race after the final reread.

## AI contract and failure boundary

`marketing-performance-v1` inputs contain period, definition versions, compact SQL evidence, sample/coverage/freshness, limitations and hashes. Full source manifests persist separately. At most sixteen evidence references enter the context; prompt/schema budget is bounded. Private owner notes and customer identities are excluded.

The existing VPS `qwen3:1.7b` worker returns Thai JSON summary and up to three interpretations with exact evidence IDs, priority, low/medium confidence and optional recommended action. The server resolves numerical evidence; numeric/currency/causal prose, unknown IDs, modified metrics, unsupported wins and unmeasured learning are rejected. Model/prompt/input hash/manifests and validation persist in Neon. AI failure preserves deterministic facts and last-good interpretation. AI cannot change campaigns, spend, publication or human decisions.

The prepared Daily/AI n8n graph exposes identity → native collect → deterministic measure → prepare → enqueue → bounded status polling → schema/evidence validate → persisted analysis. A heartbeat must prove the task version before enqueue. Private jobs stay disabled. The separate Owner Export graph publishes deterministic stored output to Google Sheets. Runtime and execution metadata remain observable without retaining raw n8n execution payloads.

## Output and verification

The fixed spreadsheet `1zpXXHuQ152wSZXdHb0yFJPVcdQiGOHvz4Yhxrmjdo-o` gains Performance Overview, Top Content, Opportunities, Content Performance, Campaign & Funnel, Action Plan and Data Notes; original tabs remain. Weekly/monthly exports use one current database snapshot with window-specific evidence. Arbitrary historical as-of replay is not promised. CSV is per dataset; XLSX contains seven readable sheets.

Runnable checks: `npm run test:admin`; exact local TypeScript for root/Admin/worker; marketing workflow Code-node tests; frozen migration rollback fixtures in exact UAT. Require exact-head CI/Preview and live Production source/workflow/worker readback, actual native ingestion, validated VPS response, dashboard/download/Sheet proof. A Ready deployment or green container alone is insufficient.

## Rollout and rollback

Apply frozen additive migrations to UAT first, read back ledger/privileges and rollback-fixture isolation, then Production after the release gate passes. Before updating the live n8n workflow, validate the full existing 77-node graph, existing credentials, single 06:00 Asia/Bangkok schedule, webhook identity and bounded manual-test behavior. Update and publish only workflow XOQHPkio5WzZIz0l after Admin/DB compatibility gates pass; never add a second scheduled workflow. Merge/deploy/Production migration remain separate gates, with exact SHA/runtime verification after Production.

Rollback restores captured prior workflow graph, known-good Admin deployment and worker SHA. Leave additive tables and immutable history in place; do not DROP facts/actions/analysis. Stop new AI enqueue if unhealthy while factual reads/exports retain their last success. Restoring Production requires the owner's authorized rollback scope.

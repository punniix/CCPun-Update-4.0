# Performance Marketing operations

Neon owns historical facts, current provider revisions, deterministic comparisons and action measurements. Existing n8n workflow `XOQHPkio5WzZIz0l` orchestrates collection, measurement, bounded VPS interpretation and publication. Admin `/analytics/performance/`, CSV/XLSX and the existing Google workspace use the same SQL definitions. Exports never call source APIs.

## Data and reuse

Additive migrations `20260927_marketing_foundation_v1` and `20260927_marketing_local_analysis_v2` extend `ccpun_admin`. Both require exact UAT/Production identities and prerequisite checksums. Native facts retain batch/resource/report/date/grain and immutable raw hashes; latest complete coverage replaces provider keys without deleting old snapshots. Canonical assets reuse published Sanity document IDs and verified public tool routes; aliases disclose unmapped pages.

GSC page totals and query/page details remain separate. GA4 organic acquisition, native source/medium/campaign/landing acquisition and content events retain daily grain. Facebook/Instagram metrics remain native snapshots; Reach/users are not additive. Existing Ubersuggest and AI Visibility snapshots retain provenance. No fabricated historical rows, qualified conversations, costs or attribution are generated.

Historical GSC/GA4 collection uses the existing authenticated `/api/internal/marketing/refresh` route with `{ "operation": "backfill", "source": "gsc" | "ga4", "cursorEnd": "YYYY-MM-DD" }`. Each call writes at most one 56-day native-grain window and returns `nextEnd` for the next n8n call. Persist that cursor in the existing orchestration and stop on `backfillStatus` other than `continue`; `needs-review` means a provider report was omitted, truncated or failed, and `already-collected` requires manifest readback before choosing a new cursor. Never infer completeness from a successful HTTP status alone. GSC `earliestAllowedStart` is its rolling 16-month retention floor; GA4's is the current CCPun 1095-day database guard, not a claim about when tracking began. The actual first provider row and each report's gaps must be verified after backfill. Social, Ubersuggest and AI Visibility need their own native historical evidence; an older post date or CSV snapshot is not an older daily performance measurement.

Rules enforce minimum current/previous volume, complete coverage, internal CTR benchmark cohorts and source freshness. Business-calendar week/month labels use the common provider-mature cutoff; incomplete new calendar windows wait. Lifecycle needs sufficient historical coverage. CI/FHC/LINE actions are repeatable behavior, not confirmed leads or a cohort conversion funnel.

## Human action and learning

Admin/Neon is the action authority. Version/CAS protects human owner/status/priority/notes/hypothesis. Execution fixes asset, metric and measurement window. Baselines remain pending until mature complete evidence, then pin once; completed equal-window pre/post observations persist with manifests and definition version. Provider revisions cannot rewrite a recorded result. Improvement after an action is observational, not proof of causation.

Google Action Plan imports only a strict human-field whitelist. Stable IDs/import keys and a final reread protect against stale versions, row movement and duplicate drafts. Refresh writes system fields only; detected conflicts preserve Action Plan while factual tabs refresh. Google collaboration has no spreadsheet-wide CAS; simultaneous editing can still race after the final reread.

## AI contract and failure boundary

`marketing-performance-v1` inputs contain period, definition versions, compact SQL evidence, sample/coverage/freshness, limitations and hashes. Full source manifests persist separately. At most sixteen evidence references enter the context; prompt/schema budget is bounded. Private owner notes and customer identities are excluded.

The existing VPS `qwen3:1.7b` worker returns Thai JSON summary and up to three interpretations with exact evidence IDs, priority, low/medium confidence and optional recommended action. The server resolves numerical evidence; numeric/currency/causal prose, unknown IDs, modified metrics, unsupported wins and unmeasured learning are rejected. Model/prompt/input hash/manifests and validation persist in Neon. AI failure preserves deterministic facts and last-good interpretation. AI cannot change campaigns, spend, publication or human decisions.

n8n exposes identity → native collect → deterministic measure → prepare → enqueue → bounded status polling → schema/evidence validate → publish. A heartbeat must prove the new task version before enqueue. Private jobs stay disabled. Runtime and execution metadata remain observable without retaining raw n8n execution payloads.

## Output and verification

The fixed spreadsheet `1zpXXHuQ152wSZXdHb0yFJPVcdQiGOHvz4Yhxrmjdo-o` gains Performance Overview, Top Content, Opportunities, Content Performance, Campaign & Funnel, Action Plan and Data Notes; original tabs remain. Weekly/monthly exports use one current database snapshot with window-specific evidence. Arbitrary historical as-of replay is not promised. CSV is per dataset; XLSX contains seven readable sheets.

Runnable checks: `npm run test:admin`; exact local TypeScript for root/Admin/worker; marketing workflow Code-node tests; frozen migration rollback fixtures in exact UAT. Require exact-head CI/Preview and live Production source/workflow/worker readback, actual native ingestion, validated VPS response, dashboard/download/Sheet proof. A Ready deployment or green container alone is insufficient.

## Rollout and rollback

Apply frozen additive migrations to UAT first, read back ledger/privileges and rollback-fixture isolation, then Production. Merge the checked PR; verify Admin custom-domain SHA. Pin/recreate only the existing worker; retain Ollama/n8n/OCR/proxy and credential references. Update/publish only the existing workflow after source readiness, then bounded Daily/backfill and exports. Record source earliest observed date, omissions/truncation and coverage; collection since platform inception requires provider evidence.

Rollback restores captured prior workflow graph, known-good Admin deployment and worker SHA. Leave additive tables and immutable history in place; do not DROP facts/actions/analysis. Stop new AI enqueue if unhealthy while factual reads/exports retain their last success. Restoring Production requires the owner's authorized rollback scope.

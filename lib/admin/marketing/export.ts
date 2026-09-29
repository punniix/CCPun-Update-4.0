import type { MarketingDashboard, MarketingManifest } from "./model";
import type { MarketingAnalysisView, MarketingAnalysisRecord } from "./analysis";
import { MARKETING_AI_DATA_NOTE, MARKETING_AI_SUMMARY, marketingAiEvidenceGuidance } from "./presentation";
import { workbookExportXlsx, type WorkbookCell } from "../analytics/export";
import { ownerDatasetToCsv } from "../agent-os/export-csv";
import { createHash } from "node:crypto";
import { PERFORMANCE_MARKETING_TABS } from "../agent-os/export-contract";
import { assessMarketingDataQuality, marketingMigrationContext, marketingSeoScopeBreakdown, marketingSourceManifestHash, type MarketingDataQualityStatus } from "./quality";

export const MARKETING_SHEET_TITLES = PERFORMANCE_MARKETING_TABS;
export type MarketingSheetTitle = typeof MARKETING_SHEET_TITLES[number];
export type MarketingWorkspaceSheet = { title: MarketingSheetTitle; columns: string[]; rows: Record<string, WorkbookCell>[]; ownership: "system" | "human-managed" };
export type MarketingWorkspaceLineage = { generatedAt: string; cutoff: string; sourceDataAvailableThrough: string | null; dataQualityStatus: MarketingDataQualityStatus; sourceManifestHash: string; modelSchemaVersion: "marketing-workspace-v1"; analysisVersion: string | null; aiAnalysisIds: string[]; pipelineCorrelationId: string | null; metricSemantics: Array<"period_activity" | "lifetime_snapshot" | "point_in_time_snapshot">; limitations: string[] };
export type MarketingWorkspace = { version: "marketing-workspace-v1"; generatedAt: string; sheets: MarketingWorkspaceSheet[]; sourceManifest: MarketingManifest[]; analysisStatus: "unavailable" | "ready" | "stale"; actionAuthority: "Admin/Neon"; dataQualityStatus: MarketingDataQualityStatus; lineage: MarketingWorkspaceLineage };

const numberOrBlank = (value: number | null) => value;
function definedWorkbookRows(rows: Record<string, WorkbookCell | undefined>[]): Record<string, WorkbookCell>[] {
  return rows.map(row => {
    const defined: Record<string, WorkbookCell> = {};
    for (const [column, value] of Object.entries(row)) if (value !== undefined) defined[column] = value;
    return defined;
  });
}
const metricSemantics = (metric: MarketingDashboard["kpis"][number]) => metric.metricSemantics ?? (metric.metric.startsWith("social_") || metric.coverageStatus === "native_snapshot_not_period_activity" ? "lifetime_snapshot" : "period_activity");
const metricRow = (model: MarketingDashboard, metric: MarketingDashboard["kpis"][number]) => { const semantics=metricSemantics(metric),snapshot=semantics!=="period_activity",seoScope=metric.metric.startsWith("search_")?marketingMigrationContext(model):null; return ({ "ช่วง": snapshot ? "snapshot" : model.window.key, "ข้อมูลช่วงนี้": model.window.availability ?? "mature_data", "เริ่ม": snapshot ? null : model.window.currentStart, "สิ้นสุด": snapshot ? null : model.window.currentEnd, "ช่วงเทียบเริ่ม": snapshot ? null : model.window.previousStart, "ช่วงเทียบสิ้นสุด": snapshot ? null : model.window.previousEnd, "Metric semantics": semantics, "Snapshot ณ": metric.snapshotAt ?? null, "SEO scope": seoScope, "ตัวชี้วัด": metric.metric, "ปัจจุบัน": numberOrBlank(metric.current), "ก่อนหน้า": snapshot ? null : numberOrBlank(metric.previous), "ต่างกัน": snapshot ? null : metric.absoluteChange, "เปลี่ยนแปลง (%)": snapshot ? null : metric.percentageChange, "หน่วย": metric.unit, "ปริมาณข้อมูล": metric.sampleStatus, "เกณฑ์ปริมาณ": metric.threshold, "ประวัติ/ความครบ": metric.coverageStatus, "ความสด": metric.freshnessStatus, "หลักฐาน": metric.evidenceRef }); };
function workspaceManifest(models: MarketingDashboard[]): MarketingManifest[] {
  const entries = new Map<string, MarketingManifest>();
  for (const model of models) for (const entry of model.manifest) {
    const key = `${entry.batchId}:${entry.report}`, previous = entries.get(key);
    if (previous && previous.rawHash !== entry.rawHash) throw new Error("MARKETING_SOURCE_MANIFEST_CHANGED");
    if (!previous) entries.set(key, entry);
  }
  return [...entries.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, entry]) => entry);
}

function funnelCount(model: MarketingDashboard, names: string[]) {
  const matches = model.funnel.steps.filter(step => names.includes(step.event));
  if (!matches.length || matches.some(step => step.count === null)) return null;
  return matches.reduce((sum, step) => sum + (step.count ?? 0), 0);
}

function funnelSummaryRows(model: MarketingDashboard): Record<string, WorkbookCell>[] {
  return [
    { tool: "CI Planning", landing: ["ci_landing_view"], start: ["ci_calculator_start"], complete: ["ci_calculator_complete"] },
    { tool: "FHC", landing: ["fhc_landing_view"], start: ["fhc_start", "fhc_calculator_start"], complete: ["fhc_complete", "fhc_calculator_complete"] },
  ].map(definition => {
    const landing = funnelCount(model, definition.landing);
    const start = funnelCount(model, definition.start);
    const complete = funnelCount(model, definition.complete);
    return {
      "ช่วง": model.window.key,
      "เริ่ม": model.window.currentStart,
      "สิ้นสุด": model.window.currentEnd,
      "ชนิด": "tool-funnel",
      "เครื่องมือ": definition.tool,
      "Landing": landing,
      "Start": start,
      "Complete": complete,
      "Completion rate (%)": start && complete !== null ? Math.round(complete * 10_000 / start) / 100 : null,
      "สถานะ": landing === null || start === null || complete === null ? "insufficient_data" : "ready",
      "Denominator": "Start",
      "ข้อจำกัด": "Event-count funnel per tool; repeatable activity, not distinct-user cohort conversion. Raw event evidence remains below.",
    };
  });
}

export function buildMarketingWorkspace(weekly: MarketingDashboard, monthly: MarketingDashboard, analyses: Partial<Record<"this_week" | "this_month", MarketingAnalysisView>> = {}, lineageContext: { pipelineCorrelationId?: string | null } = {}): MarketingWorkspace {
  if (weekly.state !== "ready" || monthly.state !== "ready") throw new Error("MARKETING_STORED_DATA_UNAVAILABLE");
  if (weekly.window.key !== "this_week" || monthly.window.key !== "this_month") throw new Error("MARKETING_WORKSPACE_WINDOWS_INVALID");
  const cutoff = Date.parse(weekly.generatedAt);
  if (!Number.isFinite(cutoff) || cutoff !== Date.parse(monthly.generatedAt) || weekly.window.currentEnd !== monthly.window.currentEnd) throw new Error("MARKETING_WORKSPACE_CUTOFF_CHANGED");

  const models = [weekly, monthly], generatedAt = weekly.generatedAt, sourceManifest = workspaceManifest(models);
  const qualityByWindow = models.map(model => ({ model, quality: assessMarketingDataQuality(model) }));
  const qualityRank: Record<MarketingDataQualityStatus, number> = { ready: 0, stale: 1, insufficient_data: 2, blocked_by_data_quality: 3 };
  const dataQualityStatus = qualityByWindow.map(item => item.quality.status).sort((a, b) => qualityRank[b] - qualityRank[a])[0] ?? "insufficient_data";

  const selectedAnalyses = models.flatMap(model => {
    const view = analyses[model.window.key as "this_week" | "this_month"];
    const record = view?.latest && ["ready", "stale"].includes(view.latest.status) && view.latest.output ? view.latest : view?.lastGood && ["ready", "stale"].includes(view.lastGood.status) && view.lastGood.output ? view.lastGood : null;
    if (!record?.output) return [];
    const stale = record.status === "stale" || view?.latest?.analysisId !== record.analysisId || record.period.currentStart !== model.window.currentStart || record.period.currentEnd !== model.window.currentEnd || JSON.stringify(record.sourceManifest.map(m => [m.batchId, m.rawHash]).sort()) !== JSON.stringify(model.manifest.map(m => [m.batchId, m.rawHash]).sort());
    return [{ model, record, stale }];
  });
  const analysisStatus = selectedAnalyses.length === models.length && selectedAnalyses.every(item => !item.stale) ? "ready" : selectedAnalyses.length ? "stale" : "unavailable";
  const aiProvider = (record: MarketingAnalysisRecord) => record.inferenceProvider === "openai" ? "OpenAI API" : "Local AI";
  const aiFindings = (record: MarketingAnalysisRecord) => record.output ? [...record.output.wins, ...record.output.risks, ...record.output.opportunities, ...record.output.watchItems] : [];
  const aiAssetText = (window: string, assetId: string) => selectedAnalyses.filter(item => item.model.window.key === window).flatMap(item => aiFindings(item.record).filter(finding => finding.evidence.some(e => e.assetId === assetId)).map(finding => `${item.stale ? "STALE · " : ""}${item.record.period.currentStart}–${item.record.period.currentEnd}: ${marketingAiEvidenceGuidance(finding)}; ${finding.action ?? "monitor"}; confidence=${finding.confidence}`)).join(" | ");

  const overviewColumns = ["ช่วง", "ข้อมูลช่วงนี้", "เริ่ม", "สิ้นสุด", "ช่วงเทียบเริ่ม", "ช่วงเทียบสิ้นสุด", "Metric semantics", "Snapshot ณ", "SEO scope", "ตัวชี้วัด", "ปัจจุบัน", "ก่อนหน้า", "ต่างกัน", "เปลี่ยนแปลง (%)", "หน่วย", "ปริมาณข้อมูล", "เกณฑ์ปริมาณ", "ประวัติ/ความครบ", "ความสด", "หลักฐาน", "AI สมมติฐาน", "AI สถานะ", "AI ณ", "AI Model", "AI Prompt", "AI Input Hash", "AI รอบล่าสุด"];
  const seoScopeRows = models.flatMap(model => marketingSeoScopeBreakdown(model).map(scope => {
    const absoluteChange = scope.current !== null && scope.previous !== null ? scope.current - scope.previous : null;
    const percentageChange = scope.current !== null && scope.previous !== null && scope.previous > 0 ? Math.round((scope.current - scope.previous) * 10000 / scope.previous) / 100 : null;
    return { "ช่วง": model.window.key, "ข้อมูลช่วงนี้": model.window.availability ?? "mature_data", "เริ่ม": model.window.currentStart, "สิ้นสุด": model.window.currentEnd, "ช่วงเทียบเริ่ม": model.window.previousStart, "ช่วงเทียบสิ้นสุด": model.window.previousEnd, "Metric semantics": "period_activity", "Snapshot ณ": null, "SEO scope": scope.scope, "ตัวชี้วัด": scope.metric + " · " + scope.scope, "ปัจจุบัน": scope.current, "ก่อนหน้า": scope.previous, "ต่างกัน": absoluteChange, "เปลี่ยนแปลง (%)": percentageChange, "หน่วย": scope.metric === "search_clicks" ? "clicks" : "impressions", "ปริมาณข้อมูล": "scope_breakdown", "เกณฑ์ปริมาณ": null, "ประวัติ/ความครบ": "derived_from_content_facts", "ความสด": "see_source_health", "หลักฐาน": "seo-scope:" + scope.scope + ":" + scope.metric };
  }));
  const contentRows = models.flatMap(model => model.leaderboards.flatMap(board => board.rows.map(row => ({
    ...metricRow(model, row),
    "อันดับ": row.rank,
    "Leaderboard": board.title,
    "จัดอันดับตาม": board.basis,
    "แพลตฟอร์ม": board.platform,
    "Content Entity ID": row.contentEntityId ?? row.assetId,
    "Content ID": row.assetId,
    "Provider Object ID": row.providerObjectId ?? null,
    "เนื้อหา": row.textContent ?? row.title,
    "URL": row.url,
    "หมวด": row.category,
    "Lifecycle": row.lifecycle,
    "Mapping": row.mappingStatus,
    "เผยแพร่": row.publishedAt,
    "AI สมมติฐาน": aiAssetText(model.window.key, row.assetId),
  }))));

  const contentMetrics = [...new Set(models.flatMap(model => model.contentPerformance.flatMap(asset => asset.metrics.map(metric => metric.metric))))];
  const contentMetricColumns = contentMetrics.flatMap(metric => ["ปัจจุบัน", "ก่อนหน้า", "ต่างกัน", "เปลี่ยนแปลง (%)", "หน่วย", "ปริมาณข้อมูล", "ประวัติ/ความครบ", "ความสด", "หลักฐาน"].map(label => `${metric} · ${label}`));
  const snapshotAssets = new Set<string>();
  const allContentRows = models.flatMap(model => model.contentPerformance.flatMap(asset => {
    const semantics = [...new Set(asset.metrics.map(metricSemantics))];
    const snapshotOnly = semantics.length > 0 && semantics.every(value => value !== "period_activity");
    const identity = asset.contentEntityId ?? asset.assetId;
    if (snapshotOnly && snapshotAssets.has(identity)) return [];
    if (snapshotOnly) snapshotAssets.add(identity);
    const row: Record<string, WorkbookCell> = {
      "ช่วง": snapshotOnly ? "snapshot" : model.window.key,
      "เริ่ม": snapshotOnly ? null : model.window.currentStart,
      "สิ้นสุด": snapshotOnly ? null : model.window.currentEnd,
      "Metric semantics": semantics.join(" | "),
      "Snapshot ณ": asset.metrics.map(metric => metric.snapshotAt).filter(Boolean).sort().at(-1) ?? null,
      "Content Entity ID": identity,
      "Content ID": asset.assetId,
      "Provider Object ID": asset.providerObjectId ?? null,
      "URL": asset.url,
      "เนื้อหา": asset.textContent ?? asset.title,
      "หมวด": asset.category,
      "Topic": asset.topic,
      "Lifecycle": asset.lifecycle,
      "เผยแพร่": asset.publishedAt,
      "Mapping": asset.mappingStatus,
    };
    for (const metric of asset.metrics) {
      const values = metricRow(model, metric);
      for (const label of ["ปัจจุบัน", "ก่อนหน้า", "ต่างกัน", "เปลี่ยนแปลง (%)", "หน่วย", "ปริมาณข้อมูล", "ประวัติ/ความครบ", "ความสด", "หลักฐาน"] as const) row[`${metric.metric} · ${label}`] = values[label];
    }
    return [row];
  }));

  const actions = monthly.actions;
  const draftSet = createHash("sha256").update(actions.map(action => action.id).sort().join("|")).digest("hex").slice(0, 16);
  const actionColumns = ["id", "version", "assetId", "priority", "actionType", "description", "expectedMetric", "owner", "status", "executedAt", "measurementDays", "notes", "hypothesis", "confounderNotes", "importKey", "createdAt", "updatedAt", "baseline", "result", "absoluteChange", "percentageChange", "outcome", "measurementStatus"];
  const actionRows: Record<string, WorkbookCell>[] = [
    ...actions.map(action => ({ ...action, importKey: `action:${action.id}` })),
    ...[1, 2, 3].map(slot => ({ id: null, version: 0, assetId: null, priority: "medium", actionType: "investigation", description: "", expectedMetric: "organic_sessions", owner: "", status: "backlog", executedAt: null, measurementDays: 14, notes: "", hypothesis: "", confounderNotes: "", importKey: `draft:${draftSet}:${slot}` })),
  ];

  const sourceDataAvailableThrough = sourceManifest.map(item => item.sourceAsOf).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const lineage: MarketingWorkspaceLineage = {
    generatedAt,
    cutoff: generatedAt,
    sourceDataAvailableThrough,
    dataQualityStatus,
    sourceManifestHash: marketingSourceManifestHash(sourceManifest),
    modelSchemaVersion: "marketing-workspace-v1",
    analysisVersion: [...new Set(selectedAnalyses.map(item => item.record.promptVersion))].join(" | ") || null,
    aiAnalysisIds: selectedAnalyses.map(item => item.record.analysisId),
    pipelineCorrelationId: lineageContext.pipelineCorrelationId ?? null,
    metricSemantics: [...new Set(models.flatMap(model => [...model.kpis, ...model.contentPerformance.flatMap(asset => asset.metrics)].map(metricSemantics)))],
    limitations: [...new Set(qualityByWindow.flatMap(item => item.quality.limitations))],
  };

  return {
    version: "marketing-workspace-v1",
    generatedAt,
    sourceManifest,
    analysisStatus,
    actionAuthority: "Admin/Neon",
    dataQualityStatus,
    lineage,
    sheets: [
      { title: "Performance Overview", ownership: "system", columns: overviewColumns, rows: [...models.flatMap(model => model.kpis.map(metric => metricRow(model, metric))), ...seoScopeRows, ...selectedAnalyses.map(({ model, record, stale }) => ({ "ช่วง": model.window.key, "เริ่ม": record.period.currentStart, "สิ้นสุด": record.period.currentEnd, "ตัวชี้วัด": `${aiProvider(record)} · สมมติฐานที่ต้องตรวจทาน`, "AI สมมติฐาน": MARKETING_AI_SUMMARY, "AI สถานะ": stale ? "stale" : "ready", "AI ณ": record.completedAt ?? record.createdAt, "AI Model": `${aiProvider(record)} / ${record.modelName ?? "unknown"}`, "AI Prompt": record.promptVersion, "AI Input Hash": record.inputHash, "AI รอบล่าสุด": analyses[model.window.key as "this_week" | "this_month"]?.latest?.status ?? "unavailable" }))] },
      { title: "Top Content", ownership: "system", columns: ["ช่วง", "Leaderboard", "จัดอันดับตาม", "แพลตฟอร์ม", "อันดับ", "Content Entity ID", "Content ID", "Provider Object ID", "เนื้อหา", "หมวด", "Metric semantics", "Snapshot ณ", "ตัวชี้วัด", "ปัจจุบัน", "ก่อนหน้า", "ต่างกัน", "เปลี่ยนแปลง (%)", "หน่วย", "ปริมาณข้อมูล", "ประวัติ/ความครบ", "ความสด", "Mapping", "เริ่ม", "สิ้นสุด", "หลักฐาน", "AI สมมติฐาน"], rows: contentRows },
      { title: "Opportunities", ownership: "system", columns: ["ช่วง", "Opportunity ID", "ความสำคัญระบบ", "ด้าน", "Content ID", "โอกาส", "เหตุผลจากกติกา", "ขั้นถัดไป", "ความเชื่อมั่น", "หลักฐาน", "Owner/Status", "AI สมมติฐาน"], rows: [...models.flatMap(model => model.opportunities.map(item => ({ "ช่วง": model.window.key, "Opportunity ID": item.id, "ความสำคัญระบบ": item.priority, "ด้าน": item.area, "Content ID": item.assetId, "โอกาส": item.title, "เหตุผลจากกติกา": item.reason, "ขั้นถัดไป": item.recommendedAction, "ความเชื่อมั่น": item.confidence, "หลักฐาน": item.evidenceRefs.join(" | "), "Owner/Status": "จัดการใน Admin Action Plan; refresh ไม่เปลี่ยนงานมนุษย์", "AI สมมติฐาน": item.assetId ? aiAssetText(model.window.key, item.assetId) : "" }))), ...selectedAnalyses.flatMap(({ model, record, stale }) => record.output!.recommendedActions.map(finding => ({ "ช่วง": model.window.key, "Opportunity ID": `${record.analysisId}:${finding.id}`, "ความสำคัญระบบ": finding.priority, "ด้าน": `${aiProvider(record)} · สมมติฐานที่ต้องตรวจทาน`, "Content ID": finding.evidence.map(e => e.assetId).filter(Boolean).join(" | "), "โอกาส": finding.type, "เหตุผลจากกติกา": null, "ขั้นถัดไป": finding.action, "ความเชื่อมั่น": finding.confidence, "หลักฐาน": finding.evidence.map(e => e.evidenceRef).join(" | "), "Owner/Status": "มนุษย์เลือกและลงมือใน Action Plan", "AI สมมติฐาน": `${stale ? "STALE · " : ""}${record.period.currentStart}–${record.period.currentEnd}: ${marketingAiEvidenceGuidance(finding)}` })))] },
      { title: "Content Performance", ownership: "system", columns: ["ช่วง", "เริ่ม", "สิ้นสุด", "Metric semantics", "Snapshot ณ", "Content Entity ID", "Content ID", "Provider Object ID", "URL", "เนื้อหา", "หมวด", "Topic", "Lifecycle", "เผยแพร่", "Mapping", ...contentMetricColumns], rows: allContentRows },
      { title: "Campaign & Funnel", ownership: "system", columns: ["ช่วง", "เริ่ม", "สิ้นสุด", "ชนิด", "เครื่องมือ", "Landing", "Start", "Complete", "Completion rate (%)", "Source / Medium", "Campaign", "Landing URL", "Content ID", "Sessions", "Engaged Sessions", "Key Events", "Event", "จำนวน event", "สถานะ", "Denominator", "ข้อจำกัด"], rows: models.flatMap(model => [
        ...model.campaigns.map(campaign => ({ "ช่วง": model.window.key, "เริ่ม": campaign.periodStart, "สิ้นสุด": campaign.periodEnd, "ชนิด": "acquisition", "Source / Medium": campaign.sourceMedium, "Campaign": campaign.campaign, "Landing URL": campaign.landingUrl, "Content ID": campaign.assetId, "Sessions": campaign.sessions, "Engaged Sessions": campaign.engagedSessions, "Key Events": campaign.keyEvents, "สถานะ": campaign.coverageStatus, "Denominator": null, "ข้อจำกัด": "Session-scoped acquisition; keyEvents ไม่ใช่ leads และยังไม่ผูก activity counts เป็น cohort funnel/attribution" })),
        ...funnelSummaryRows(model),
        ...model.funnel.steps.map(step => ({ "ช่วง": model.window.key, "เริ่ม": model.window.currentStart, "สิ้นสุด": model.window.currentEnd, "ชนิด": "activity-evidence", "Event": step.event, "จำนวน event": step.count, "สถานะ": step.status, "Denominator": null, "ข้อจำกัด": model.funnel.limitation })),
      ]) },
      { title: "Action Plan", ownership: "human-managed", columns: actionColumns, rows: actionRows },
      { title: "Data Notes", ownership: "system", columns: ["หัวข้อ", "รายงาน", "รายละเอียด", "ต้นทาง ณ", "รับเข้าคลัง", "เริ่ม", "สิ้นสุด", "Timezone", "Batch ID", "Raw SHA256"], rows: definedWorkbookRows([
        { "หัวข้อ": "Lineage", "รายงาน": "workspace", "รายละเอียด": `generated_at=${lineage.generatedAt}; cutoff=${lineage.cutoff}; source_through=${lineage.sourceDataAvailableThrough ?? "unknown"}; quality=${lineage.dataQualityStatus}; manifest_sha256=${lineage.sourceManifestHash}; schema=${lineage.modelSchemaVersion}; analysis=${lineage.analysisVersion ?? "none"}; ai_analysis_ids=${lineage.aiAnalysisIds.join("|") || "none"}; pipeline_correlation_id=${lineage.pipelineCorrelationId ?? "not-recorded"}; semantics=${lineage.metricSemantics.join("|")}` },
        ...qualityByWindow.map(({ model, quality }) => ({ "หัวข้อ": "Data Quality Gate", "รายงาน": model.window.key, "รายละเอียด": `status=${quality.status}; comparable=${quality.comparablePeriods}; freshness=${quality.freshness}; snapshot_semantics=${quality.snapshotSemanticsValid}; denominator=${quality.denominatorAvailability}; identity_coverage=${quality.identityCoverage ?? "n/a"}; migration=${quality.migrationContext}; traffic=${quality.trafficClassification}; ${quality.limitations.join(" | ")}`, "เริ่ม": model.window.currentStart, "สิ้นสุด": model.window.currentEnd })),
        { "หัวข้อ": "วิธีใช้", "รายงาน": "workspace", "รายละเอียด": "Top Content แยก period activity ออกจาก native snapshot; Content Performance ใช้ canonical content identity และไม่ตีความ lifetime snapshot เป็น WoW/MoM; ค่าว่างไม่ใช่ศูนย์" },
        { "หัวข้อ": "North Star", "รายงาน": "business-readiness", "รายละเอียด": "Qualified conversations/revenue ยังไม่มีหลักฐานพร้อมใช้; CI/FHC/LINE events เป็นพฤติกรรม ไม่ใช่ confirmed leads" },
        { "หัวข้อ": "AI", "รายงาน": "analysis-status", "รายละเอียด": `${analysisStatus}: AI ทำงานเฉพาะเมื่อ Data Quality Gate = ready; แสดงเฉพาะผล validated/persisted พร้อม provider/model; stale ไม่ถูกใช้สร้าง action ใหม่` },
        { "หัวข้อ": "มนุษย์", "รายงาน": "Action Plan", "รายละเอียด": "Neon เป็นแหล่งงานที่ตรวจแล้ว; refresh นำเข้าช่องมนุษย์ด้วย version/CAS ก่อนเผยแพร่ หาก conflict จะไม่เขียนทับ Action Plan" },
        { "หัวข้อ": "วิธีแก้งาน", "รายงาน": "Action Plan", "รายละเอียด": "แก้ description/owner/status/priority/notes/hypothesis/confounderNotes/assetId/actionType/expectedMetric/measurementDays/executedAt; ห้ามแก้ id/version/importKey และผลวัดระบบ" },
        ...selectedAnalyses.flatMap(({ model, record, stale }) => [
          { "หัวข้อ": "AI Provenance", "รายงาน": model.window.key, "รายละเอียด": `${stale ? "stale" : "ready"}; analysis=${record.analysisId}; latest=${analyses[model.window.key as "this_week" | "this_month"]?.latest?.status ?? "unknown"}; provider=${aiProvider(record)}; model=${record.modelName ?? "unknown"}; analysisPrompt=${record.promptVersion}; inputHash=${record.inputHash}; sourceManifestHash=${record.output!.sourceManifestHash}; definitions=${JSON.stringify(record.output!.definitionVersions)}; human review required`, "เริ่ม": record.period.currentStart, "สิ้นสุด": record.period.currentEnd, "รับเข้าคลัง": record.completedAt ?? record.createdAt },
          ...record.sourceManifest.map(source => ({ "หัวข้อ": "AI Source Provenance", "รายงาน": `${model.window.key} / ${source.report}`, "รายละเอียด": `analysis=${record.analysisId}; ${(source.limitations ?? []).join(" | ")}`, "ต้นทาง ณ": source.sourceAsOf, "รับเข้าคลัง": source.collectedAt, "เริ่ม": source.periodStart, "สิ้นสุด": source.periodEnd, "Timezone": source.timezone, "Batch ID": source.batchId, "Raw SHA256": source.rawHash })),
          ...aiFindings(record).map(finding => ({ "หัวข้อ": "AI Evidence", "รายงาน": model.window.key, "รายละเอียด": `${finding.type}: ${marketingAiEvidenceGuidance(finding)}; action=${finding.action ?? "monitor"}; priority=${finding.priority}; confidence=${finding.confidence}; ${finding.evidence.map(e => `${e.id}/${e.assetId ?? "kpi"}: ${e.metric}=${e.current ?? "unavailable"}, previous=${e.previous ?? "unavailable"}; sample=${e.sampleStatus}; coverage=${e.coverageStatus}; freshness=${e.freshnessStatus}; ref=${e.evidenceRef}`).join(" | ")}`, "เริ่ม": record.period.currentStart, "สิ้นสุด": record.period.currentEnd })),
          { "หัวข้อ": "AI Data Quality", "รายงาน": model.window.key, "รายละเอียด": MARKETING_AI_DATA_NOTE },
        ]),
        ...sourceManifest.map(item => ({ "หัวข้อ": "Provenance", "รายงาน": item.report, "รายละเอียด": item.limitations.join(" | "), "ต้นทาง ณ": item.sourceAsOf, "รับเข้าคลัง": item.collectedAt, "เริ่ม": item.periodStart, "สิ้นสุด": item.periodEnd, "Timezone": item.timezone, "Batch ID": item.batchId, "Raw SHA256": item.rawHash })),
        ...monthly.health.map(item => ({ "หัวข้อ": "Data Health", "รายงาน": item.report, "รายละเอียด": `${item.status}; expected lag ${item.expectedLagDays}d; last error ${item.lastError ?? "none"}; ${item.limitations.join(" | ")}`, "ต้นทาง ณ": item.sourceAsOf, "รับเข้าคลัง": item.collectedAt, "เริ่ม": item.coverageStart, "สิ้นสุด": item.coverageEnd, "Timezone": item.timezone })),
        ...[...new Set(models.flatMap(model => [model.window.calendarPolicy, ...model.notes]))].map(note => ({ "หัวข้อ": "นิยาม/ข้อจำกัด", "รายงาน": "marketing-v1", "รายละเอียด": note })),
      ]) },
    ],
  };
}


export function marketingWorkspaceCsv(workspace: MarketingWorkspace, title: MarketingSheetTitle): string {
  const sheet = workspace.sheets.find(item => item.title === title);
  if (!sheet) throw new Error("MARKETING_SHEET_NOT_FOUND");
  const provenance = {
    "__generated_at": workspace.lineage.generatedAt,
    "__cutoff": workspace.lineage.cutoff,
    "__source_available_through": workspace.lineage.sourceDataAvailableThrough,
    "__data_quality_status": workspace.lineage.dataQualityStatus,
    "__source_manifest_sha256": workspace.lineage.sourceManifestHash,
    "__schema_version": workspace.lineage.modelSchemaVersion,
    "__analysis_version": workspace.lineage.analysisVersion,
    "__ai_analysis_ids": workspace.lineage.aiAnalysisIds.join("|"),
    "__pipeline_correlation_id": workspace.lineage.pipelineCorrelationId,
    "__metric_semantics": workspace.lineage.metricSemantics.join("|"),
    "__limitations": workspace.lineage.limitations.join(" | "),
  };
  const provenanceColumns = Object.keys(provenance);
  const rows = sheet.rows.length ? sheet.rows.map(row => ({ ...row, ...provenance })) : [{ ...provenance }];
  return ownerDatasetToCsv({ columns: [...sheet.columns, ...provenanceColumns], rows });
}

export function marketingWorkspaceXlsx(workspace: MarketingWorkspace) {
  return workbookExportXlsx(workspace.sheets.map(sheet => ({ name: sheet.title, rows: [sheet.columns, ...sheet.rows.map(row => sheet.columns.map(column => row[column] ?? null))] })));
}

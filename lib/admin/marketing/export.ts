import type { MarketingDashboard, MarketingManifest } from "./model";
import type { MarketingAnalysisView, MarketingAnalysisRecord } from "./analysis";
import { workbookExportXlsx, type WorkbookCell } from "../analytics/export";
import { ownerDatasetToCsv } from "../agent-os/export-csv";
import { createHash } from "node:crypto";
import { PERFORMANCE_MARKETING_TABS } from "../agent-os/export-contract";

export const MARKETING_SHEET_TITLES = PERFORMANCE_MARKETING_TABS;
export type MarketingSheetTitle = typeof MARKETING_SHEET_TITLES[number];
export type MarketingWorkspaceSheet = { title: MarketingSheetTitle; columns: string[]; rows: Record<string, WorkbookCell>[]; ownership: "system" | "human-managed" };
export type MarketingWorkspace = { version: "marketing-workspace-v1"; generatedAt: string; sheets: MarketingWorkspaceSheet[]; sourceManifest: MarketingManifest[]; analysisStatus: "unavailable" | "ready" | "stale"; actionAuthority: "Admin/Neon" };

const numberOrBlank = (value: number | null) => value;
const metricRow = (model: MarketingDashboard, metric: MarketingDashboard["kpis"][number]) => ({ "ช่วง": model.window.key, "ข้อมูลช่วงนี้": model.window.availability ?? "mature_data", "เริ่ม": model.window.currentStart, "สิ้นสุด": model.window.currentEnd, "ช่วงเทียบเริ่ม": model.window.previousStart, "ช่วงเทียบสิ้นสุด": model.window.previousEnd, "ตัวชี้วัด": metric.metric, "ปัจจุบัน": numberOrBlank(metric.current), "ก่อนหน้า": numberOrBlank(metric.previous), "ต่างกัน": metric.absoluteChange, "เปลี่ยนแปลง (%)": metric.percentageChange, "หน่วย": metric.unit, "ปริมาณข้อมูล": metric.sampleStatus, "เกณฑ์ปริมาณ": metric.threshold, "ประวัติ/ความครบ": metric.coverageStatus, "ความสด": metric.freshnessStatus, "หลักฐาน": metric.evidenceRef });
const manifestKey = (model: MarketingDashboard) => JSON.stringify(model.manifest.map(item => ({ batch: item.batchId, report: item.report, hash: item.rawHash })).sort((a, b) => `${a.batch}:${a.report}`.localeCompare(`${b.batch}:${b.report}`)));

export function buildMarketingWorkspace(weekly: MarketingDashboard, monthly: MarketingDashboard, analyses: Partial<Record<"this_week" | "this_month", MarketingAnalysisView>> = {}): MarketingWorkspace {
  if (weekly.state !== "ready" || monthly.state !== "ready") throw new Error("MARKETING_STORED_DATA_UNAVAILABLE");
  if (weekly.window.key !== "this_week" || monthly.window.key !== "this_month") throw new Error("MARKETING_WORKSPACE_WINDOWS_INVALID");
  if (manifestKey(weekly) !== manifestKey(monthly)) throw new Error("MARKETING_SOURCE_MANIFEST_CHANGED");
  const models = [weekly, monthly], generatedAt = [weekly.generatedAt, monthly.generatedAt].sort().at(-1)!;
  const selectedAnalyses = models.flatMap(model => {
    const view = analyses[model.window.key as "this_week" | "this_month"];
    const record = view?.latest && ["ready", "stale"].includes(view.latest.status) && view.latest.output ? view.latest : view?.lastGood && ["ready", "stale"].includes(view.lastGood.status) && view.lastGood.output ? view.lastGood : null;
    if (!record?.output) return [];
    const stale = record.status === "stale" || view?.latest?.analysisId !== record.analysisId || record.period.currentStart !== model.window.currentStart || record.period.currentEnd !== model.window.currentEnd || JSON.stringify(record.sourceManifest.map(m => [m.batchId, m.rawHash]).sort()) !== JSON.stringify(model.manifest.map(m => [m.batchId, m.rawHash]).sort());
    return [{ model, record, stale }];
  });
  const analysisStatus = selectedAnalyses.length === models.length && selectedAnalyses.every(item => !item.stale) ? "ready" : selectedAnalyses.length ? "stale" : "unavailable";
  const aiFindings = (record: MarketingAnalysisRecord) => record.output ? [...record.output.wins, ...record.output.risks, ...record.output.opportunities, ...record.output.watchItems] : [];
  const aiAssetText = (window: string, assetId: string) => selectedAnalyses.filter(item => item.model.window.key === window).flatMap(item => aiFindings(item.record).filter(finding => finding.evidence.some(e => e.assetId === assetId)).map(finding => `${item.stale ? "STALE · " : ""}${item.record.period.currentStart}–${item.record.period.currentEnd}: ${finding.explanation}; ${finding.action ?? "monitor"}; confidence=${finding.confidence}`)).join(" | ");
  const overviewColumns = ["ช่วง", "ข้อมูลช่วงนี้", "เริ่ม", "สิ้นสุด", "ช่วงเทียบเริ่ม", "ช่วงเทียบสิ้นสุด", "ตัวชี้วัด", "ปัจจุบัน", "ก่อนหน้า", "ต่างกัน", "เปลี่ยนแปลง (%)", "หน่วย", "ปริมาณข้อมูล", "เกณฑ์ปริมาณ", "ประวัติ/ความครบ", "ความสด", "หลักฐาน", "AI สมมติฐาน", "AI สถานะ", "AI ณ", "AI Model", "AI Prompt", "AI Input Hash", "AI รอบล่าสุด"];
  const contentRows = models.flatMap(model => model.leaderboards.flatMap(board => board.rows.map(row => ({ ...metricRow(model, row), "อันดับ": row.rank, "Leaderboard": board.title, "จัดอันดับตาม": board.basis, "แพลตฟอร์ม": board.platform, "Content ID": row.assetId, "เนื้อหา": row.title, "URL": row.url, "หมวด": row.category, "Lifecycle": row.lifecycle, "Mapping": row.mappingStatus, "เผยแพร่": row.publishedAt, "AI สมมติฐาน": aiAssetText(model.window.key, row.assetId) }))));
  const contentMetrics = [...new Set(models.flatMap(model => model.contentPerformance.flatMap(asset => asset.metrics.map(metric => metric.metric))))];
  const contentMetricColumns = contentMetrics.flatMap(metric => ["ปัจจุบัน", "ก่อนหน้า", "ต่างกัน", "เปลี่ยนแปลง (%)", "หน่วย", "ปริมาณข้อมูล", "ประวัติ/ความครบ", "ความสด", "หลักฐาน"].map(label => `${metric} · ${label}`));
  const allContentRows = models.flatMap(model => model.contentPerformance.map(asset => {
    const row: Record<string, WorkbookCell> = { "ช่วง": model.window.key, "เริ่ม": model.window.currentStart, "สิ้นสุด": model.window.currentEnd, "Content ID": asset.assetId, "URL": asset.url, "เนื้อหา": asset.title, "หมวด": asset.category, "Topic": asset.topic, "Lifecycle": asset.lifecycle, "เผยแพร่": asset.publishedAt, "Mapping": asset.mappingStatus };
    for (const metric of asset.metrics) { const values = metricRow(model, metric); for (const label of ["ปัจจุบัน", "ก่อนหน้า", "ต่างกัน", "เปลี่ยนแปลง (%)", "หน่วย", "ปริมาณข้อมูล", "ประวัติ/ความครบ", "ความสด", "หลักฐาน"] as const) row[`${metric.metric} · ${label}`] = values[label]; }
    return row;
  }));
  const actions = monthly.actions;
  const draftSet = createHash("sha256").update(actions.map(action => action.id).sort().join("|")).digest("hex").slice(0, 16);
  const actionColumns = ["id", "version", "assetId", "priority", "actionType", "description", "expectedMetric", "owner", "status", "executedAt", "measurementDays", "notes", "hypothesis", "confounderNotes", "importKey", "createdAt", "updatedAt", "baseline", "result", "absoluteChange", "percentageChange", "outcome", "measurementStatus"];
  const actionRows: Record<string, WorkbookCell>[] = [
    ...actions.map(action => ({ ...action, importKey: `action:${action.id}` })),
    ...[1, 2, 3].map(slot => ({ id: null, version: 0, assetId: null, priority: "medium", actionType: "investigation", description: "", expectedMetric: "organic_sessions", owner: "", status: "backlog", executedAt: null, measurementDays: 14, notes: "", hypothesis: "", confounderNotes: "", importKey: `draft:${draftSet}:${slot}` })),
  ];
  return { version: "marketing-workspace-v1", generatedAt, sourceManifest: monthly.manifest, analysisStatus, actionAuthority: "Admin/Neon", sheets: [
    { title: "Performance Overview", ownership: "system", columns: overviewColumns, rows: [...models.flatMap(model => model.kpis.map(metric => metricRow(model, metric))), ...selectedAnalyses.map(({ model, record, stale }) => ({ "ช่วง": model.window.key, "เริ่ม": record.period.currentStart, "สิ้นสุด": record.period.currentEnd, "ตัวชี้วัด": "Local AI hypothesis · human review required", "AI สมมติฐาน": record.output!.summary, "AI สถานะ": stale ? "stale" : "ready", "AI ณ": record.completedAt ?? record.createdAt, "AI Model": record.modelName, "AI Prompt": record.promptVersion, "AI Input Hash": record.inputHash, "AI รอบล่าสุด": analyses[model.window.key as "this_week" | "this_month"]?.latest?.status ?? "unavailable" }))] },
    { title: "Top Content", ownership: "system", columns: ["ช่วง", "Leaderboard", "จัดอันดับตาม", "แพลตฟอร์ม", "อันดับ", "Content ID", "เนื้อหา", "หมวด", "ตัวชี้วัด", "ปัจจุบัน", "ก่อนหน้า", "ต่างกัน", "เปลี่ยนแปลง (%)", "หน่วย", "ปริมาณข้อมูล", "ประวัติ/ความครบ", "ความสด", "Mapping", "เริ่ม", "สิ้นสุด", "หลักฐาน", "AI สมมติฐาน"], rows: contentRows },
    { title: "Opportunities", ownership: "system", columns: ["ช่วง", "Opportunity ID", "ความสำคัญระบบ", "ด้าน", "Content ID", "โอกาส", "เหตุผลจากกติกา", "ขั้นถัดไป", "ความเชื่อมั่น", "หลักฐาน", "Owner/Status", "AI สมมติฐาน"], rows: [...models.flatMap(model => model.opportunities.map(item => ({ "ช่วง": model.window.key, "Opportunity ID": item.id, "ความสำคัญระบบ": item.priority, "ด้าน": item.area, "Content ID": item.assetId, "โอกาส": item.title, "เหตุผลจากกติกา": item.reason, "ขั้นถัดไป": item.recommendedAction, "ความเชื่อมั่น": item.confidence, "หลักฐาน": item.evidenceRefs.join(" | "), "Owner/Status": "จัดการใน Admin Action Plan; refresh ไม่เปลี่ยนงานมนุษย์", "AI สมมติฐาน": item.assetId ? aiAssetText(model.window.key, item.assetId) : "" }))), ...selectedAnalyses.flatMap(({ model, record, stale }) => record.output!.recommendedActions.map(finding => ({ "ช่วง": model.window.key, "Opportunity ID": `${record.analysisId}:${finding.id}`, "ความสำคัญระบบ": finding.priority, "ด้าน": "Local AI hypothesis · human review", "Content ID": finding.evidence.map(e => e.assetId).filter(Boolean).join(" | "), "โอกาส": finding.type, "เหตุผลจากกติกา": null, "ขั้นถัดไป": finding.action, "ความเชื่อมั่น": finding.confidence, "หลักฐาน": finding.evidence.map(e => e.evidenceRef).join(" | "), "Owner/Status": "มนุษย์เลือกและลงมือใน Action Plan", "AI สมมติฐาน": `${stale ? "STALE · " : ""}${record.period.currentStart}–${record.period.currentEnd}: ${finding.explanation}` })))] },
    { title: "Content Performance", ownership: "system", columns: ["ช่วง", "เริ่ม", "สิ้นสุด", "Content ID", "URL", "เนื้อหา", "หมวด", "Topic", "Lifecycle", "เผยแพร่", "Mapping", ...contentMetricColumns], rows: allContentRows },
    { title: "Campaign & Funnel", ownership: "system", columns: ["ช่วง", "เริ่ม", "สิ้นสุด", "ชนิด", "Source / Medium", "Campaign", "Landing URL", "Content ID", "Sessions", "Engaged Sessions", "Key Events", "Event", "จำนวน event", "สถานะ", "Denominator", "ข้อจำกัด"], rows: models.flatMap(model => [
      ...model.campaigns.map(campaign => ({ "ช่วง": model.window.key, "เริ่ม": campaign.periodStart, "สิ้นสุด": campaign.periodEnd, "ชนิด": "acquisition", "Source / Medium": campaign.sourceMedium, "Campaign": campaign.campaign, "Landing URL": campaign.landingUrl, "Content ID": campaign.assetId, "Sessions": campaign.sessions, "Engaged Sessions": campaign.engagedSessions, "Key Events": campaign.keyEvents, "สถานะ": campaign.coverageStatus, "Denominator": null, "ข้อจำกัด": "Session-scoped acquisition; keyEvents ไม่ใช่ leads และยังไม่ผูก activity counts เป็น cohort funnel/attribution" })),
      ...model.funnel.steps.map(step => ({ "ช่วง": model.window.key, "เริ่ม": model.window.currentStart, "สิ้นสุด": model.window.currentEnd, "ชนิด": "activity-only", "Event": step.event, "จำนวน event": step.count, "สถานะ": step.status, "Denominator": null, "ข้อจำกัด": model.funnel.limitation })),
    ]) },
    { title: "Action Plan", ownership: "human-managed", columns: actionColumns, rows: actionRows },
    { title: "Data Notes", ownership: "system", columns: ["หัวข้อ", "รายงาน", "รายละเอียด", "ต้นทาง ณ", "รับเข้าคลัง", "เริ่ม", "สิ้นสุด", "Timezone", "Batch ID", "Raw SHA256"], rows: [
      { "หัวข้อ": "วิธีใช้", "รายงาน": "workspace", "รายละเอียด": "Top Content มี this_week/this_month ตาม SQL; Content Performance หนึ่งแถวต่อ canonical asset–window และคอลัมน์ตัวชี้วัดจาก SQL ไม่รวมคน/Reach ข้าม grain; ค่าว่างไม่ใช่ศูนย์" },
      { "หัวข้อ": "ขอบเขต", "รายงาน": "Content Performance", "รายละเอียด": "canonical assets จาก SQL (bounded 2,000) ไม่จำกัดเฉพาะ Top10; metric ที่ไม่มีข้อมูลยังว่าง ไม่รวม distinct users/reach ข้าม scope" },
      ...models.map(model => ({ "หัวข้อ": "ความพร้อมช่วง", "รายงาน": model.window.key, "รายละเอียด": model.window.availability === "no_mature_data" ? "รอข้อมูลต้นทางที่ mature สำหรับสัปดาห์/เดือนนี้ ไม่แทนด้วยช่วงก่อนหน้า; ไม่มีข้อมูลไม่ใช่ศูนย์" : model.window.calendarPolicy, "เริ่ม": model.window.currentStart, "สิ้นสุด": model.window.currentEnd })),
      { "หัวข้อ": "North Star", "รายงาน": "business-readiness", "รายละเอียด": "Qualified conversations/revenue ยังไม่มีหลักฐานพร้อมใช้; CI/FHC/LINE events เป็นพฤติกรรม ไม่ใช่ confirmed leads" },
      { "หัวข้อ": "AI", "รายงาน": "analysis-status", "รายละเอียด": `${analysisStatus}: แสดงเฉพาะ Local AI ที่ validated/persisted; สมมติฐานไม่ใช่ measured fact; stale ระบุช่วงเดิมและ input hash; rule candidates ไม่ใช่ข้อความ Local AI` },
      { "หัวข้อ": "มนุษย์", "รายงาน": "Action Plan", "รายละเอียด": "Neon เป็นแหล่งงานที่ตรวจแล้ว; แก้ใน Admin หรือ Action Plan ชีตได้ การ refresh นำเข้าช่องมนุษย์ด้วย version/CAS ก่อนเผยแพร่ หาก conflict จะไม่เขียนทับ Action Plan" },
      { "หัวข้อ": "วิธีแก้งาน", "รายงาน": "Action Plan", "รายละเอียด": "แก้ description/owner/status/priority/notes/hypothesis/confounderNotes/assetId/actionType/expectedMetric/measurementDays/executedAt; ห้ามแก้ id/version/importKey และผลวัดระบบ แถวใหม่ใช้ draft template และกรอก description; ช่องวันที่ลงมือเป็น ISO UTC เช่น 2026-09-27T12:00:00Z" },
      { "หัวข้อ": "คำแปลช่องงาน", "รายงาน": "Action Plan", "รายละเอียด": "ช่องสีทองแก้ได้: description=งานที่จะทำ; owner=ผู้รับผิดชอบ; priority=ความสำคัญที่คุณเลือก; status=สถานะงาน; notes=บันทึก; hypothesis=สมมติฐาน; confounderNotes=สิ่งอื่นที่อาจมีผล; assetId=Content ID; actionType=ชนิดงาน; expectedMetric=ตัวชี้วัด; measurementDays=วันวัดผล; executedAt=วันที่ลงมือ ISO UTC ช่องระบบ id/version/importKey/ผลก่อน–หลังห้ามแก้" },
      { "หัวข้อ": "สถานะงาน", "รายงาน": "Action Plan", "รายละเอียด": "backlog=รอจัดแผน; planned=วางแผนแล้ว; doing=กำลังทำ; measuring=กำลังวัดผล; done=เสร็จแล้ว; measuring/done ต้องมี executedAt; priority=high/medium/low; ก่อน–หลังไม่พิสูจน์ causality" },
      ...selectedAnalyses.flatMap(({ model, record, stale }) => [
        { "หัวข้อ": "AI Provenance", "รายงาน": model.window.key, "รายละเอียด": `${stale ? "stale" : "ready"}; analysis=${record.analysisId}; latest=${analyses[model.window.key as "this_week" | "this_month"]?.latest?.status ?? "unknown"}; model=${record.modelName ?? "unknown"}; prompt=${record.promptVersion}; inputHash=${record.inputHash}; sourceManifestHash=${record.output!.sourceManifestHash}; definitions=${JSON.stringify(record.output!.definitionVersions)}; human review required`, "เริ่ม": record.period.currentStart, "สิ้นสุด": record.period.currentEnd, "รับเข้าคลัง": record.completedAt ?? record.createdAt },
        ...record.sourceManifest.map(source => ({ "หัวข้อ": "AI Source Provenance", "รายงาน": `${model.window.key} / ${source.report}`, "รายละเอียด": `analysis=${record.analysisId}; ${(source.limitations ?? []).join(" | ")}`, "ต้นทาง ณ": source.sourceAsOf, "รับเข้าคลัง": source.collectedAt, "เริ่ม": source.periodStart, "สิ้นสุด": source.periodEnd, "Timezone": source.timezone, "Batch ID": source.batchId, "Raw SHA256": source.rawHash })),
        ...aiFindings(record).map(finding => ({ "หัวข้อ": "AI Evidence", "รายงาน": model.window.key, "รายละเอียด": `${finding.type}: ${finding.explanation}; action=${finding.action ?? "monitor"}; priority=${finding.priority}; confidence=${finding.confidence}; ${finding.evidence.map(e => `${e.id}/${e.assetId ?? "kpi"}: ${e.metric}=${e.current ?? "unavailable"}, previous=${e.previous ?? "unavailable"}; sample=${e.sampleStatus}; coverage=${e.coverageStatus}; freshness=${e.freshnessStatus}; ref=${e.evidenceRef}`).join(" | ")}`, "เริ่ม": record.period.currentStart, "สิ้นสุด": record.period.currentEnd })),
        ...record.output!.dataQualityNotes.map(note => ({ "หัวข้อ": "AI Data Quality", "รายงาน": model.window.key, "รายละเอียด": note })),
      ]),
      ...monthly.manifest.map(item => ({ "หัวข้อ": "Provenance", "รายงาน": item.report, "รายละเอียด": item.limitations.join(" | "), "ต้นทาง ณ": item.sourceAsOf, "รับเข้าคลัง": item.collectedAt, "เริ่ม": item.periodStart, "สิ้นสุด": item.periodEnd, "Timezone": item.timezone, "Batch ID": item.batchId, "Raw SHA256": item.rawHash })),
      ...monthly.health.map(item => ({ "หัวข้อ": "Data Health", "รายงาน": item.report, "รายละเอียด": `${item.status}; expected lag ${item.expectedLagDays}d; last error ${item.lastError ?? "none"}; ${item.limitations.join(" | ")}`, "ต้นทาง ณ": item.sourceAsOf, "รับเข้าคลัง": item.collectedAt, "เริ่ม": item.coverageStart, "สิ้นสุด": item.coverageEnd, "Timezone": item.timezone })),
      ...[...new Set(models.flatMap(model => [model.window.calendarPolicy, ...model.notes]))].map(note => ({ "หัวข้อ": "นิยาม/ข้อจำกัด", "รายงาน": "marketing-v1", "รายละเอียด": note })),
    ] },
  ] };
}

export function marketingWorkspaceCsv(workspace: MarketingWorkspace, title: MarketingSheetTitle): string {
  const sheet = workspace.sheets.find(item => item.title === title);
  if (!sheet) throw new Error("MARKETING_SHEET_NOT_FOUND");
  return ownerDatasetToCsv(sheet);
}

export function marketingWorkspaceXlsx(workspace: MarketingWorkspace) {
  return workbookExportXlsx(workspace.sheets.map(sheet => ({ name: sheet.title, rows: [sheet.columns, ...sheet.rows.map(row => sheet.columns.map(column => row[column] ?? null))] })));
}

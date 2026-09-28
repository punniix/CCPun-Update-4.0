import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketingWorkspace, marketingWorkspaceCsv, marketingWorkspaceXlsx, MARKETING_SHEET_TITLES } from "../../lib/admin/marketing/export";
import type { MarketingDashboard } from "../../lib/admin/marketing/model";
import { exportSelectionSchema, googleSheetPresentationSpec } from "../../lib/admin/agent-os/export-contract";

function model(window: "this_week" | "this_month"): MarketingDashboard {
  const metric = { metric: "search_clicks", current: 0, previous: null, absoluteChange: null, percentageChange: null, sampleStatus: "low" as const, coverageStatus: "insufficient_history" as const, freshnessStatus: "fresh", threshold: 20, unit: "clicks", evidenceRef: "fact-one" };
  return { state: "ready", version: "marketing-v1", generatedAt: "2026-09-27T12:00:00Z", window: { key: window, currentStart: window === "this_week" ? "2026-09-21" : "2026-09-01", currentEnd: "2026-09-24", previousStart: "2026-08-01", previousEnd: "2026-08-24", calendarPolicy: "Equivalent mature elapsed days; native provider timezone" }, kpis: [metric], contentPerformance: [{assetId:"article:two",title:"Not in Top10",url:"https://ccpun.com/blog/two/",category:null,topic:null,publishedAt:null,mappingStatus:"mapped",lifecycle:"new",metrics:[metric]}], campaigns:[{sourceMedium:"google / organic",campaign:"(not set)",landingUrl:"https://ccpun.com/blog/two/",assetId:"article:two",sessions:3,engagedSessions:1,keyEvents:0,coverageStatus:"partial",periodStart:"2026-09-21",periodEnd:"2026-09-24"}], benchmarks: [], leaderboards: [{ id: "search", title: "Top Search", metric: "search_clicks", basis: "SQL clicks DESC, stable ID", platform: null, rows: [{ ...metric, rank: 1, assetId: "article:one", title: "=IMPORTXML(unsafe)", url: "https://ccpun.com/blog/one/", category: null, lifecycle: "new", mappingStatus: "mapped", publishedAt: null }] }], trend: [], funnel: { mode: "activity-only", steps: [{ event: "line_oa_click", count: 0, status: "observed" }], limitation: "Repeatable events; no cohort conversion or confirmed leads" }, health: [], opportunities: [], actions: [{ id: "00000000-0000-4000-8000-000000000001", version: 2, assetId: "article:one", priority: "high", actionType: "title", description: "Owner chosen task", expectedMetric: "search_clicks", owner: "Pun", status: "doing", executedAt: "2026-09-27T11:00:00Z", measurementDays: 14, notes: "Human notes must survive", hypothesis: "Likely driver; not causal", confounderNotes: "Campaign changed", createdAt: "2026-09-27T10:00:00Z", updatedAt: "2026-09-27T11:00:00Z", baseline: null, result: null, absoluteChange: null, percentageChange: null, outcome: "inconclusive", measurementStatus: "insufficient_history" }], manifest: [{ batchId: "00000000-0000-4000-8000-000000000002", report: "gsc-daily-page", rawHash: "a".repeat(64), periodStart: "2026-09-01", periodEnd: "2026-09-24", sourceAsOf: "2026-09-24", collectedAt: "2026-09-27T12:00:00Z", timezone: "America/Los_Angeles", limitations: ["partial rows"] }], notes: ["Blank is not zero"] };
}

test("seven-tab workspace retains both immediate windows, exact ranks/provenance and null baseline", () => {
  const workspace = buildMarketingWorkspace(model("this_week"), model("this_month"));
  assert.deepEqual(workspace.sheets.map(sheet => sheet.title), MARKETING_SHEET_TITLES);
  const top = workspace.sheets.find(sheet => sheet.title === "Top Content")!;
  assert.deepEqual(top.rows.map(row => row["ช่วง"]), ["this_week", "this_month"]);
  assert.deepEqual(top.rows.map(row => row["อันดับ"]), [1, 1]);
  assert.equal(top.rows[0]!["ปัจจุบัน"], 0); assert.equal(top.rows[0]!["ก่อนหน้า"], null);
  assert.equal(workspace.sourceManifest[0]!.rawHash, "a".repeat(64));
  assert.equal(workspace.analysisStatus, "unavailable");
  assert.equal(workspace.sheets.find(sheet => sheet.title === "Campaign & Funnel")!.rows[0]!["Denominator"], null);
  assert.equal(workspace.sheets.find(sheet => sheet.title === "Content Performance")!.rows[0]!["Content ID"], "article:two");
  assert.equal(workspace.sheets.find(sheet => sheet.title === "Content Performance")!.rows[0]!["search_clicks · ปัจจุบัน"], 0);
  assert.equal(workspace.sheets.find(sheet => sheet.title === "Campaign & Funnel")!.rows[0]!["Sessions"], 3);
});

test("export retries preserve human fields and defend CSV/XLSX against formulas", () => {
  const weekly = model("this_week"), monthly = model("this_month"), before = JSON.stringify(monthly.actions);
  const first = buildMarketingWorkspace(weekly, monthly), second = buildMarketingWorkspace(weekly, monthly);
  assert.equal(JSON.stringify(monthly.actions), before);
  assert.deepEqual(first.sheets.find(sheet => sheet.title === "Action Plan"), second.sheets.find(sheet => sheet.title === "Action Plan"));
  const action = first.sheets.find(sheet => sheet.title === "Action Plan")!;
  assert.equal(action.ownership, "human-managed"); assert.equal(action.rows[0]!.owner, "Pun"); assert.equal(action.rows[0]!.status, "doing"); assert.equal(action.rows[0]!.notes, "Human notes must survive");
  assert.equal(action.rows[0]!.version, 2); assert.equal(action.rows[0]!.importKey, "action:00000000-0000-4000-8000-000000000001");
  assert.equal(action.rows.length, 4); assert.equal(action.rows[1]!.description, ""); assert.match(String(action.rows[1]!.importKey), /^draft:[a-f0-9]{16}:1$/);
  assert.match(marketingWorkspaceCsv(first, "Top Content"), /'=IMPORTXML/);
  const xlsx = marketingWorkspaceXlsx(first), bytes = xlsx.toString("utf8");
  assert.equal(xlsx.readUInt32LE(0), 0x04034b50); assert.equal((bytes.match(/<sheet name=/g) ?? []).length, 7);
  assert.match(bytes, /name="Campaign &amp; Funnel"/); assert.match(bytes, /t="inlineStr"[^>]*><is><t[^>]*>=IMPORTXML/); assert.doesNotMatch(bytes, /<f[ >]/);
});

test("workspace refuses mismatched stored manifests or unavailable facts", () => {
  const monthly = model("this_month"); monthly.manifest[0]!.rawHash = "b".repeat(64);
  assert.throws(() => buildMarketingWorkspace(model("this_week"), monthly), /MANIFEST_CHANGED/);
  assert.throws(() => buildMarketingWorkspace({ ...model("this_week"), state: "unavailable" }, model("this_month")), /UNAVAILABLE/);
});

test("new workspace selection is explicit and preserves legacy two-tab export contract", () => {
  assert.equal(exportSelectionSchema.safeParse({ dataset: "performance-marketing" }).success, true);
  assert.equal(exportSelectionSchema.safeParse({ dataset: "performance-marketing", view: "seo-review" }).success, false);
  assert.deepEqual(googleSheetPresentationSpec({ dataset: "performance-marketing", generatedAt: "2026-09-27T12:00:00Z" }).tabs.map(tab => tab.title), MARKETING_SHEET_TITLES);
  assert.deepEqual(googleSheetPresentationSpec({ dataset: "marketing-analytics", generatedAt: "2026-09-27T12:00:00Z" }).tabs.map(tab => tab.title), ["ภาพรวม", "ข้อมูล"]);
});

test("persisted AI is exported with exact old-period evidence, version/hash and explicit stale state", () => {
  const weekly = model("this_week"), monthly = model("this_month");
  const evidence = { id: "e1", kind: "content" as const, assetId: "article:one", label: "Supplied asset", metric: "search_clicks", current: 2, previous: 1, absoluteChange: 1, percentageChange: 100, sampleStatus: "low" as const, coverageStatus: "complete" as const, freshnessStatus: "stale" as const, evidenceRef: "old-evidence-reference", measurementStatus: null };
  const finding = { id: "i1", type: "opportunity" as const, explanation: "ข้อมูลเก่ายังน้อย ควรตรวจเพิ่มก่อนเปลี่ยนชื่อ", action: "investigation" as const, priority: "low" as const, confidence: "low" as const, evidence: [evidence] };
  const output: import("../../lib/local-ai/contracts").MarketingAnalysisOutput = { promptVersion: "marketing-performance-v1", analysisType: "weekly_performance", definitionVersions: { analytics: "marketing-v2", rules: "marketing-rules-v1", identity: "marketing-identity-v1", freshness: "marketing-calendar-v2" }, sourceManifestHash: "a".repeat(64), period: { ...weekly.window, currentStart: "2026-09-14", currentEnd: "2026-09-17" }, sourceManifest: [], coverage: { prepared: 1, sent: 1, dropped: 0 }, snapshotHash: "b".repeat(64), summary: "สมมติฐานจากข้อมูลครั้งก่อน ควรติดตามก่อนลงมือ", wins: [], risks: [], opportunities: [finding], recommendedActions: [finding], watchItems: [], dataQualityNotes: ["ข้อมูลเก่าและปริมาณน้อย"], reviewRequired: true };
  const record: import("../../lib/admin/marketing/analysis").MarketingAnalysisRecord = { analysisId: "00000000-0000-4000-8000-000000000003", jobId: null, status: "ready", promptVersion: output.promptVersion, analysisType: output.analysisType, period: output.period, createdAt: "2026-09-18T00:00:00Z", completedAt: "2026-09-18T00:01:00Z", modelName: "VPS model", sourceManifest: weekly.manifest, inputHash: "c".repeat(64), output };
  const workspace = buildMarketingWorkspace(weekly, monthly, { this_week: { state: "ready", latest: { ...record, analysisId: "00000000-0000-4000-8000-000000000004", status: "queued", output: null }, lastGood: record } });
  assert.equal(workspace.analysisStatus, "stale");
  const overview = workspace.sheets.find(sheet => sheet.title === "Performance Overview")!, ai = overview.rows.find(row => row["AI สมมติฐาน"]);
  assert.equal(ai?.["เริ่ม"], "2026-09-14"); assert.equal(ai?.["AI รอบล่าสุด"], "queued"); assert.equal(ai?.["AI Input Hash"], "c".repeat(64));
  const top = workspace.sheets.find(sheet => sheet.title === "Top Content")!;
  assert.equal(top.rows[0]!["ปัจจุบัน"], 0); assert.match(String(top.rows[0]!["AI สมมติฐาน"]), /STALE.*2026-09-14/);
  const notes = marketingWorkspaceCsv(workspace, "Data Notes"); assert.match(notes, /search_clicks=2, previous=1/); assert.match(notes, /old-evidence-reference/); assert.match(notes, /sample=low/);
  assert.equal(workspace.sheets.find(sheet => sheet.title === "Opportunities")!.rows[0]!["ความเชื่อมั่น"], "low");
  const cloudWorkspace = buildMarketingWorkspace(weekly, monthly, { this_week: { state: "ready", latest: { ...record, inferenceProvider: "openai", modelName: "gpt-6-luna" }, lastGood: null } });
  const cloudOverview = cloudWorkspace.sheets.find(sheet => sheet.title === "Performance Overview")!.rows.find(row => row["AI สมมติฐาน"]);
  assert.equal(cloudOverview?.["AI Model"], "OpenAI API / gpt-6-luna");
  assert.match(String(cloudOverview?.["ตัวชี้วัด"]), /OpenAI API · สมมติฐานที่ต้องตรวจทาน/);
  assert.match(marketingWorkspaceCsv(cloudWorkspace, "Data Notes"), /provider=OpenAI API; model=gpt-6-luna/);
});


test("historical window-specific manifests union without blocking stored exports", () => {
  const weekly = model("this_week"), monthly = model("this_month");
  const historical = { ...monthly.manifest[0]!, batchId: "00000000-0000-4000-8000-000000000000", rawHash: "d".repeat(64), periodStart: "2026-06-08", periodEnd: "2026-08-02", sourceAsOf: "2026-08-02" };
  // This older chunk overlaps the monthly comparison (Aug1–24), but not weekly history.
  monthly.manifest = [historical, ...monthly.manifest];
  const first = buildMarketingWorkspace(weekly, monthly);
  assert.equal(first.sourceManifest.length, 2); assert.deepEqual(first.sourceManifest.map(entry => entry.batchId), [historical.batchId, weekly.manifest[0]!.batchId]);
  assert.match(marketingWorkspaceCsv(first, "Data Notes"), /2026-08-02/);
  assert.equal(marketingWorkspaceXlsx(first).readUInt32LE(0), 0x04034b50);
  monthly.manifest.reverse();
  assert.deepEqual(buildMarketingWorkspace(weekly, monthly).sourceManifest, first.sourceManifest);
  assert.equal(weekly.manifest.length, 1); assert.equal(monthly.manifest.length, 2);
  monthly.manifest.find(entry => entry.batchId === weekly.manifest[0]!.batchId)!.rawHash = "e".repeat(64);
  assert.throws(() => buildMarketingWorkspace(weekly, monthly), /MANIFEST_CHANGED/);
});

test("workspace refuses a changed shared cutoff or mature end even with identical provenance", () => {
  const monthly = model("this_month"); monthly.generatedAt = "2026-09-27T12:00:01Z";
  assert.throws(() => buildMarketingWorkspace(model("this_week"), monthly), /CUTOFF_CHANGED/);
  monthly.generatedAt = model("this_week").generatedAt; monthly.window.currentEnd = "2026-09-23";
  assert.throws(() => buildMarketingWorkspace(model("this_week"), monthly), /CUTOFF_CHANGED/);
});

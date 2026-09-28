import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { createRequire } from "node:module";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { buildMarketingWorkspace, marketingWorkspaceCsv, marketingWorkspaceXlsx } from "../../lib/admin/marketing/export";
import { ContentLeaderboard, MarketingTrend, MarketingAiReview, PerformanceMarketingDashboard } from "../../features/admin/marketing/PerformanceMarketingDashboard";
import { ExportCenter } from "../../features/admin/analytics/ExportCenter";
import { changeText, metricText, ownerContentCategoryLabel, ownerContentTitle, ownerEvidenceLabel, ownerMarketingText, safeContentHref, storedDateText } from "../../features/admin/marketing/presentation";
import * as presentation from "../../features/admin/marketing/presentation";
import type { MarketingAction, MarketingActionInput, MarketingDashboard, MarketingLeaderboard, MarketingMetric } from "../../lib/admin/marketing/model";

test("marketing presentation distinguishes missing from zero and protects content links", () => {
  assert.equal(metricText(0), "0"); assert.equal(metricText(null), "ยังไม่มีข้อมูล");
  assert.equal(changeText(null), "ยังเทียบไม่ได้"); assert.equal(changeText(0), "0%");
  assert.equal(safeContentHref("javascript:alert(1)"), null); assert.equal(safeContentHref("https://user:secret@ccpun.com/"), null);
  assert.equal(safeContentHref("/ci-planning/"), "https://ccpun.com/ci-planning/");
  assert.equal(storedDateText("invalid"), "ยังไม่ระบุ");
  assert.equal(ownerEvidenceLabel("content:search_clicks:sanity:ccpun-article-aia-senior-happy", "AIA Senior Happy"), "ข้อมูลคลิกจาก Google Search ของ “AIA Senior Happy”");
  assert.match(ownerMarketingText("Check source freshness: gsc-daily-page"), /ตรวจความพร้อมของข้อมูล/);
  assert.equal(presentation.labelStatus("observed_repeatable_event_count"), "นับกิจกรรมที่เกิดซ้ำได้จากข้อมูลต้นทาง");
});

test("leaderboards preserve SQL ranks, missing baselines and low sample instead of inventing winners", () => {
  const base = { metric: "search_clicks", previous: null, absoluteChange: null, percentageChange: null, sampleStatus: "low" as const, coverageStatus: "insufficient_history" as const, freshnessStatus: "see_source_health", threshold: 20, unit: "คลิก", evidenceRef: "content:search_clicks:sanity:ccpun-article-aia-senior-happy", url: null, category: null, lifecycle: "unknown", mappingStatus: "unmapped" as const, publishedAt: null };
  const board: MarketingLeaderboard = { id: "search", title: "Top Search", metric: "search_clicks", basis: "GSC clicks ตาม SQL", platform: null, rows: [{ ...base, rank: 1, assetId: "one", title: "SQL first <unsafe>", current: 1 }, { ...base, rank: 2, assetId: "two", title: "SQL second", current: 100 }] };
  const html = renderToStaticMarkup(createElement(ContentLeaderboard, { board }));
  assert.ok(html.indexOf("SQL first") < html.indexOf("SQL second")); assert.match(html, /SQL first &lt;unsafe&gt;/);
  assert.match(html, /ประวัติยังไม่พอ/); assert.match(html, /ยังเทียบไม่ได้/); assert.match(html, /ดูสถานะข้อมูลต้นทางด้านล่าง/);
  assert.match(html, /จัดอันดับตาม จำนวนคลิกจาก Google Search/); assert.match(html, /scope="row"/);
  assert.doesNotMatch(html, /see_source_health|content:search_clicks|200%|\blead\b|ROAS/);
  assert.match(renderToStaticMarkup(createElement(ContentLeaderboard, { board: { ...board, rows: [] } })), /ยังไม่มีเนื้อหาที่เข้าเกณฑ์/);
});

test("marketing content labels explain known category and Meta codes while retaining original values in collapsed details", () => {
  assert.equal(ownerContentCategoryLabel("health-insurance"), "ประกันสุขภาพ");
  assert.equal(ownerContentCategoryLabel("non-life-insurance"), "ประกันวินาศภัย");
  assert.equal(ownerContentCategoryLabel("mobile_status_update"), "โพสต์ข้อความ");
  assert.equal(ownerContentCategoryLabel("future_meta_type"), "ยังไม่มีชื่อหมวดที่ยืนยัน");
  assert.equal(ownerContentTitle("123", "social:facebook:123"), "โพสต์ Facebook (ยังไม่มีชื่อเรื่อง)");
  assert.equal(ownerContentTitle("ชื่อเรื่องเดิม", "social:facebook:123"), "ชื่อเรื่องเดิม");
  const board: MarketingLeaderboard = { id: "social", title: "Top Facebook published posts · snapshot views", metric: "social_views", basis: "Posts published in selected period", platform: "Facebook", rows: [{ rank: 1, assetId: "social:facebook:123", title: "123", url: null, category: "added_photos", lifecycle: "new", mappingStatus: "mapped", publishedAt: null, metric: "social_views", current: 10, previous: null, absoluteChange: null, percentageChange: null, sampleStatus: "low", coverageStatus: "partial", freshnessStatus: "see_source_health", threshold: 10, unit: "views", evidenceRef: "social:facebook:123" }] };
  const html = renderToStaticMarkup(createElement(ContentLeaderboard, { board }));
  assert.match(html, /โพสต์ Facebook \(ยังไม่มีชื่อเรื่อง\)/);
  assert.match(html, /โพสต์รูปภาพ/);
  assert.doesNotMatch(html.split("<details")[0], /added_photos|โพสต์Facebook/);
  assert.match(html, /<details[^>]*><summary[^>]*>ชื่อหมวดต้นทาง<\/summary><code[^>]*>added_photos<\/code><\/details>/);
});

test("Production marketing facts render Thai labels while technical provenance stays in optional audit details", () => {
  const metricCodes = ["search_average_position", "search_ctr", "social_reach", "social_interactions", "social_shares", "social_saves"];
  const metrics: MarketingMetric[] = metricCodes.map((metric, index) => ({ metric, current: index + 1, previous: null, absoluteChange: null, percentageChange: null, sampleStatus: "insufficient_data", coverageStatus: "partial", freshnessStatus: "see_source_health", threshold: 10, unit: "native_counter", evidenceRef: `content:${metric}:asset-1` }));
  const limitation = "Search Console may omit anonymized or low-volume queries.";
  const scope = "Scope: hostName ccpun.com/www.ccpun.com only; blog.ccpun.com excluded explicitly";
  const model: MarketingDashboard = {
    state: "ready", version: "marketing-v1", generatedAt: "2026-09-28T05:00:00Z",
    window: { key: "this_week", currentStart: "2026-09-21", currentEnd: "2026-09-24", previousStart: "2026-09-14", previousEnd: "2026-09-17", calendarPolicy: "Monday-start; provider-native dates; common mature cutoff; MTD equal elapsed days" },
    kpis: [], contentPerformance: [{ assetId: "asset-1", title: "บทความตัวอย่าง", url: "https://ccpun.com/example", category: "health-insurance", topic: null, publishedAt: null, mappingStatus: "mapped", lifecycle: "new", metrics }], campaigns: [], benchmarks: [], leaderboards: [], trend: [],
    funnel: { mode: "activity-only", steps: [], limitation: "Behavioral events are not confirmed leads; no cohort/session sequence, so conversion/drop-off rates and downstream outcomes are unavailable" },
    health: [{ source: "gsc", report: "gsc-daily-query-page", sourceAsOf: "2026-09-24", collectedAt: "2026-09-28T05:00:00Z", lastSuccess: "2026-09-28T05:00:00Z", lastError: null, expectedLagDays: 3, status: "expected_lag", coverageStart: "2026-09-01", coverageEnd: "2026-09-24", timezone: "America/Los_Angeles", limitations: [limitation, scope] }],
    opportunities: [{ id: "health-1", area: "health", assetId: null, title: "Check source freshness: gsc-daily-query-page", priority: "medium", evidenceRefs: ["health:gsc-daily-query-page"], recommendedAction: "Check source freshness: gsc-daily-query-page", confidence: "low", reason: "Source is stale or latest attempt failed; qualify recommendations until current evidence is available" }],
    actions: [], manifest: [{ batchId: "00000000-0000-4000-8000-000000000001", report: "gsc-daily-query-page", rawHash: "a".repeat(64), periodStart: "2026-09-01", periodEnd: "2026-09-24", sourceAsOf: "2026-09-24", collectedAt: "2026-09-28T05:00:00Z", timezone: "America/Los_Angeles", limitations: [limitation, scope] }], notes: ["Unknown English limitation for audit"],
  };
  const require = createRequire(import.meta.url), { JSDOM } = require("jsdom");
  const document = new JSDOM(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {} as never }, createElement(PerformanceMarketingDashboard, { model })))).window.document;
  const content = document.querySelector('[aria-labelledby="content-performance-title"]')?.textContent ?? "";
  const health = document.querySelector("#data-notes table")?.textContent ?? "";
  const opportunities = document.querySelector("#opportunities")?.textContent ?? "";
  for (const label of ["อันดับเฉลี่ยในผลค้นหา", "อัตราคลิกจากผลค้นหา", "จำนวนบัญชีที่เห็นโพสต์", "การมีส่วนร่วมกับโพสต์", "การแชร์โพสต์", "การบันทึกโพสต์"]) assert.ok(content.includes(label), label);
  assert.match(document.querySelector('[aria-labelledby="content-performance-title"] tbody th p')?.textContent ?? "", /ประกันสุขภาพ · ยังไม่มีหัวข้อ/);
  const categoryDetails = document.querySelector('[aria-labelledby="content-performance-title"] tbody th details');
  assert.equal(categoryDetails?.hasAttribute("open"), false);
  assert.match(categoryDetails?.textContent ?? "", /หมวด: health-insurance/);
  assert.doesNotMatch(content, /search_average_position|search_ctr|social_reach|social_interactions|social_shares|social_saves/);
  assert.match(health, /คำค้นจาก Google แยกตามหน้า|Google Search อาจไม่แสดงบางคำค้น|ไม่รวม blog\.ccpun\.com/);
  assert.doesNotMatch(health, /gsc-daily-query-page|Search Console may|Scope: hostName/);
  assert.match(opportunities, /ตรวจความพร้อมของข้อมูล: คำค้นจาก Google แยกตามหน้า/);
  assert.doesNotMatch(opportunities, /gsc daily query page|gsc-daily-query-page/);
  assert.match(document.querySelector("#data-notes details")?.textContent ?? "", /gsc-daily-query-page|Search Console may|Unknown English limitation for audit/);
});

test("daily trend breaks missing dates, retains zero and provides accessible observed-value table", () => {
  const html = renderToStaticMarkup(createElement(MarketingTrend, { points: [{ date: "2026-09-01", metric: "search_clicks", value: 0 }, { date: "2026-09-03", metric: "search_clicks", value: 5 }] }));
  assert.equal((html.match(/<polyline /g) ?? []).length, 2); assert.match(html, /role="img"/); assert.match(html, /<table/);
  assert.match(html, /2026-09-01: 0/); assert.match(html, /2026-09-03: 5/); assert.doesNotMatch(html, /2026-09-02/);
  assert.match(html, /วันที่ขาดไม่ได้เติมศูนย์/);
});

test("performance export controls target stored workspace and persistent existing job endpoint", () => {
  const html = renderToStaticMarkup(createElement<NonNullable<Parameters<typeof ExportCenter>[0]>>(ExportCenter, { initialDataset: "performance-marketing", compact: true }));
  assert.match(html, /อัปเดต Google Sheet เดิม/); assert.match(html, /\/api\/admin\/marketing\/export\/\?format=csv/);
  assert.match(html, /\/api\/admin\/marketing\/export\/\?format=xlsx/); assert.match(html, /download=""/);
  assert.match(html, /Top Content/); assert.match(html, /Action Plan/); assert.doesNotMatch(html, /นำเข้าไฟล์รายงานจากเว็บ Ubersuggest/);
});

test("uncertain Google trigger retains the server job and resumes status checks without issuing another export", async () => {
  const require = createRequire(import.meta.url), { JSDOM } = require("jsdom");
  const dom = new JSDOM("<div id='root'></div>", { url: "https://admin.ccpun.com/analytics/performance/" });
  const previous = { window: globalThis.window, document: globalThis.document, self: globalThis.self, fetch: globalThis.fetch };
  const jobId = "00000000-0000-4000-8000-000000000009", calls: Array<{ url: string; method: string; body?: string }> = [];
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, self: dom.window, IS_REACT_ACT_ENVIRONMENT: true, fetch: async (url: string, options?: RequestInit) => {
    calls.push({ url, method: options?.method ?? "GET", body: options?.body ? String(options.body) : undefined });
    return options?.method === "POST" ? Response.json({ error: "google-sheet-export-trigger-uncertain", jobId }, { status: 503 }) : Response.json({ terminal: true, job: { status: "reconciliation_required", stage: "trigger-uncertain", providerReference: null, errorCategory: "n8n-trigger-outcome-unknown" } });
  } });
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => root.render(createElement<NonNullable<Parameters<typeof ExportCenter>[0]>>(ExportCenter, { initialDataset: "performance-marketing", compact: true })));
    await act(async () => { await new Promise(resolve => dom.window.setTimeout(resolve, 10)); });
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(element => element.textContent === "อัปเดต Google Sheet เดิม")!;
    await act(async () => button.click());
    assert.equal(calls.filter(call => call.method === "POST").length, 1);
    assert.deepEqual(JSON.parse(calls.find(call => call.method === "POST")!.body!), { dataset: "performance-marketing" });
    assert.ok(calls.some(call => call.url === `/api/admin/operations/jobs/${jobId}/`));
    assert.deepEqual(JSON.parse(dom.window.localStorage.getItem("ccpun-owner-sheet-job")!), { jobId, runtimePath: `/operations/jobs/${jobId}/`, dataset: "performance-marketing" });
    assert.ok([...document.querySelectorAll<HTMLAnchorElement>("a")].some(link => link.getAttribute("href")?.replace(/\/$/, "") === `/operations/jobs/${jobId}`));
    assert.match(document.body.textContent ?? "", /เก็บ Job ID ไว้แล้ว/);
    assert.match(document.body.textContent ?? "", /ต้องตรวจผล/);
  } finally { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous); }
});

test("human action conflict preserves visible work and sends exact version and execution timestamp", async () => {
  const require = createRequire(import.meta.url), { JSDOM } = require("jsdom");
  const dom = new JSDOM("<div id='root'></div>"), previous = { window: globalThis.window, document: globalThis.document, FormData: globalThis.FormData, fetch: globalThis.fetch };
  const calls: MarketingActionInput[] = [];
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true, fetch: async (_url: string, options: RequestInit) => { calls.push(JSON.parse(String(options.body))); return Response.json({}, { status: 409 }); } });
  const source = readFileSync(new URL("../../features/admin/marketing/ActionPlan.tsx", import.meta.url), "utf8"), exports: { ActionPlan?: typeof import("../../features/admin/marketing/ActionPlan").ActionPlan } = {};
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "exports", compiled)((id: string) => id === "next/navigation" ? { useRouter: () => ({ refresh() { throw new Error("conflict must not refresh"); } }) } : id === "./presentation" ? presentation : require(id), exports);
  const action: MarketingAction = { id: "00000000-0000-4000-8000-000000000001", version: 4, assetId: null, priority: "high", actionType: "title", description: "Human task", expectedMetric: "search_clicks", owner: "Pun", status: "doing", executedAt: "2026-09-27T11:12:34Z", measurementDays: 14, notes: "Human notes survive", hypothesis: "Hypothesis", confounderNotes: "Campaign changed", createdAt: "2026-09-27T10:00:00Z", updatedAt: "2026-09-27T11:00:00Z", baseline: null, result: null, absoluteChange: null, percentageChange: null, outcome: "inconclusive", measurementStatus: "insufficient_history" };
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => root.render(createElement(exports.ActionPlan!, { actions: [action], assets: [] })));
    const form = document.querySelectorAll<HTMLFormElement>("form")[1]!;
    await act(async () => form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(calls.length, 1); assert.equal(calls[0]!.version, 4); assert.equal(calls[0]!.executedAt, action.executedAt); assert.equal(calls[0]!.notes, action.notes);
    assert.equal(form.querySelector<HTMLTextAreaElement>('[name="notes"]')!.value, action.notes); assert.match(document.body.textContent ?? "", /ถูกแก้ไขจากที่อื่นแล้ว/);
  } finally { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous); }
});

test("AI panel retains validated old result during a pending run and states actual source period", () => {
  const window = { key: "this_week" as const, currentStart: "2026-09-21", currentEnd: "2026-09-24", previousStart: "2026-09-14", previousEnd: "2026-09-17", calendarPolicy: "Native calendar" };
  const record: import("../../lib/admin/marketing/analysis").MarketingAnalysisRecord = { analysisId: "00000000-0000-4000-8000-000000000003", jobId: null, status: "stale", promptVersion: "marketing-performance-v1", analysisType: "weekly_performance", period: { ...window, currentStart: "2026-09-14", currentEnd: "2026-09-17" }, sourceManifest: [], createdAt: "2026-09-18T00:00:00Z", completedAt: "2026-09-18T00:01:00Z", modelName: "VPS test model", inputHash: "a".repeat(64), output: { promptVersion: "marketing-performance-v1", analysisType: "weekly_performance", definitionVersions: { analytics: "marketing-v2", rules: "marketing-rules-v1", identity: "marketing-identity-v1", freshness: "marketing-calendar-v2" }, period: { ...window, currentStart: "2026-09-14", currentEnd: "2026-09-17" }, sourceManifest: [], sourceManifestHash: "b".repeat(64), snapshotHash: "c".repeat(64), coverage: { prepared: 1, sent: 1, dropped: 0 }, summary: "สมมติฐานจากข้อมูลเก่า ควรตรวจเพิ่มเติมก่อนลงมือ", wins: [], risks: [], opportunities: [], recommendedActions: [], watchItems: [], dataQualityNotes: ["ข้อมูลเก่าและปริมาณน้อย"], reviewRequired: true } };
  const html = renderToStaticMarkup(createElement(MarketingAiReview, { model: { window, manifest: [] }, analysis: { state: "ready", latest: { ...record, analysisId: "00000000-0000-4000-8000-000000000004", status: "queued", output: null }, lastGood: record } }));
  assert.match(html, /รอคิววิเคราะห์/); assert.match(html, /ผลครั้งก่อน · โปรดดูวันที่/); assert.match(html, /2026-09-14.*2026-09-17/); assert.match(html, /อ่านตัวเลขและช่วงข้อมูล/); assert.doesNotMatch(html, /สมมติฐานจากข้อมูลเก่า/); assert.match(html, /a{64}/); assert.doesNotMatch(html, /ผลนี้ใช้ข้อมูล 2026-09-21/);
  const cloud = renderToStaticMarkup(createElement(MarketingAiReview, { model: { window, manifest: [] }, analysis: { state: "ready", latest: { ...record, inferenceProvider: "openai", modelName: "gpt-6-luna" }, lastGood: null } }));
  assert.match(cloud, /ระบบ AI สำรอง/); assert.doesNotMatch(cloud, /gpt-6-luna|สมมติฐานจากโมเดล VPS/);
  const unavailable = renderToStaticMarkup(createElement(MarketingAiReview, { model: { window, manifest: [] }, analysis: { state: "unavailable", latest: null, lastGood: null } }));
  assert.match(unavailable, /ตัวเลข อันดับ และแผนงานยังใช้งานได้/); assert.doesNotMatch(unavailable, /สมมติฐานจากข้อมูลเก่า/);
});

test("v1 unsupported AI prose stays in audit JSON and never reaches Admin, CSV, or Excel", () => {
  const unsupported = "มีการเปลี่ยนแปลงในความพร้อมของผู้ใช้จากข้อมูล Google";
  const window = { key: "this_week" as const, currentStart: "2026-09-21", currentEnd: "2026-09-24", previousStart: "2026-09-14", previousEnd: "2026-09-17", calendarPolicy: "Native calendar" };
  const evidence = { id: "e1", kind: "kpi" as const, assetId: null, label: "คลิกปุ่ม LINE", metric: "line_clicks", current: 2, previous: null, absoluteChange: null, percentageChange: null, sampleStatus: "low" as const, coverageStatus: "insufficient_history", freshnessStatus: "expected_lag" as const, evidenceRef: "kpi:line_clicks", measurementStatus: null };
  const finding = { id: "i1", type: "watch" as const, explanation: unsupported, action: "monitor" as const, priority: "low" as const, confidence: "low" as const, evidence: [evidence] };
  const output: import("../../lib/local-ai/contracts").MarketingAnalysisOutput = { promptVersion: "marketing-performance-v1", analysisType: "weekly_performance", definitionVersions: { analytics: "marketing-v2", rules: "marketing-rules-v1", identity: "marketing-identity-v1", freshness: "marketing-calendar-v2" }, period: window, sourceManifest: [], sourceManifestHash: "b".repeat(64), snapshotHash: "c".repeat(64), coverage: { prepared: 1, sent: 1, dropped: 0 }, summary: unsupported, wins: [], risks: [], opportunities: [], recommendedActions: [finding], watchItems: [finding], dataQualityNotes: [unsupported], reviewRequired: true };
  const record: import("../../lib/admin/marketing/analysis").MarketingAnalysisRecord = { analysisId: "00000000-0000-4000-8000-000000000003", jobId: null, status: "ready", promptVersion: output.promptVersion, analysisType: output.analysisType, period: window, sourceManifest: [], createdAt: "2026-09-25T00:00:00Z", completedAt: "2026-09-25T00:01:00Z", modelName: "VPS test model", inputHash: "a".repeat(64), output };
  const analysis: import("../../lib/admin/marketing/analysis").MarketingAnalysisView = { state: "ready", latest: record, lastGood: null };
  const stored = JSON.stringify(output);
  const html = renderToStaticMarkup(createElement(MarketingAiReview, { model: { window, manifest: [] }, analysis }));
  const model = (key: "this_week" | "this_month"): MarketingDashboard => ({ state: "ready", version: "marketing-v1", generatedAt: "2026-09-25T12:00:00Z", window: { ...window, key, currentStart: key === "this_month" ? "2026-09-01" : window.currentStart }, kpis: [], contentPerformance: [], campaigns: [], benchmarks: [], leaderboards: [], trend: [], funnel: { mode: "activity-only", steps: [], limitation: "No cohort" }, health: [], opportunities: [], actions: [], manifest: [], notes: [] });
  const workbook = buildMarketingWorkspace(model("this_week"), model("this_month"), { this_week: analysis });
  const csv = workbook.sheets.map(sheet => marketingWorkspaceCsv(workbook, sheet.title)).join("\n"), xlsx = marketingWorkspaceXlsx(workbook).toString("utf8");
  for (const delivered of [html, csv, xlsx]) { assert.doesNotMatch(delivered, /มีการเปลี่ยนแปลงในความพร้อมของผู้ใช้/); assert.match(delivered, /อ่านตัวเลขและช่วงข้อมูล/); }
  assert.doesNotMatch(html, /e1 ·/); assert.match(csv, /e1/); assert.match(csv, /สมมติฐานที่ต้องตรวจทาน/); assert.doesNotMatch(csv, /hypothesis · human review/);
  assert.match(html, /คลิกไป LINE: 2/); assert.match(csv, /line_clicks=2, previous=unavailable/);
  assert.equal(JSON.stringify(output), stored);
});

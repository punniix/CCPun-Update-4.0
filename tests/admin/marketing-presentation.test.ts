import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { ContentLeaderboard, MarketingTrend, MarketingAiReview } from "../../features/admin/marketing/PerformanceMarketingDashboard";
import { ExportCenter } from "../../features/admin/analytics/ExportCenter";
import { changeText, metricText, safeContentHref, storedDateText } from "../../features/admin/marketing/presentation";
import * as presentation from "../../features/admin/marketing/presentation";
import type { MarketingAction, MarketingActionInput, MarketingLeaderboard } from "../../lib/admin/marketing/model";

test("marketing presentation distinguishes missing from zero and protects content links", () => {
  assert.equal(metricText(0), "0"); assert.equal(metricText(null), "ยังไม่มีข้อมูล");
  assert.equal(changeText(null), "ยังเทียบไม่ได้"); assert.equal(changeText(0), "0%");
  assert.equal(safeContentHref("javascript:alert(1)"), null); assert.equal(safeContentHref("https://user:secret@ccpun.com/"), null);
  assert.equal(safeContentHref("/ci-planning/"), "https://ccpun.com/ci-planning/");
  assert.equal(storedDateText("invalid"), "ยังไม่ระบุ");
});

test("leaderboards preserve SQL ranks, missing baselines and low sample instead of inventing winners", () => {
  const base = { metric: "search_clicks", previous: null, absoluteChange: null, percentageChange: null, sampleStatus: "low" as const, coverageStatus: "insufficient_history" as const, freshnessStatus: "stale", threshold: 20, unit: "คลิก", evidenceRef: "source-1", url: null, category: null, lifecycle: "unknown", mappingStatus: "unmapped" as const, publishedAt: null };
  const board: MarketingLeaderboard = { id: "search", title: "Top Search", metric: "search_clicks", basis: "GSC clicks ตาม SQL", platform: null, rows: [{ ...base, rank: 1, assetId: "one", title: "SQL first <unsafe>", current: 1 }, { ...base, rank: 2, assetId: "two", title: "SQL second", current: 100 }] };
  const html = renderToStaticMarkup(createElement(ContentLeaderboard, { board }));
  assert.ok(html.indexOf("SQL first") < html.indexOf("SQL second")); assert.match(html, /SQL first &lt;unsafe&gt;/);
  assert.match(html, /ประวัติยังไม่พอ/); assert.match(html, /ยังเทียบไม่ได้/); assert.match(html, /ข้อมูลเก่า/);
  assert.match(html, /จัดอันดับตาม GSC clicks ตาม SQL/); assert.match(html, /scope="row"/);
  assert.doesNotMatch(html, /200%|\blead\b|ROAS/);
  assert.match(renderToStaticMarkup(createElement(ContentLeaderboard, { board: { ...board, rows: [] } })), /ยังไม่มีเนื้อหาที่เข้าเกณฑ์/);
});

test("daily trend breaks missing dates, retains zero and provides accessible observed-value table", () => {
  const html = renderToStaticMarkup(createElement(MarketingTrend, { points: [{ date: "2026-09-01", metric: "search_clicks", value: 0 }, { date: "2026-09-03", metric: "search_clicks", value: 5 }] }));
  assert.equal((html.match(/<polyline /g) ?? []).length, 2); assert.match(html, /role="img"/); assert.match(html, /<table/);
  assert.match(html, /2026-09-01: 0/); assert.match(html, /2026-09-03: 5/); assert.doesNotMatch(html, /2026-09-02/);
  assert.match(html, /วันที่ขาดไม่ได้เติมศูนย์/);
});

test("performance export controls target stored workspace and persistent existing job endpoint", () => {
  const html = renderToStaticMarkup(createElement<NonNullable<Parameters<typeof ExportCenter>[0]>>(ExportCenter, { initialDataset: "performance-marketing", compact: true }));
  assert.match(html, /อัปเดต Google Workspace เดิม/); assert.match(html, /\/api\/admin\/marketing\/export\/\?format=csv/);
  assert.match(html, /\/api\/admin\/marketing\/export\/\?format=xlsx/); assert.match(html, /download=""/);
  assert.match(html, /Top Content/); assert.match(html, /Action Plan/); assert.doesNotMatch(html, /นำเข้าไฟล์รายงานจากเว็บ Ubersuggest/);
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
  assert.match(html, /queued/); assert.match(html, /stale · ผลครั้งก่อน/); assert.match(html, /2026-09-14.*2026-09-17/); assert.match(html, /VPS test model/); assert.match(html, /สมมติฐานจากข้อมูลเก่า/); assert.match(html, /a{64}/); assert.doesNotMatch(html, /ผลนี้ใช้ข้อมูล 2026-09-21/);
  const unavailable = renderToStaticMarkup(createElement(MarketingAiReview, { model: { window, manifest: [] }, analysis: { state: "unavailable", latest: null, lastGood: null } }));
  assert.match(unavailable, /ตัวเลข อันดับ และ Action Plan ยังใช้งานได้/); assert.doesNotMatch(unavailable, /สมมติฐานจากข้อมูลเก่า/);
});

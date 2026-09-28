import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MARKETING_INFERENCE_PROFILE, marketingAnalysisInputSchema, marketingAnalysisOutputSchema, marketingSnapshotSchema, type MarketingAnalysisInput } from "../../lib/local-ai/contracts";
import { buildLocalAiWorkerHeartbeatDetails, inferAndValidate } from "../../workers/local-ai/src/index";

function input(window: "this_week" | "this_month"): MarketingAnalysisInput {
  const metrics = ["line_clicks", "calculator_complete", "organic_sessions", "search_clicks", "search_impressions", "organic_sessions", "search_clicks", "social_views"];
  const snapshot = marketingSnapshotSchema.parse({
    promptVersion: "marketing-performance-v1", analysisType: window === "this_week" ? "weekly_performance" : "monthly_performance",
    definitionVersions: { analytics: "marketing-v2", rules: "marketing-rules-v1", identity: "marketing-identity-v1", freshness: "marketing-calendar-v2" },
    period: { key: window, currentStart: window === "this_week" ? "2026-09-21" : "2026-09-01", currentEnd: "2026-09-24", previousStart: window === "this_week" ? "2026-09-14" : "2026-08-01", previousEnd: window === "this_week" ? "2026-09-17" : "2026-08-24", calendarPolicy: "Common mature native date" },
    sourceManifest: [], sourceManifestHash: "a".repeat(64),
    evidence: metrics.map((metric, index) => ({
      id: `e${index + 1}`, kind: index < 5 ? "kpi" : "content", assetId: index < 5 ? null : `asset-${index}`,
      label: index < 5 ? metric : "Supplied content asset", metric,
      current: index === 7 ? null : 8 + index, previous: index === 7 ? null : 10 + index,
      absoluteChange: index === 7 ? null : -2, percentageChange: index === 7 ? null : -20,
      sampleStatus: index === 4 ? "sufficient" : index === 7 ? "low" : "insufficient_data",
      coverageStatus: index === 7 ? "insufficient_history" : "complete", freshnessStatus: index === 7 ? "fresh" : "expected_lag",
      evidenceRef: `sql:${metric}:${index}`, measurementStatus: null,
    })),
    coverage: { prepared: 8, sent: 8, dropped: 0 },
    limitations: ["Qualified conversations are unavailable", "Events are not confirmed leads"],
  });
  return marketingAnalysisInputSchema.parse({ ...snapshot, snapshotHash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") });
}

const corrected = (id: string) => ({
  summary: "ข้อมูลยังต้องตรวจสอบก่อนตัดสินใจ",
  insights: [{ type: "watch", evidenceIds: [id], explanation: "ควรตรวจสอบแนวโน้มควบคู่กับพฤติกรรมหลังเข้าชม", action: "monitor", priority: "low", confidence: "low" }],
  dataQualityNotes: [], reviewRequired: true,
});

test("repair uses a distinct durable inference profile without changing model or numerical policy", () => {
  assert.deepEqual(MARKETING_INFERENCE_PROFILE, {
    version: "marketing-qwen17-4096-768-repair-v1", model: "qwen3:1.7b", promptVersion: "marketing-performance-v1",
    numCtx: 4096, numPredict: 768, temperature: 0, think: false,
  });
  assert.deepEqual(buildLocalAiWorkerHeartbeatDetails("qwen3:1.7b").marketingInferenceProfile, MARKETING_INFERENCE_PROFILE);
});

test("repair migration gate blocks new jobs and status while keeping last-good reads available", () => {
  const source = readFileSync(new URL("../../lib/admin/marketing/analysis.ts", import.meta.url), "utf8");
  assert.match(source, /20260928_marketing_ai_repair_retry_v4/);
  assert.match(source, /sha256:27d012741dd64bbb1d5378ecb4bcd165a9e379b8046342d13019d2dec67290db/);
  assert.match(source, /AND \(NOT \$11::boolean OR EXISTS\(SELECT 1 FROM ccpun_admin\.schema_migration WHERE version=\$12 AND checksum=\$13\)\)/);
  for (const method of ["enqueueMarketingAnalysis", "marketingAnalysisStatus"]) {
    assert.match(source.match(new RegExp(`export async function ${method}[^\\n]+`))?.[0] ?? "", /client\(true\)/);
  }
  for (const method of ["prepareMarketingAnalysis", "readMarketingAnalysis", "validateMarketingAnalysis"]) {
    assert.doesNotMatch(source.match(new RegExp(`export async function ${method}[^\\n]+`))?.[0] ?? "", /client\(true\)/);
  }
});

test("monthly weak-sample response gets one bounded repair without weakening grounding", async () => {
  const originalFetch = globalThis.fetch, originalTimeout = AbortSignal.timeout;
  const requests: Array<{ messages: Array<{ role: string; content: string }>; options: { num_predict: number } }> = [];
  const timeouts: number[] = [];
  AbortSignal.timeout = (duration: number) => { timeouts.push(duration); return originalTimeout(duration); };
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(String(options?.body)); requests.push(request);
    const invalid = { ...corrected("e1"), insights: ["e1", "e3", "e8"].map(evidenceId => ({ ...corrected(evidenceId).insights[0], evidenceIds: [evidenceId], confidence: "medium" })) };
    return Response.json({ message: { content: JSON.stringify(requests.length === 1 ? invalid : corrected("e2")) }, prompt_eval_count: 919, eval_count: 556 });
  };
  try {
    const result = await inferAndValidate("http://ollama:11434/", "qwen3:1.7b", "marketing-analysis", input("this_month"));
    assert.equal(result.success, true);
    if (result.success) assert.equal(marketingAnalysisOutputSchema.parse(result.data).watchItems[0]?.evidence[0]?.id, "e2");
    assert.equal(requests.length, 2);
    assert.equal(requests[1]?.messages.length, 2);
    assert.match(requests[1]!.messages[0]!.content, /confidence low/);
    assert.equal(requests[1]!.messages[1]!.content, requests[0]!.messages[1]!.content);
    assert.ok(Buffer.byteLength(JSON.stringify(requests[1]!.messages)) < Buffer.byteLength(JSON.stringify(requests[0]!.messages)));
    assert.deepEqual(requests.map(request => request.options.num_predict), [768, 768]);
    assert.deepEqual(timeouts, [90_000, 65_000]);
  } finally { globalThis.fetch = originalFetch; AbortSignal.timeout = originalTimeout; }
});

test("weekly numeric prose and unsupported learning get repair; rejected text is never re-sent", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(String(options?.body)); requests.push(request);
    const invalid = { summary: "เพิ่ม 999%", insights: [
      { type: "watch", evidenceIds: ["e1"], explanation: "เพิ่ม 999%", action: "monitor", priority: "low", confidence: "low" },
      { type: "risk", evidenceIds: ["e3"], explanation: "ลด 999%", action: "investigation", priority: "low", confidence: "medium" },
      { type: "learning", evidenceIds: ["e5"], explanation: "ดีขึ้น 999%", action: "monitor", priority: "low", confidence: "low" },
    ], dataQualityNotes: [], reviewRequired: true };
    return Response.json({ message: { content: JSON.stringify(requests.length === 1 ? invalid : corrected("e5")) }, prompt_eval_count: 919, eval_count: 556 });
  };
  try {
    const result = await inferAndValidate("http://ollama:11434/", "qwen3:1.7b", "marketing-analysis", input("this_week"));
    assert.equal(result.success, true);
    assert.equal(requests.length, 2);
    assert.ok(!JSON.stringify(requests[1]).includes("999%"));
    assert.match(requests[1]!.messages[0]!.content, /watch\/risk/);
  } finally { globalThis.fetch = originalFetch; }
});

test("a second invalid marketing answer remains rejected after two calls", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ message: { content: JSON.stringify({ ...corrected("e1"), summary: "เพิ่ม 999%" }) } }); };
  try {
    const result = await inferAndValidate("http://ollama:11434/", "qwen3:1.7b", "marketing-analysis", input("this_week"));
    assert.equal(result.success, false);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveGoogleSheetExportRuntime } from "../../lib/admin/agent-os/export-runtime";
import { N8N_ADMIN_INTEGRATIONS, n8nAdminIntegrationSummary } from "../../lib/admin/n8n-integration-registry";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("Export Center is owner-facing and keeps generic raw conversations out", () => {
  const contract = read("lib/admin/agent-os/export-contract.ts");
  const page = read("apps/admin/app/(control-plane)/analytics/exports/page.tsx");
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");
  const center = read("features/admin/analytics/ExportCenter.tsx");
  assert.match(page, /ส่งออกข้อมูล/);
  assert.match(page, /settings:read/);
  assert.match(layout, /\/analytics\/exports\//);
  assert.match(center, /social-performance/);
  assert.match(center, /seo-intelligence/);
  assert.match(center, /Social Performance/);
  assert.match(center, /SEO Search Intelligence/);
  assert.doesNotMatch(contract, /crm-conversations/);
});

test("n8n Integration Registry separates Admin triggers, background jobs, unconnected workflows, tests and legacy", () => {
  const settings = read("apps/admin/app/(control-plane)/settings/[section]/page.tsx");
  const summary = n8nAdminIntegrationSummary();
  assert.equal(summary["admin-trigger"], 3);
  assert.equal(summary.unconnected, 3);
  assert.equal(summary.background, 3);
  assert.equal(summary["test-only"], 2);
  assert.equal(summary.legacy, 9);
  assert.deepEqual(
    N8N_ADMIN_INTEGRATIONS.filter((item) => item.status === "unconnected").map((item) => item.workflowId),
    ["HpHQEFLf7k6dKMC3", "Gn7ghA6RV8ladv56", "bwQcEsfdC0tUOgIA"],
  );
  assert.equal(N8N_ADMIN_INTEGRATIONS.find((item) => item.workflowId === "XOQHPkio5WzZIz0l")?.adminPath, "/analytics/exports/");
  assert.match(settings, /n8n Workflow Integration/);
  assert.match(settings, /ยังไม่มีปุ่ม/);
});

test("Social and SEO export builders reuse stable Admin read models and preserve missing-vs-zero semantics", () => {
  const datasets = read("lib/admin/agent-os/export-datasets.ts");
  assert.match(datasets, /getSocialMarketingDashboard/);
  assert.match(datasets, /listResearchSnapshots/);
  assert.match(datasets, /getUbersuggestDashboardData/);
  assert.match(datasets, /row\.views/);
  assert.match(datasets, /row\.reach/);
  assert.match(datasets, /value == null \|\| !Number\.isFinite\(value\) \? null/);
  assert.match(datasets, /userVisibilityPercentage \?\? null/);
  assert.match(datasets, /userAverageRank \?\? null/);
  assert.match(datasets, /ยังไม่ได้จับคู่ \/ รอตรวจ/);
  assert.match(datasets, /Stored Research \+ Ubersuggest AISV · export ไม่ยิง provider สด/);
});

test("CSV remains a direct owner-only fallback independent of n8n", () => {
  const route = read("apps/admin/app/api/admin/exports/csv/route.ts");
  assert.match(route, /identity\.role !== "owner"/);
  assert.match(route, /ownerDatasetToCsv/);
  assert.match(route, /text\/csv; charset=utf-8/);
  assert.doesNotMatch(route, /CCPUN_N8N|webhook/i);
});

test("Google Sheet export is background n8n work with Agent OS runtime observability", () => {
  const route = read("apps/admin/app/api/admin/exports/google-sheet/route.ts");
  const runtime = read("lib/admin/agent-os/export-runtime.ts");
  const workflow = JSON.parse(read("workers/local-ai/n8n/owner-export-google-sheet.direct.json"));
  assert.match(route, /createAgentRuntimeJob/);
  assert.match(route, /resolveGoogleSheetExportRuntime/);
  assert.match(runtime, /CCPUN_N8N_EXPORT_WEBHOOK_URL/);
  assert.match(runtime, /CCPUN_EXPORT_GOOGLE_SHEET_ENABLED/);
  assert.match(runtime, /CCPUN_EXPORT_GOOGLE_SHEET_UAT_ENABLED/);
  assert.match(runtime, /ccpun-owner-export-sheet-uat/);
  assert.equal(workflow.active, false);
  assert.equal(workflow.settings.timezone, "Asia/Bangkok");
  assert.equal(workflow.settings.saveDataSuccessExecution, "none");
  assert.equal(workflow.settings.saveDataErrorExecution, "none");
  const joined = JSON.stringify(workflow);
  assert.match(joined, /ภาพรวม/);
  assert.match(joined, /ข้อมูล/);
  assert.match(joined, /Asia\/Bangkok/);
  assert.match(joined, /frozenRowCount/);
  assert.match(joined, /setBasicFilter/);
  assert.match(joined, /autoResizeDimensions/);
  assert.match(joined, /social-performance/);
  assert.match(joined, /seo-intelligence/);
  assert.doesNotMatch(joined, /crm-conversations|raw transcript|raw_message/i);
});

test("Admin UAT Google Sheet export fails closed unless an isolated UAT webhook is explicitly enabled", () => {
  const common = {
    CCPUN_EXPORT_GOOGLE_SHEET_ENABLED: "true",
    CCPUN_N8N_EXPORT_WEBHOOK_TOKEN: "x".repeat(43),
  };
  assert.deepEqual(
    resolveGoogleSheetExportRuntime({
      ...common,
      CCPUN_APP_ENV: "admin-uat",
      CCPUN_N8N_EXPORT_WEBHOOK_URL: "https://n8n.example.com/webhook/ccpun-owner-export-sheet",
    }),
    { ready: false, reason: "uat-disabled" },
  );
  assert.deepEqual(
    resolveGoogleSheetExportRuntime({
      ...common,
      CCPUN_APP_ENV: "admin-uat",
      CCPUN_EXPORT_GOOGLE_SHEET_UAT_ENABLED: "true",
      CCPUN_N8N_EXPORT_WEBHOOK_URL: "https://n8n.example.com/webhook/ccpun-owner-export-sheet",
    }),
    { ready: false, reason: "uat-webhook-not-isolated" },
  );
  const isolated = resolveGoogleSheetExportRuntime({
    ...common,
    CCPUN_APP_ENV: "admin-uat",
    CCPUN_EXPORT_GOOGLE_SHEET_UAT_ENABLED: "true",
    CCPUN_N8N_EXPORT_WEBHOOK_URL: "https://n8n.example.com/webhook/ccpun-owner-export-sheet-uat",
  });
  assert.equal(isolated.ready, true);
  if (isolated.ready) assert.equal(isolated.webhook.pathname, "/webhook/ccpun-owner-export-sheet-uat");

  const production = resolveGoogleSheetExportRuntime({
    ...common,
    CCPUN_APP_ENV: "production-admin",
    CCPUN_N8N_EXPORT_WEBHOOK_URL: "https://n8n.example.com/webhook/ccpun-owner-export-sheet",
  });
  assert.equal(production.ready, true);
});

test("Google Sheet failures leave a safe terminal state without persisting provider errors", () => {
  const route = read("apps/admin/app/api/admin/exports/google-sheet/route.ts");
  const workflow = JSON.parse(read("workers/local-ai/n8n/owner-export-google-sheet.direct.json"));
  const nodes = new Map<string, { onError?: string; parameters: { jsonBody?: string } }>(
    workflow.nodes.map((node: { name: string }) => [node.name, node]),
  );
  for (const [source, target] of [
    ["Runtime · เริ่มงาน", "Runtime · เริ่มงานไม่สำเร็จ"],
    ["ดึงข้อมูล Export", "Runtime · ดึงข้อมูลไม่สำเร็จ"],
    ["สร้าง Google Sheet", "Runtime · ต้องตรวจผล Sheet"],
    ["เตรียมค่า Sheet", "Runtime · ต้องตรวจผล Sheet"],
    ["เขียน Overview", "Runtime · ต้องตรวจผล Sheet"],
    ["เขียนข้อมูล", "Runtime · ต้องตรวจผล Sheet"],
    ["จัดรูปแบบ Sheet", "Runtime · ต้องตรวจผล Sheet"],
    ["Runtime · เสร็จแล้ว", "Runtime · ต้องตรวจผล Sheet"],
  ]) {
    assert.equal(nodes.get(source)?.onError, "continueErrorOutput");
    assert.equal(workflow.connections[source].main[1][0].node, target);
  }
  assert.match(nodes.get("Runtime · เริ่มงานไม่สำเร็จ")?.parameters.jsonBody ?? "", /status:'failed'/);
  assert.match(nodes.get("Runtime · ดึงข้อมูลไม่สำเร็จ")?.parameters.jsonBody ?? "", /status:'failed'/);
  assert.match(nodes.get("Runtime · ต้องตรวจผล Sheet")?.parameters.jsonBody ?? "", /status:'reconciliation_required'/);
  assert.match(nodes.get("Runtime · เริ่มงาน")?.parameters.jsonBody ?? "", /stage:'fetch-dataset'/);
  assert.match(route, /status: "reconciliation_required",\s*stage: "trigger-uncertain"/);
  assert.match(route, /if \(!response\.ok\) \{[\s\S]*?status: "failed"/);
  assert.doesNotMatch(JSON.stringify(workflow), /error\.message|error\.description|error\.stack/);
});

test("Rejected Sheet webhook records only HTTP status, never provider body or headers", async () => {
  const route = read("apps/admin/app/api/admin/exports/google-sheet/route.ts");
  const rejection = route.slice(route.indexOf("  if (!response.ok) {"), route.indexOf("  return NextResponse.json({\n    status: \"accepted\""));
  assert.ok(rejection.startsWith("  if (!response.ok) {"));
  const run = new Function("response", "job", "updateAgentRuntimeJob", "NextResponse", "headers", `return (async () => {${rejection}})()`);
  for (const status of [401, 404, 500]) {
    let recorded: Record<string, unknown> | undefined;
    const response = new Response("private-provider-body", { status, headers: { Authorization: "private-provider-header" } });
    const result = await run(response, { jobId: "synthetic", rowVersion: 1 }, async (value: Record<string, unknown>) => { recorded = value; }, { json: (body: unknown, options: { status: number }) => ({ body, status: options.status }) }, {});
    assert.equal(recorded?.errorCategory, `n8n-trigger-rejected-${status}`);
    assert.equal(recorded?.status, "failed");
    assert.match(String(recorded?.errorCategory), /^[a-z0-9][a-z0-9._:-]{0,159}$/);
    assert.deepEqual(result, { body: { error: "google-sheet-export-trigger-failed", jobId: "synthetic" }, status: 503 });
    assert.doesNotMatch(JSON.stringify({ recorded, result }), /private-provider|Authorization/);
  }
});

test("Combined Owner Export + Daily workflow keeps both roots and fails closed without leaking source payloads", () => {
  const workflow = JSON.parse(read("workers/local-ai/n8n/owner-export-google-sheet.direct.json"));
  assert.equal(workflow.nodes.some((node: { name: string }) => node.name === "Daily · เก็บข้อมูล 06:00"), true);
  assert.equal(workflow.nodes.some((node: { name: string }) => node.name === "Admin · Export Google Sheet"), true);
  const sources = ["gsc", "ga4", "meta", "ubersuggest"];
  const summary = workflow.nodes.find((node: { name: string }) => node.name === "Daily · ตรวจผลครบทุกต้นทาง");
  const run = new Function("$", summary.parameters.jsCode);
  const good = Object.fromEntries(sources.map(source => [source, { results: [{ source, status: source === "meta" ? "duplicate" : "completed", batchId: "synthetic", rawSecret: "not-output" }] }]));
  const assessmentName = "Daily · ประเมินด้วย VPS AI";
  const evaluate = (inputs: typeof good) => run((name: string) => ({ first: () => ({ json: name === assessmentName ? { state: "queued", jobId: "synthetic" } : inputs[name.replace("Daily · ", "").toLowerCase()] }) }));
  assert.deepEqual(evaluate(good)[0].json.results.map((row: { source: string }) => row.source), sources);
  assert.doesNotMatch(JSON.stringify(evaluate(good)), /rawSecret|not-output/);
  for (const status of ["failed", "running", "unknown"]) {
    assert.throws(() => evaluate({ ...good, ga4: { results: [{ source: "ga4", status, batchId: "synthetic", rawSecret: "not-output" }] } }), { message: "ANALYTICS_DAILY_INCOMPLETE" });
  }
  assert.throws(() => evaluate({ ...good, ga4: { results: [] } }), { message: "ANALYTICS_DAILY_INCOMPLETE" });
  const chain = ["Daily · เก็บข้อมูล 06:00", ...sources.map(source => "Daily · " + source.toUpperCase()), assessmentName, summary.name];
  for (let i = 0; i < chain.length - 1; i++) assert.equal(workflow.connections[chain[i]].main[0][0].node, chain[i + 1]);
  assert.equal(workflow.settings.executionTimeout, 600);
});

test("Export dataset endpoint uses dedicated n8n auth and owner-friendly read models", () => {
  const auth = read("lib/admin/agent-os/export-service-auth.ts");
  const route = read("apps/admin/app/api/internal/agent-os/exports/route.ts");
  assert.match(auth, /CCPUN_EXPORT_N8N_ENABLED/);
  assert.match(auth, /CCPUN_EXPORT_N8N_TOKEN/);
  assert.match(route, /buildOwnerExportDataset/);
  assert.doesNotMatch(route, /conversation-archive|readLineConversationEvidence|ciphertext/i);
});

test("Dashboard shows aggregates without weakening advisor permission boundary", () => {
  const dashboard = read("apps/admin/app/(control-plane)/dashboard/page.tsx");
  assert.match(dashboard, /canReadAdvisor/);
  assert.match(dashboard, /Qualified Conversation/);
  assert.match(dashboard, /automationAttention/);
  assert.match(dashboard, /hasAdminPermission\(identity\.role, "advisor:read"\)/);
});

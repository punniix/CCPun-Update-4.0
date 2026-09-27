import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { exportSelectionSchema } from "../../lib/admin/agent-os/export-contract";
import { buildPerformanceExport } from "../../lib/admin/analytics/performance";
import { prepareUbersuggestWebImport } from "../../lib/admin/analytics/import";
const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
test("selected analysis grain survives strict Sheet contract, existing n8n handoff and RAW typed cells", () => {
  for (const view of ["seo-review", "measurement-gaps", "campaign-performance", "marketing-activities"]) assert.ok(exportSelectionSchema.safeParse({ dataset: "marketing-analytics", view }).success);
  assert.deepEqual(exportSelectionSchema.parse({ dataset: "marketing-analytics" }), { dataset: "marketing-analytics" });
  for (const value of [{ dataset: "marketing-analytics", view: "" }, { dataset: "marketing-analytics", view: "unknown" }, { dataset: "marketing-analytics", view: null }, { dataset: "crm-leads", view: "seo-review" }, { dataset: "marketing-analytics", other: 1 }]) assert.equal(exportSelectionSchema.safeParse(value).success, false);
  const workflow = JSON.parse(read("workers/local-ai/n8n/owner-export-google-sheet.direct.json")) as { nodes: Array<{ name: string; parameters: { jsCode?: string; jsonBody?: string } }> };
  const node = (name: string) => workflow.nodes.find(item => item.name === name)!;
  const input = { jobId: "00000000-0000-4000-8000-000000000001", rowVersion: 1, dataset: "marketing-analytics", generatedAt: "2026-09-27T12:00:00.000Z", view: "seo-review" };
  const runPrepare = (body: unknown) => new Function("$input", node("เตรียม Export").parameters.jsCode!)({ first: () => ({ json: { body, headers: {} } }) }) as Array<{ json: Record<string, unknown> }>;
  const prepared = runPrepare(input)[0]!.json; assert.equal(prepared.view, "seo-review"); assert.equal(prepared.generatedAt, input.generatedAt);
  assert.throws(() => runPrepare({ ...input, dataset: "crm-leads" }), /EXPORT_INPUT_INVALID/); assert.throws(() => runPrepare({ ...input, view: "" }), /EXPORT_INPUT_INVALID/); assert.throws(() => runPrepare({ ...input, view: "unknown" }), /EXPORT_INPUT_INVALID/);
  const archive = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "view")); assert.equal("view" in runPrepare(archive)[0]!.json, false);
  const forwarded = new Function("$", "return " + node("ดึงข้อมูล Export").parameters.jsonBody!.slice(3, -2).trim())(() => ({ item: { json: prepared } })); assert.deepEqual(forwarded, { dataset: input.dataset, generatedAt: input.generatedAt, view: "seo-review" });
  for (const request of workflow.nodes.filter(item => item.name === "ดึงข้อมูล Export" || item.name.startsWith("Runtime ·"))) {
    const expression = (request.parameters as { url: string }).url.slice(3, -2).trim();
    const resolve = (base?: string) => new Function("$env", "$json", "$", "return " + expression)({ CCPUN_ADMIN_BASE_URL: base }, prepared, () => ({ item: { json: prepared }, first: () => ({ json: prepared }) })) as string;
    assert.ok(resolve().startsWith("https://admin.ccpun.com/api/internal/agent-os/"));
    assert.equal(resolve("https://portable.example").replace("https://portable.example", "https://admin.ccpun.com"), resolve());
  }
  const data = prepareUbersuggestWebImport("Keyword,Volume\n=1+1,0", { windowStart: "2026-08-28", windowEnd: "2026-09-27", sourceAsOf: "2026-09-23", market: "Thailand", language: "Thai", currency: null }, input.jobId, input.generatedAt).data;
  const analysis = buildPerformanceExport([data], "seo-review", input.generatedAt);
  assert.equal(analysis.overview.find(row => row.label === "สร้างไฟล์ ณ (UTC)")?.value, input.generatedAt); assert.ok(analysis.overview.some(row => String(row.value).includes(data.rawHash)));
  const output = new Function("$input", "$", node("เตรียมค่า Sheet").parameters.jsCode!)({ first: () => ({ json: { spreadsheetId: "test-sheet", sheets: [] } }) }, () => ({ item: { json: analysis } }))[0].json;
  assert.equal(output.dataValues[1][analysis.columns.indexOf("คำค้น")], "=1+1"); assert.equal(output.dataValues[1][analysis.columns.indexOf("Volume Ubersuggest")], 0); assert.equal(output.dataValues[1][analysis.columns.indexOf("อันดับ Ubersuggest")], "");
  assert.match(JSON.stringify(node("เขียนข้อมูล").parameters), /valueInputOption.*RAW/); assert.match(JSON.stringify(node("เขียน Overview").parameters), /valueInputOption.*RAW/);
  const internal = read("apps/admin/app/api/internal/agent-os/exports/route.ts"); assert.match(internal, /isN8nExportRequestAuthorized/); assert.match(internal, /buildOwnerExportDataset\(parsed.data.dataset, parsed.data.generatedAt, undefined, parsed.data.view\)/);
  const builder = read("lib/admin/agent-os/export-datasets.ts").split("export async function buildOwnerExportDataset")[1]!; assert.match(builder, /readAnalyticsDashboard\(variables, generatedAt\)/); assert.match(builder, /buildPerformanceExport\(reports, view, generatedAt\)/);
  const owner = read("apps/admin/app/api/admin/exports/google-sheet/route.ts"); assert.match(owner, /identity.role !== "owner"/); assert.match(owner, /isSameOriginAdminMutation/); assert.match(owner, /JSON.stringify\({ ...parsed.data, generatedAt }\)/);
});

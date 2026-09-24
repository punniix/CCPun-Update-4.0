import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("Export Center is owner-facing and keeps generic raw conversations out", () => {
  const contract = read("lib/admin/agent-os/export-contract.ts");
  const page = read("apps/admin/app/(control-plane)/analytics/exports/page.tsx");
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");
  assert.match(page, /ส่งออกข้อมูล/);
  assert.match(page, /settings:read/);
  assert.match(layout, /\/analytics\/exports\//);
  assert.doesNotMatch(contract, /crm-conversations/);
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
  const workflow = JSON.parse(read("workers/local-ai/n8n/owner-export-google-sheet.direct.json"));
  assert.match(route, /createAgentRuntimeJob/);
  assert.match(route, /CCPUN_N8N_EXPORT_WEBHOOK_URL/);
  assert.match(route, /CCPUN_EXPORT_GOOGLE_SHEET_ENABLED/);
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
  assert.doesNotMatch(joined, /crm-conversations|raw transcript|raw_message/i);
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

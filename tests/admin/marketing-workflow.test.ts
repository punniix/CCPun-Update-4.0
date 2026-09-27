import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PERFORMANCE_MARKETING_TABS } from "../../lib/admin/agent-os/export-contract";

const workflow = JSON.parse(readFileSync(new URL("../../workers/local-ai/n8n/owner-export-google-sheet.direct.json", import.meta.url), "utf8"));
const nodes = new Map<string, { parameters: { jsCode: string } }>(workflow.nodes.map((node: { name: string }) => [node.name, node]));
const sheetId = "1zpXXHuQ152wSZXdHb0yFJPVcdQiGOHvz4Yhxrmjdo-o";
const columns = ["id", "version", "assetId", "priority", "actionType", "description", "expectedMetric", "owner", "status", "executedAt", "measurementDays", "notes", "hypothesis", "confounderNotes", "importKey", "createdAt", "updatedAt", "baseline", "result", "absoluteChange", "percentageChange", "outcome", "measurementStatus"];
const action = { id: "00000000-0000-4000-8000-000000000001", version: 2, assetId: null, priority: "high", actionType: "title", description: "Human description", expectedMetric: "search_clicks", owner: "Pun", status: "doing", executedAt: null, measurementDays: 14, notes: "Human notes", hypothesis: "Hypothesis", confounderNotes: "Confounders", importKey: "action:00000000-0000-4000-8000-000000000001", baseline: null, result: null };
const actionValues = [columns, columns.map(column => action[column as keyof typeof action] ?? "")];
const metadata = (actionExists: boolean) => ({ sheets: [{ properties: { sheetId: 0, title: "ภาพรวม", gridProperties: { rowCount: 1000, columnCount: 26 } } }, { properties: { sheetId: 1, title: "ข้อมูล", gridProperties: { rowCount: 1000, columnCount: 78 } } }, ...(actionExists ? [{ properties: { sheetId: 2, title: "Action Plan", gridProperties: { rowCount: 1000, columnCount: 26 } } }] : [])] });
function runCode(name: string, input: unknown, lookups: Record<string, unknown>) {
  const run = new Function("$input", "$", nodes.get(name)!.parameters.jsCode);
  return run({ first: () => ({ json: input }) }, (nodeName: string) => ({ first: () => ({ json: lookups[nodeName] }) }))[0].json;
}
function prepared(actionExists = true) {
  return runCode("Marketing · ตรวจช่องมนุษย์", actionExists ? { statusCode: 200, body: { values: actionValues } } : { statusCode: 400, body: { error: { code: 400 } } }, { "Marketing · อ่านโครงสร้าง Workspace": metadata(actionExists) });
}
function plan(options: { exists?: boolean; changed?: boolean; conflict?: boolean; readError?: boolean } = {}) {
  const exists = options.exists ?? true, p = prepared(exists);
  const values = options.changed ? [columns, [...actionValues[1]!, "moved"]] : p.initialValues;
  const workspace = { spreadsheetId: sheetId, sourceManifest: [{}], analysisStatus: "unavailable", sheets: PERFORMANCE_MARKETING_TABS.map(title => ({ title, columns: title === "Action Plan" ? columns : ["value"], rows: title === "Action Plan" ? [action] : [{ value: "=IMPORTXML(untrusted)" }] })) };
  return runCode("Marketing · เตรียม Atomic Refresh", options.readError ? { statusCode: 403, body: { error: { code: 403 } } } : exists ? { statusCode: 200, body: { values } } : { statusCode: 400, body: { error: { code: 400 } } }, {
    "Marketing · อ่าน SQL Workspace": workspace, "Marketing · อ่านโครงสร้าง Workspace": metadata(exists), "Marketing · ตรวจช่องมนุษย์": p,
    "Marketing · นำเข้างาน CAS": { status: options.conflict ? "needs-review" : "completed", preserveActionPlan: !!options.conflict, results: exists ? [{ importKey: action.importKey, id: action.id, version: action.version, status: "unchanged" }] : [] },
  });
}

test("persistent workspace creates seven named tabs atomically and never removes original tabs", () => {
  const output = plan({ exists: false }), requests = output.batchBody.requests;
  assert.equal(output.preserveActionPlan, false); assert.equal(requests.filter((request: { addSheet?: unknown }) => request.addSheet).length, 7);
  assert.equal(requests.filter((request: { updateCells?: unknown }) => request.updateCells).length, 7);
  assert.doesNotMatch(JSON.stringify(requests), /deleteSheet|clearValues|formulaValue/);
  assert.match(JSON.stringify(requests), /stringValue":"=IMPORTXML\(untrusted\)"/);
  const updated = requests.filter((request: { updateCells?: unknown }) => request.updateCells);
  assert.ok(updated.every((request: { updateCells: { range: { sheetId: number } } }) => request.updateCells.range.sheetId !== 0 && request.updateCells.range.sheetId !== 1));
});

test("Workspace completion timestamp obeys runtime terminal-state constraint during human review", () => {
  const node = workflow.nodes.find((item: { name: string }) => item.name === "Marketing · บันทึกผล Workspace");
  const expression = String(node.parameters.jsonBody).slice(3, -2).trim();
  const evaluate = new Function("$", `return ${expression};`);
  for (const preserveActionPlan of [false, true]) {
    const payload = evaluate((name: string) => ({ first: () => ({ json: name === "Runtime · เริ่มงาน" ? { rowVersion: 2 } : name === "เตรียม Export" ? { startedAt: "2026-09-27T00:00:00Z" } : { preserveActionPlan, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit` } }) }));
    assert.equal(payload.status, preserveActionPlan ? "reconciliation_required" : "completed");
    assert.equal(payload.completedAt !== null, payload.status === "completed");
    assert.equal(payload.expectedVersion, 2); assert.equal(payload.providerReference, `https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
    if (preserveActionPlan) assert.equal(payload.errorCategory, "marketing-actions-review-required");
    else assert.ok(Number.isFinite(Date.parse(payload.completedAt)));
  }
});

test("stable Action Plan refresh updates system values only and never rewrites human columns or existing ID", () => {
  const output = plan(), updates = output.batchBody.requests.filter((request: { updateCells?: { start?: { sheetId: number } } }) => request.updateCells?.start?.sheetId === 2);
  assert.equal(output.preserveActionPlan, false);
  assert.deepEqual(updates.map((request: { updateCells: { start: { columnIndex: number } } }) => request.updateCells.start.columnIndex), [1, 15]);
  assert.doesNotMatch(JSON.stringify(updates), /Human description|Human notes|"Pun"|stringValue":"doing"/);
});

test("conflicts, row moves and read failure preserve entire Action Plan while factual tabs remain refreshable", () => {
  for (const options of [{ conflict: true }, { changed: true }, { readError: true }]) {
    const output = plan(options); assert.equal(output.preserveActionPlan, true);
    assert.ok(output.batchBody.requests.every((request: { updateCells?: { start?: { sheetId: number }; range?: { sheetId: number } }; updateSheetProperties?: { properties: { sheetId: number } } }) => request.updateCells?.start?.sheetId !== 2 && request.updateCells?.range?.sheetId !== 2 && request.updateSheetProperties?.properties.sheetId !== 2));
    assert.equal(output.batchBody.requests.filter((request: { updateCells?: unknown }) => request.updateCells).length, 6);
  }
});

test("human import is strict whitelisted and blanks/new invalid rows never become accidental actions", () => {
  const p = prepared(); assert.equal(p.rows.length, 1); assert.equal(p.rows[0].version, 2); assert.equal(p.rows[0].notes, "Human notes");
  assert.deepEqual(Object.keys(p.rows[0]).sort(), columns.slice(0, 15).sort());
  const denied = runCode("Marketing · ตรวจช่องมนุษย์", { statusCode: 403, body: { error: { code: 403 } } }, { "Marketing · อ่านโครงสร้าง Workspace": metadata(false) });
  assert.equal(denied.preserveActionPlan, true); assert.deepEqual(denied.rows, []);
  assert.equal(workflow.connections["Marketing · Workspace?"].main[1][0].node, "ดึงข้อมูล Export");
  assert.equal(workflow.active, false); assert.equal(workflow.settings.saveDataSuccessExecution, "none");
});

test("Action Plan accepts one hundred actions plus its three blank drafts and protects overflow", () => {
  const realRows = Array.from({ length: 101 }, (_, index) => {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const row = { ...action, id, importKey: `action:${id}` };
    return columns.map(column => row[column as keyof typeof row] ?? "");
  });
  const drafts = Array.from({ length: 3 }, (_, index) => {
    const row = { ...action, id: null, version: 0, description: "", importKey: `draft:abc:${index}` };
    return columns.map(column => row[column as keyof typeof row] ?? "");
  });
  const parse = (values: unknown[][]) => runCode("Marketing · ตรวจช่องมนุษย์", { statusCode: 200, body: { values } }, { "Marketing · อ่านโครงสร้าง Workspace": metadata(true) });
  const accepted = parse([columns, ...realRows.slice(0, 100), ...drafts]);
  assert.equal(accepted.preserveActionPlan, false); assert.equal(accepted.rows.length, 100);
  assert.ok(accepted.rows.every((row: { description: string }) => row.description));
  for (const values of [[columns, ...realRows], [columns, ...realRows, ...drafts]]) {
    const overflow = parse(values); assert.equal(overflow.preserveActionPlan, true); assert.deepEqual(overflow.rows, []);
  }
  for (const name of ["Marketing · อ่านงานมนุษย์", "Marketing · อ่านงานซ้ำก่อนเขียน"]) {
    assert.match(workflow.nodes.find((node: { name: string }) => node.name === name).parameters.url, /A1%3AW105/);
  }
});

test("Daily marketing uses existing credentials and bounded native-grain refresh before AI", () => {
  const dailyNames = ["Marketing Daily · Canonical Identity", "Marketing Daily · GSC 7 วัน", "Marketing Daily · GA4 7 วัน", "Marketing Daily · วัดผลก่อน–หลัง", "Marketing Daily · ตรวจผล factual"];
  for (let i = 0; i < dailyNames.length - 1; i++) assert.equal(workflow.connections[dailyNames[i]!].main[0][0].node, dailyNames[i + 1]);
  const body = workflow.nodes.find((node: { name: string }) => node.name === dailyNames[1]).parameters.jsonBody;
  assert.deepEqual(JSON.parse(body), { operation: "collect", source: "gsc", lookbackDays: 7 });
  for (const prefix of ["Marketing AI Weekly", "Marketing AI Monthly"]) {
    const run = new Function("$input", "$runIndex", nodes.get(prefix + " · ตรวจขอบเขต retry")!.parameters.jsCode);
    const evaluate = (status: string, attempt: number, workerSucceeded = false) => run({ first: () => ({ json: { status, workerSucceeded, rawRows: ["must not reach AI state"] } }) }, attempt - 1)[0].json;
    assert.equal(evaluate("running", 7).canRetry, true); assert.equal(evaluate("running", 8).canRetry, false);
    assert.equal(evaluate("failed", 1).canRetry, false); assert.equal(evaluate("unavailable", 1).canRetry, false);
    assert.equal(evaluate("running", 1, true).workerSucceeded, true); assert.doesNotMatch(JSON.stringify(evaluate("running", 1)), /rawRows/);
    assert.equal(workflow.connections[prefix + " · Worker สำเร็จ?"].main[0][0].node, prefix + " · ตรวจ JSON และหลักฐาน");
    assert.equal(workflow.connections[prefix + " · รอต่อ?"].main[0][0].node, prefix + " · รอ 15 วินาที");
    assert.equal(workflow.nodes.find((node: { name: string }) => node.name === prefix + " · รอ 15 วินาที").parameters.amount, 15);
  }
  assert.equal(workflow.nodes.find((node: { name: string }) => node.name === "Daily · ตรวจผลครบทุกต้นทาง").onError, "continueErrorOutput");
  assert.equal(workflow.connections["Daily · ตรวจผลครบทุกต้นทาง"].main[1][0].node, dailyNames[0]);
});

test("draft creation commits only system identity/version; the human task and import key survive", () => {
  const draft = { ...action, id: null, version: 0, importKey: "draft:abcd:1", description: "Owner draft", notes: "Retain draft notes" };
  const values = [columns, columns.map(column => draft[column as keyof typeof draft] ?? "")];
  const preparedDraft = runCode("Marketing · ตรวจช่องมนุษย์", { statusCode: 200, body: { values } }, { "Marketing · อ่านโครงสร้าง Workspace": metadata(true) });
  assert.equal(preparedDraft.rows.length, 1); assert.equal(preparedDraft.rows[0].id, undefined);
  const workspace = { spreadsheetId: sheetId, sourceManifest: [{}], analysisStatus: "unavailable", sheets: PERFORMANCE_MARKETING_TABS.map(title => ({ title, columns: title === "Action Plan" ? columns : ["value"], rows: title === "Action Plan" ? [{ ...draft, id: action.id, version: 1 }] : [{ value: "Stored fact" }] })) };
  const output = runCode("Marketing · เตรียม Atomic Refresh", { statusCode: 200, body: { values } }, {
    "Marketing · อ่าน SQL Workspace": workspace, "Marketing · อ่านโครงสร้าง Workspace": metadata(true), "Marketing · ตรวจช่องมนุษย์": preparedDraft,
    "Marketing · นำเข้างาน CAS": { status: "completed", preserveActionPlan: false, results: [{ importKey: draft.importKey, id: action.id, version: 1, status: "created" }] },
  });
  const updates = output.batchBody.requests.filter((request: { updateCells?: { start?: { sheetId: number } } }) => request.updateCells?.start?.sheetId === 2);
  assert.equal(output.preserveActionPlan, false); assert.deepEqual(updates.map((request: { updateCells: { start: { columnIndex: number } } }) => request.updateCells.start.columnIndex), [0, 1, 15]);
  assert.doesNotMatch(JSON.stringify(updates), /Owner draft|Retain draft notes|draft:abcd/);
});

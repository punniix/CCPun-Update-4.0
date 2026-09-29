import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PERFORMANCE_MARKETING_TABS } from "../../lib/admin/agent-os/export-contract";

const workflow = JSON.parse(readFileSync(new URL("../../workers/local-ai/n8n/owner-export-google-sheet.direct.json", import.meta.url), "utf8"));
const dailyWorkflow = JSON.parse(readFileSync(new URL("../../workers/local-ai/n8n/marketing-daily-ai.direct.json", import.meta.url), "utf8"));
const nodes = new Map<string, { parameters: { jsCode: string } }>(workflow.nodes.map((node: { name: string }) => [node.name, node]));
const dailyNodes = new Map<string, { parameters: Record<string, unknown>; type?: string; typeVersion?: number; credentials?: Record<string, { name?: string }>; onError?: string }>(dailyWorkflow.nodes.map((node: { name: string }) => [node.name, node]));
const sheetId = "1zpXXHuQ152wSZXdHb0yFJPVcdQiGOHvz4Yhxrmjdo-o";
const jobA = "00000000-0000-4000-8000-0000000000a1";
const jobB = "00000000-0000-4000-8000-0000000000b2";
const columns = ["id", "version", "assetId", "priority", "actionType", "description", "expectedMetric", "owner", "status", "executedAt", "measurementDays", "notes", "hypothesis", "confounderNotes", "importKey", "createdAt", "updatedAt", "baseline", "result", "absoluteChange", "percentageChange", "outcome", "measurementStatus"];
const action = { id: "00000000-0000-4000-8000-000000000001", version: 2, assetId: null, priority: "high", actionType: "title", description: "Human description", expectedMetric: "search_clicks", owner: "Pun", status: "doing", executedAt: null, measurementDays: 14, notes: "Human notes", hypothesis: "Hypothesis", confounderNotes: "Confounders", importKey: "action:00000000-0000-4000-8000-000000000001", baseline: null, result: null };
const actionValues = [columns, columns.map(column => action[column as keyof typeof action] ?? "")];
const metadata = (actionExists: boolean) => ({ sheets: [{ properties: { sheetId: 0, title: "ภาพรวม", gridProperties: { rowCount: 1000, columnCount: 26 } } }, { properties: { sheetId: 1, title: "ข้อมูล", gridProperties: { rowCount: 1000, columnCount: 78 } } }, ...(actionExists ? [{ properties: { sheetId: 2, title: "Action Plan", gridProperties: { rowCount: 1000, columnCount: 26 } } }] : [])] });
function runItems(name: string, input: unknown, lookups: Record<string, unknown>) {
  const run = new Function("$input", "$", nodes.get(name)!.parameters.jsCode);
  const nodesData: Record<string, unknown> = { "เตรียม Export": { jobId: jobA }, ...lookups };
  return run({ first: () => ({ json: input }), all: () => Array.isArray(input) ? input.map(json => ({ json })) : [{ json: input }] }, (nodeName: string) => ({ first: () => ({ json: nodesData[nodeName] }), all: () => (nodesData[nodeName] as unknown[]).map(json => ({ json })) }));
}
function runCode(name: string, input: unknown, lookups: Record<string, unknown>) { return runItems(name, input, lookups)[0].json; }
function prepared(actionExists = true) {
  return runCode("Marketing · ตรวจช่องมนุษย์", actionExists ? { statusCode: 200, body: { values: actionValues } } : { statusCode: 400, body: { error: { code: 400 } } }, { "Marketing · อ่านโครงสร้าง Workspace": metadata(actionExists) });
}
function workspaceFor(rows = [{ value: "=IMPORTXML(untrusted)" }]) {
  return { spreadsheetId: sheetId, sourceManifest: [{}], analysisStatus: "unavailable", sheets: PERFORMANCE_MARKETING_TABS.map(title => ({ title, columns: title === "Action Plan" ? columns : ["value"], rows: title === "Action Plan" ? [action] : rows })) };
}
function plan(options: { exists?: boolean; changed?: boolean; conflict?: boolean; readError?: boolean; jobId?: string } = {}) {
  const exists = options.exists ?? true, p = prepared(exists);
  const values = options.changed ? [columns, [...actionValues[1]!, "moved"]] : p.initialValues;
  const workspace = workspaceFor();
  return runCode("Marketing · เตรียม Atomic Refresh", options.readError ? { statusCode: 403, body: { error: { code: 403 } } } : exists ? { statusCode: 200, body: { values } } : { statusCode: 400, body: { error: { code: 400 } } }, {
    "Marketing · อ่าน SQL Workspace": workspace, "Marketing · อ่านโครงสร้าง Workspace": metadata(exists), "Marketing · ตรวจช่องมนุษย์": p,
    "Marketing · นำเข้างาน CAS": { status: options.conflict ? "needs-review" : "completed", preserveActionPlan: !!options.conflict, results: exists ? [{ importKey: action.importKey, id: action.id, version: action.version, status: "unchanged" }] : [] },
    "เตรียม Export": { jobId: options.jobId ?? jobA },
  });
}
function stagedMetadata(setup: { stages: Array<{ stageTitle: string; stageId: number; title: string }> }, exists: boolean) {
  return { sheets: [...metadata(exists).sheets, ...setup.stages.map(stage => ({ properties: { sheetId: stage.stageId, title: stage.stageTitle, hidden: true, gridProperties: { rowCount: 100, columnCount: 26 } } }))] };
}
function commitPlan(options: { exists?: boolean; changed?: boolean; conflict?: boolean; readError?: boolean; finalValues?: unknown[][]; finalStatus?: number } = {}) {
  const exists = options.exists ?? true, setup = plan(options), p = prepared(exists);
  const latest = options.changed ? [columns, [...actionValues[1]!, "moved"]] : p.initialValues;
  const finalValues = options.finalValues ?? latest;
  const imported = { status: options.conflict ? "needs-review" : "completed", preserveActionPlan: !!options.conflict, results: exists ? [{ importKey: action.importKey, id: action.id, version: action.version, status: "unchanged" }] : [] };
  return runCode("Marketing · เตรียม Commit", options.finalStatus ? { statusCode: options.finalStatus, body: { error: { code: options.finalStatus } } } : exists ? { statusCode: 200, body: { values: finalValues } } : { statusCode: 400, body: { error: { code: 400 } } }, {
    "Marketing · เตรียม Atomic Refresh": setup, "Marketing · อ่าน SQL Workspace": workspaceFor(), "Marketing · อ่านโครงสร้าง Workspace": metadata(exists),
    "Marketing · อ่านโครงสร้างก่อน Commit": stagedMetadata(setup, exists), "Marketing · ตรวจช่องมนุษย์": p,
    "Marketing · นำเข้างาน CAS": imported,
    "Marketing · อ่านงานซ้ำก่อนเขียน": options.readError ? { statusCode: 403, body: { error: { code: 403 } } } : exists ? { statusCode: 200, body: { values: latest } } : { statusCode: 400, body: { error: { code: 400 } } },
  });
}

test("persistent workspace stages six hidden factual tabs without touching canonical or legacy tabs", () => {
  const output = plan({ exists: false }), requests = output.setupBody.requests;
  assert.equal(output.preserveActionPlan, false); assert.equal(output.stages.length, 6);
  assert.equal(requests.filter((request: { addSheet?: unknown }) => request.addSheet).length, 6);
  assert.doesNotMatch(JSON.stringify(requests), /deleteSheet|clearValues|formulaValue|Action Plan/);
  assert.ok(requests.filter((request: { addSheet?: { properties: { hidden: boolean } } }) => request.addSheet).every((request: { addSheet: { properties: { hidden: boolean } } }) => request.addSheet.properties.hidden));
  assert.ok(Buffer.byteLength(JSON.stringify(output.setupBody)) <= 180000);
  assert.ok(output.stages.every((stage: { stageId: number }) => stage.stageId !== 0 && stage.stageId !== 1));
});

test("different jobs cannot address each other's staging sheets or reuse a colliding sheet ID", () => {
  const first = plan({ exists: false, jobId: jobA });
  const second = plan({ exists: false, jobId: jobB });
  assert.notDeepEqual(first.stages.map((stage: { stageTitle: string }) => stage.stageTitle), second.stages.map((stage: { stageTitle: string }) => stage.stageTitle));
  assert.ok(first.stages.every((stage: { stageTitle: string }) => stage.stageTitle.length < 100));
  assert.ok(first.stages.every((stage: { stageId: number }) => !second.stages.some((other: { stageId: number }) => other.stageId === stage.stageId)));
  const ownedByA = first.stages.map((stage: { stageTitle: string; stageId: number }) => ({ properties: { sheetId: stage.stageId, title: stage.stageTitle, gridProperties: { rowCount: 100, columnCount: 26 } } }));
  const p = prepared(false);
  const read = { statusCode: 400, body: { error: { code: 400 } } };
  const bWithAVisible = runCode("Marketing · เตรียม Atomic Refresh", read, {
    "เตรียม Export": { jobId: jobB }, "Marketing · อ่าน SQL Workspace": workspaceFor(), "Marketing · อ่านโครงสร้าง Workspace": { sheets: [...metadata(false).sheets, ...ownedByA] },
    "Marketing · ตรวจช่องมนุษย์": p, "Marketing · นำเข้างาน CAS": { status: "completed", preserveActionPlan: false, results: [] },
  });
  assert.deepEqual(bWithAVisible.stages.map((stage: { stageId: number }) => stage.stageId), second.stages.map((stage: { stageId: number }) => stage.stageId));
  const stolenId = second.stages[0]!.stageId;
  assert.throws(() => runCode("Marketing · เตรียม Atomic Refresh", read, {
    "เตรียม Export": { jobId: jobB }, "Marketing · อ่าน SQL Workspace": workspaceFor(), "Marketing · อ่านโครงสร้าง Workspace": { sheets: [...metadata(false).sheets, { properties: { sheetId: stolenId, title: "another-job-sheet", gridProperties: { rowCount: 100, columnCount: 26 } } }] },
    "Marketing · ตรวจช่องมนุษย์": p, "Marketing · นำเข้างาน CAS": { status: "completed", preserveActionPlan: false, results: [] },
  }), /MARKETING_STAGE_ID_COLLISION/);
});

test("staging splits serialized UTF-8 payload below HTTP expression cap and rejects an oversized row", () => {
  const setup = plan({ exists: false });
  const rows = Array.from({ length: 35 }, (_, index) => ({ value: `ข้อมูล ${index} ` + "ก".repeat(2800) }));
  const workspace = workspaceFor(rows);
  const chunks = runItems("Marketing · แบ่งข้อมูล staging", { statusCode: 200, body: {} }, { "Marketing · เตรียม Atomic Refresh": setup, "Marketing · อ่าน SQL Workspace": workspace });
  assert.ok(chunks.length > 6);
  assert.ok(chunks.every((item: { json: { batchBody: unknown } }) => Buffer.byteLength(JSON.stringify(item.json.batchBody)) <= 180000));
  assert.ok(chunks.every((item: { json: { batchBody: { requests: Array<{ updateCells: { rows: unknown[] } }> } } }) => item.json.batchBody.requests[0]!.updateCells.rows.length > 0));
  assert.equal(chunks[0]!.json.batchBody.requests[0]!.updateCells.rows[1]!.values[0]!.userEnteredValue.stringValue.startsWith("ข้อมูล 0"), true);
  const stageReplies = chunks.map(() => ({ statusCode: 200, body: { replies: [{}] } }));
  assert.equal(runCode("Marketing · ตรวจผล staging", stageReplies, { "Marketing · แบ่งข้อมูล staging": chunks.map((item: { json: unknown }) => item.json) }).stagedChunks, chunks.length);
  assert.throws(() => runCode("Marketing · ตรวจผล staging", [{ statusCode: 200 }, { statusCode: 400 }], { "Marketing · แบ่งข้อมูล staging": chunks.map((item: { json: unknown }) => item.json) }), /MARKETING_STAGE_RESPONSE_COUNT/);
  assert.throws(() => runCode("Marketing · ตรวจผล staging", stageReplies.map((reply: { statusCode: number; body: unknown }, index: number) => index === 1 ? { statusCode: 400, body: { error: { code: 400 } } } : reply), { "Marketing · แบ่งข้อมูล staging": chunks.map((item: { json: unknown }) => item.json) }), /MARKETING_STAGE_HTTP_400/);
  assert.throws(() => runItems("Marketing · แบ่งข้อมูล staging", { statusCode: 200 }, { "Marketing · เตรียม Atomic Refresh": setup, "Marketing · อ่าน SQL Workspace": workspaceFor([{ value: "ก".repeat(70000) }]) }), /MARKETING_STAGE_ROW_TOO_LARGE/);
});

test("retry reuses hidden stage IDs and final swap deletes only superseded factual sheets", () => {
  const oldCanonical = PERFORMANCE_MARKETING_TABS.filter(title => title !== "Action Plan").map((title, index) => ({ properties: { sheetId: 100 + index, title, gridProperties: { rowCount: 100, columnCount: 26 } } }));
  const first = plan();
  const initial = { sheets: [...metadata(true).sheets, ...oldCanonical, ...first.stages.map((stage: { stageTitle: string; stageId: number }) => ({ properties: { sheetId: stage.stageId, title: stage.stageTitle, gridProperties: { rowCount: 100, columnCount: 26 } } }))] };
  const preparedAction = prepared(true);
  const imported = { status: "completed", preserveActionPlan: false, results: [{ importKey: action.importKey, id: action.id, version: action.version, status: "unchanged" }] };
  const setup = runCode("Marketing · เตรียม Atomic Refresh", { statusCode: 200, body: { values: actionValues } }, {
    "Marketing · อ่าน SQL Workspace": workspaceFor(), "Marketing · อ่านโครงสร้าง Workspace": initial,
    "Marketing · ตรวจช่องมนุษย์": preparedAction, "Marketing · นำเข้างาน CAS": imported,
  });
  assert.deepEqual(setup.stages.map((stage: { stageId: number }) => stage.stageId), first.stages.map((stage: { stageId: number }) => stage.stageId));
  assert.equal(setup.setupBody.requests.filter((request: { addSheet?: unknown }) => request.addSheet).length, 0);
  const finalMetadata = { sheets: [...initial.sheets.filter(item => !item.properties.title.startsWith("__ccpun_stage_")), ...setup.stages.map((stage: { stageTitle: string; stageId: number }) => ({ properties: { sheetId: stage.stageId, title: stage.stageTitle, hidden: true, gridProperties: { rowCount: 100, columnCount: 26 } } }))] };
  const commit = runCode("Marketing · เตรียม Commit", { statusCode: 200, body: { values: actionValues } }, {
    "Marketing · เตรียม Atomic Refresh": setup, "Marketing · อ่าน SQL Workspace": workspaceFor(),
    "Marketing · อ่านโครงสร้าง Workspace": initial, "Marketing · อ่านโครงสร้างก่อน Commit": finalMetadata,
    "Marketing · ตรวจช่องมนุษย์": preparedAction, "Marketing · นำเข้างาน CAS": imported,
    "Marketing · อ่านงานซ้ำก่อนเขียน": { statusCode: 200, body: { values: actionValues } },
  });
  const deleted = commit.batchBody.requests.filter((request: { deleteSheet?: { sheetId: number } }) => request.deleteSheet).map((request: { deleteSheet: { sheetId: number } }) => request.deleteSheet.sheetId);
  assert.deepEqual(deleted, [100, 101, 102, 103, 104, 105]);
  assert.doesNotMatch(JSON.stringify(commit.batchBody), /"sheetId":(?:0|1)(?=,|})/);
  assert.ok(Buffer.byteLength(JSON.stringify(commit.batchBody)) <= 180000);
});

test("final commit swaps six factual tabs atomically and creates Action Plan only after missing confirmation", () => {
  const output = commitPlan({ exists: false }), requests = output.batchBody.requests;
  assert.equal(requests.filter((request: { updateSheetProperties?: { properties?: { title?: string } } }) => request.updateSheetProperties?.properties?.title?.startsWith("__ccpun_previous_")).length, 0);
  assert.equal(requests.filter((request: { addSheet?: { properties: { title: string } } }) => request.addSheet?.properties.title === "Action Plan").length, 1);
  assert.equal(requests.filter((request: { updateSheetProperties?: { properties?: { title?: string } } }) => (PERFORMANCE_MARKETING_TABS as readonly string[]).includes(request.updateSheetProperties?.properties?.title ?? "")).length, 6);
  assert.doesNotMatch(JSON.stringify(requests), /"sheetId":0|"sheetId":1/);
  assert.ok(Buffer.byteLength(JSON.stringify(output.batchBody)) <= 180000);
  const setup = plan({ exists: false });
  const changedMetadata = stagedMetadata(setup, false);
  changedMetadata.sheets.push({ properties: { sheetId: 9, title: "Action Plan", gridProperties: { rowCount: 100, columnCount: 26 } } });
  assert.throws(() => runCode("Marketing · เตรียม Commit", { statusCode: 200, body: { values: actionValues } }, {
    "Marketing · เตรียม Atomic Refresh": setup, "Marketing · อ่าน SQL Workspace": workspaceFor(), "Marketing · อ่านโครงสร้าง Workspace": metadata(false),
    "Marketing · อ่านโครงสร้างก่อน Commit": changedMetadata, "Marketing · ตรวจช่องมนุษย์": prepared(false),
    "Marketing · นำเข้างาน CAS": { status: "completed", preserveActionPlan: false, results: [] },
    "Marketing · อ่านงานซ้ำก่อนเขียน": { statusCode: 400, body: { error: { code: 400 } } },
  }), /MARKETING_ACTION_CREATED_CONCURRENTLY/);
});

test("Workspace runtime completes only after confirmed Google HTTP200 and retains safe review status otherwise", () => {
  const node = workflow.nodes.find((item: { name: string }) => item.name === "Marketing · บันทึกผล Workspace");
  const expression = String(node.parameters.jsonBody).slice(3, -2).trim();
  const evaluate = new Function("$", "$json", `return ${expression};`);
  const writeNode=workflow.nodes.find((item: { name: string })=>item.name==="Marketing · เขียน 7 ชีต Atomic");
  assert.equal(writeNode.parameters.options.response.response.fullResponse,true);
  assert.equal(writeNode.parameters.options.response.response.neverError,true);
  assert.equal(writeNode.onError,"continueErrorOutput");
  assert.match(node.parameters.url,/first\(\)\.json\.jobId/);assert.doesNotMatch(node.parameters.url,/\.item/);
  for (const statusCode of [200,400,undefined]) for (const preserveActionPlan of [false,true]) {
    const payload = evaluate((name: string) => ({ first: () => ({ json: name === "Runtime · เริ่มงาน" ? { rowVersion: 2 } : name === "เตรียม Export" ? { startedAt: "2026-09-27T00:00:00Z" } : { preserveActionPlan, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit` } }) }),{statusCode,body:{error:{message:"private provider response must not be retained"}}});
    const completed=statusCode===200&&!preserveActionPlan;
    assert.equal(payload.status,completed?"completed":"reconciliation_required");
    assert.equal(payload.completedAt !== null, payload.status === "completed");
    assert.equal(payload.expectedVersion, 2); assert.equal(payload.providerReference,statusCode===200?`https://docs.google.com/spreadsheets/d/${sheetId}/edit`:null);
    if(completed)assert.ok(Number.isFinite(Date.parse(payload.completedAt)));
    else assert.equal(payload.errorCategory,statusCode===200?"marketing-actions-review-required":`google-sheet-http-${statusCode??"unknown"}`);
    assert.doesNotMatch(JSON.stringify(payload),/private provider response/);
  }
});

test("stable Action Plan refresh updates system values only and never rewrites human columns or existing ID", () => {
  const output = commitPlan(), updates = output.batchBody.requests.filter((request: { updateCells?: { start?: { sheetId: number } } }) => request.updateCells?.start?.sheetId === 2);
  assert.equal(output.preserveActionPlan, false);
  assert.deepEqual(updates.map((request: { updateCells: { start: { columnIndex: number } } }) => request.updateCells.start.columnIndex), [1, 15]);
  assert.doesNotMatch(JSON.stringify(updates), /Human description|Human notes|"Pun"|stringValue":"doing"/);
});

test("conflicts, row moves and read failure preserve entire Action Plan while factual tabs remain refreshable", () => {
  for (const options of [{ conflict: true }, { changed: true }, { readError: true }]) {
    const output = commitPlan(options); assert.equal(output.preserveActionPlan, true);
    assert.ok(output.batchBody.requests.every((request: { updateCells?: { start?: { sheetId: number }; range?: { sheetId: number } }; updateSheetProperties?: { properties: { sheetId: number } } }) => request.updateCells?.start?.sheetId !== 2 && request.updateCells?.range?.sheetId !== 2 && request.updateSheetProperties?.properties.sheetId !== 2));
    assert.equal(output.batchBody.requests.filter((request: { updateCells?: unknown }) => request.updateCells).length, 0);
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
  for (let i = 0; i < dailyNames.length - 1; i++) assert.equal(dailyWorkflow.connections[dailyNames[i]!].main[0][0].node, dailyNames[i + 1]);
  const body = dailyWorkflow.nodes.find((node: { name: string }) => node.name === dailyNames[1]).parameters.jsonBody;
  assert.deepEqual(JSON.parse(body), { operation: "collect", source: "gsc", lookbackDays: 7 });
  for (const prefix of ["Marketing AI Weekly", "Marketing AI Monthly"]) {
    const run = new Function("$input", "$runIndex", dailyNodes.get(prefix + " · ตรวจขอบเขต retry")!.parameters.jsCode);
    const evaluate = (status: string, attempt: number, workerSucceeded = false) => run({ first: () => ({ json: { status, workerSucceeded, rawRows: ["must not reach AI state"] } }) }, attempt - 1)[0].json;
    assert.equal(evaluate("running", 15).canRetry, true); assert.equal(evaluate("running", 16).canRetry, false);
    assert.equal(evaluate("failed", 1).canRetry, false); assert.equal(evaluate("unavailable", 1).canRetry, false);
    assert.equal(evaluate("running", 1, true).workerSucceeded, true); assert.doesNotMatch(JSON.stringify(evaluate("running", 1)), /rawRows/);
    assert.equal(dailyWorkflow.connections[prefix + " · Worker สำเร็จ?"].main[0][0].node, prefix + " · ตรวจ JSON และหลักฐาน");
    assert.equal(dailyWorkflow.connections[prefix + " · รับงานแล้ว?"].main[1][0].node, prefix + " · อ่านสถานะ");
    assert.equal(dailyWorkflow.connections[prefix + " · รอต่อ?"].main[0][0].node, prefix + " · รอ 15 วินาที");
    const wait = dailyWorkflow.nodes.find((node: { name: string }) => node.name === prefix + " · รอ 15 วินาที").parameters;
    assert.equal(wait.amount, 15); assert.equal(wait.unit, "seconds");
    assert.equal(16 * wait.amount, 240);
    assert.equal(dailyWorkflow.connections[prefix + " · ตรวจ JSON และหลักฐาน"].main[0][0].node, prefix + " · ต้องใช้ Cloud?");
    assert.equal(dailyWorkflow.connections[prefix + " · ต้องใช้ Cloud?"].main[0][0].node, prefix + " · จอง Cloud");
    assert.equal(dailyWorkflow.connections[prefix + " · ต้องใช้ Cloud?"].main[1][0].node, prefix + " · บันทึกสถานะขั้น");
    assert.match(dailyWorkflow.nodes.find((node: { name: string }) => node.name === prefix + " · ต้องใช้ Cloud?").parameters.conditions.conditions[0].leftValue, /review_required.*failed.*rejected/);
    const cloudReservationBody = dailyWorkflow.nodes.find((node: { name: string }) => node.name === prefix + " · จอง Cloud").parameters.jsonBody;
    assert.match(cloudReservationBody, /review_required.*failed.*workerSucceeded.*cloudStatus.*reserveReview.*reserveCloud/);
    const openAi = dailyWorkflow.nodes.find((node: { name: string }) => node.name === prefix + " · OpenAI Luna");
    assert.equal(openAi.type, "@n8n/n8n-nodes-langchain.openAi");
    assert.equal(openAi.typeVersion, 2.3);
    assert.equal(openAi.parameters.resource, "text");
    assert.equal(openAi.parameters.operation, "response");
    assert.equal(openAi.parameters.modelId.value, "gpt-6-luna");
    assert.equal(openAi.parameters.simplify, false);
    assert.equal(openAi.parameters.options.store, false);
    assert.equal(openAi.parameters.options.reasoning.reasoningOptions[0].effort, "low");
    assert.match(openAi.parameters.options.maxTokens, /512.*1600/);
    assert.equal(openAi.parameters.options.textFormat.textOptions[0].type, "json_schema");
    assert.equal(openAi.parameters.options.textFormat.textOptions[0].strict, true);
    assert.match(openAi.parameters.options.textFormat.textOptions[0].schema, /JSON\.stringify\(\$json\.format\)/);
    assert.equal(openAi.credentials.openAiApi.name, "CCPun Marketing Model Benchmark");
    assert.equal(openAi.onError, "continueRegularOutput");
    assert.doesNotMatch(JSON.stringify(openAi.parameters), /api\.openai\.com\/v1\/responses|httpRequest/);
  }
  assert.equal(dailyWorkflow.nodes.find((node: { name: string }) => node.name === "Daily · ตรวจผลครบทุกต้นทาง").onError, "continueErrorOutput");
  assert.equal(dailyWorkflow.connections["Daily · ตรวจผลครบทุกต้นทาง"].main[1][0].node, dailyNames[0]);
  assert.equal(workflow.nodes.some((node: { name: string }) => node.name.startsWith("Daily ·") || node.name.startsWith("Marketing AI ")), false);
});

test("draft creation commits only system identity/version; the human task and import key survive", () => {
  const draft = { ...action, id: null, version: 0, importKey: "draft:abcd:1", description: "Owner draft", notes: "Retain draft notes" };
  const values = [columns, columns.map(column => draft[column as keyof typeof draft] ?? "")];
  const preparedDraft = runCode("Marketing · ตรวจช่องมนุษย์", { statusCode: 200, body: { values } }, { "Marketing · อ่านโครงสร้าง Workspace": metadata(true) });
  assert.equal(preparedDraft.rows.length, 1); assert.equal(preparedDraft.rows[0].id, undefined);
  const workspace = { spreadsheetId: sheetId, sourceManifest: [{}], analysisStatus: "unavailable", sheets: PERFORMANCE_MARKETING_TABS.map(title => ({ title, columns: title === "Action Plan" ? columns : ["value"], rows: title === "Action Plan" ? [{ ...draft, id: action.id, version: 1 }] : [{ value: "Stored fact" }] })) };
  const setup = runCode("Marketing · เตรียม Atomic Refresh", { statusCode: 200, body: { values } }, {
    "Marketing · อ่าน SQL Workspace": workspace, "Marketing · อ่านโครงสร้าง Workspace": metadata(true), "Marketing · ตรวจช่องมนุษย์": preparedDraft,
    "Marketing · นำเข้างาน CAS": { status: "completed", preserveActionPlan: false, results: [{ importKey: draft.importKey, id: action.id, version: 1, status: "created" }] },
  });
  const output = runCode("Marketing · เตรียม Commit", { statusCode: 200, body: { values } }, {
    "Marketing · เตรียม Atomic Refresh": setup, "Marketing · อ่าน SQL Workspace": workspace, "Marketing · อ่านโครงสร้าง Workspace": metadata(true),
    "Marketing · อ่านโครงสร้างก่อน Commit": stagedMetadata(setup, true), "Marketing · ตรวจช่องมนุษย์": preparedDraft,
    "Marketing · นำเข้างาน CAS": { status: "completed", preserveActionPlan: false, results: [{ importKey: draft.importKey, id: action.id, version: 1, status: "created" }] },
    "Marketing · อ่านงานซ้ำก่อนเขียน": { statusCode: 200, body: { values } },
  });
  const updates = output.batchBody.requests.filter((request: { updateCells?: { start?: { sheetId: number } } }) => request.updateCells?.start?.sheetId === 2);
  assert.equal(output.preserveActionPlan, false); assert.deepEqual(updates.map((request: { updateCells: { start: { columnIndex: number } } }) => request.updateCells.start.columnIndex), [0, 1, 15]);
  assert.doesNotMatch(JSON.stringify(updates), /Owner draft|Retain draft notes|draft:abcd/);
});

test("Cloud failures log bounded diagnostics without model input or provider error text", () => {
  for (const period of ["Weekly", "Monthly"]) {
    const prefix = `Marketing AI ${period} · `;
    const code = String(dailyNodes.get(prefix + "เตรียมผล Cloud")!.parameters.jsCode);
    const run = new Function("$input", "$", "console", code);
    const reservation = { analysisId: "analysis-private", inputHash: "hash-private", reservationId: "reservation-private", localOutputDigest: "digest-private", mode: "review" };
    const lookup = () => ({ first: () => ({ json: reservation }) });
    const logs: string[] = [];
    const logger = { log: (message: string) => logs.push(message) };
    const providerError = { statusCode: 429, error: { message: '429 - {"code":"rate_limit_exceeded","message":"secret-payload-marker"}' } };
    const failed = run({ first: () => ({ json: providerError }) }, lookup, logger)[0].json;
    assert.equal(failed.operation, "failReview");
    assert.equal(failed.reason, "api-error");
    assert.deepEqual(JSON.parse(logs[0]!), { event: `marketing-cloud-${period.toLowerCase()}-http`, httpStatus: 429, errorCode: "rate_limit_exceeded", incompleteReason: null });
    assert.doesNotMatch(logs[0]!, /secret-payload-marker|analysis-private|hash-private|reservation-private|digest-private/);
    logs.length = 0;
    const incomplete = run({ first: () => ({ json: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, error: null } }) }, lookup, logger)[0].json;
    assert.equal(incomplete.operation, "failReview");
    assert.deepEqual(JSON.parse(logs[0]!), { event: `marketing-cloud-${period.toLowerCase()}-http`, httpStatus: null, errorCode: null, incompleteReason: "max_output_tokens" });
  }
});

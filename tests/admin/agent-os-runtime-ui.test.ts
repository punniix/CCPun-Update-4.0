import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { completedSheetUrl } from "../../features/admin/operations/AgentRuntimeJobStatus";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("completed Google Sheet reference becomes only a canonical HTTPS Sheets link", () => {
  const job = { status: "completed", action: "export.google_sheet", providerReference: "https://docs.google.com/spreadsheets/d/sheet_123/edit" } as const;
  assert.equal(completedSheetUrl(job), "https://docs.google.com/spreadsheets/d/sheet_123/edit");
  assert.equal(completedSheetUrl({ ...job, status: "reconciliation_required" }), null);
  assert.equal(completedSheetUrl({ ...job, action: "other.action" }), null);
  assert.equal(completedSheetUrl({ ...job, providerReference: "https://docs.google.com.evil.test/spreadsheets/d/sheet_123/edit" }), null);
  assert.equal(completedSheetUrl({ ...job, providerReference: "javascript:alert(1)" }), null);
  assert.equal(completedSheetUrl({ ...job, providerReference: "https://docs.google.com/spreadsheets/d/sheet_123/edit?redirect=evil" }), "https://docs.google.com/spreadsheets/d/sheet_123/edit");
});

test("Agent OS runtime detail API stays owner-safe and metadata-only", () => {
  const route = read("apps/admin/app/api/admin/operations/jobs/[jobId]/route.ts");
  assert.match(route, /settings:read/);
  assert.match(route, /readAgentRuntimeJobDetail/);
  assert.doesNotMatch(route, /transcript|raw_message|rawMessage|customerText|ciphertext|prompt/);
});

test("Runtime detail reads its exact UUID after the latest-200 list window", () => {
  const detail = read("lib/admin/operations/agent-os-runtime-detail.ts");
  const runtime = read("lib/admin/operations/agent-os-runtime.ts");
  const lookup = read("db/migrations/20260924_agent_os_runtime_lookup_v2.sql");
  assert.match(detail, /readAgentRuntimeJobById\(jobId, variables\)/);
  assert.doesNotMatch(detail, /readAgentRuntimeJobs\(200/);
  assert.match(runtime, /admin_read_agent_runtime_job\(\$1::uuid\)/);
  assert.match(runtime, /z\.string\(\)\.uuid\(\)\.safeParse\(jobId\)/);
  assert.match(lookup, /WHERE j\.job_id=p_job_id/);
  assert.doesNotMatch(lookup.split("AS $agent_lookup$")[1]?.split("$agent_lookup$;")[0] ?? "", /LIMIT 200/);
});

test("Runtime detail falls back to latest 200 only when lookup function is missing", () => {
  const runtime = read("lib/admin/operations/agent-os-runtime.ts");
  const lookup = runtime.split("export async function readAgentRuntimeJobById(")[1]?.split("export async function readAgentRuntimeDurationBaseline(")[0] ?? "";
  assert.match(lookup, /catch \(error\) \{[\s\S]*?"code" in error && error\.code === "42883"/);
  assert.match(lookup, /if \([^\n]+42883"\) \{\s*const legacy = await readAgentRuntimeJobs\(200, variables\)/);
  assert.match(lookup, /return \{ state: legacy\.state, job: legacy\.jobs\.find\(\(item\) => item\.jobId === parsedJobId\.data\) \?\? null \}/);
  assert.match(lookup, /return \{ state: "unavailable" as const, job: null \}/);
  assert.equal(lookup.match(/readAgentRuntimeJobs\(/g)?.length, 1);
});

test("Agent OS runtime UI uses real stage history instead of fake percentage progress", () => {
  const component = read("features/admin/operations/AgentRuntimeJobStatus.tsx");
  assert.match(component, /Runtime timeline/);
  assert.match(component, /baseline\.p50Ms/);
  assert.match(component, /baseline\.p90Ms/);
  assert.match(component, /heartbeat_stale/);
  assert.match(component, /n8nExecutionId/);
  assert.match(component, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(component, /progress.*%|Math\.min\(100|setProgress/i);
});

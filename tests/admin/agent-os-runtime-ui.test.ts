import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { completedSheetUrl } from "../../features/admin/operations/AgentRuntimeJobStatus";
import * as jobCopy from "../../features/admin/operations/job-copy";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("poll failure retains durable status, shows safe last-read warning and recovers", async () => {
  const { transpileModule, ModuleKind } = createRequire(import.meta.url)("typescript") as typeof import("typescript");
  const compiled = transpileModule(read("features/admin/operations/AgentRuntimeJobStatus.tsx"), { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
  let now = Date.parse("2026-10-11T05:00:00.000Z");
  class Clock extends Date { static now() { return now; } }
  const initial = { job: { jobId: "synthetic-job", status: "waiting_external", queuedAt: new Date(now).toISOString(), attempt: 1, maxAttempts: 2 },
    terminal: false, elapsedMs: 0, pace: "unknown", baseline: { sampleSize: 0 }, events: [], serverNow: new Date(now).toISOString() };
  const states: unknown[] = []; let index = 0;
  const effects: Array<() => (() => void) | undefined> = [];
  const timers = new Map<number, () => Promise<void>>();
  let response: () => Promise<unknown> = async () => { throw new Error("PRIVATE_NETWORK_CANARY"); };
  const loaded = { exports: {} as { AgentRuntimeJobStatus: (props: unknown) => unknown } };
  runInNewContext(compiled, { module: loaded, exports: loaded.exports, Date: Clock,
    window: { setInterval: (fn: () => Promise<void>, delay: number) => { timers.set(delay, fn); return delay; }, clearInterval: (id: number) => timers.delete(id) },
    fetch: () => response(),
    require: (name: string) => {
      if (name === "./job-copy") return jobCopy;
      if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
      assert.equal(name, "react");
      return { useEffect: (fn: () => (() => void) | undefined) => effects.push(fn), useMemo: (fn: () => unknown) => fn(),
        useState: (value: unknown) => { const slot = index++; if (!(slot in states)) states[slot] = typeof value === "function" ? (value as () => unknown)() : value;
          return [states[slot], (next: unknown) => { states[slot] = next; }]; } };
    } });
  const render = () => { index = 0; effects.length = 0; return loaded.exports.AgentRuntimeJobStatus({ initial }); };
  render();
  const cleanup = effects.map(fn => fn());
  const poll = timers.get(3000)!;
  assert.ok(poll);
  const lastRead = states[5];
  for (const fail of [
    async () => { throw new Error("PRIVATE_NETWORK_CANARY"); },
    async () => ({ ok: false, json: () => assert.fail("failed response body must not be read") }),
    async () => ({ ok: true, json: async () => { throw new Error("PRIVATE_BODY_CANARY"); } }),
  ]) {
    response = fail;
    await poll();
    assert.equal(states[0], initial);
    assert.equal(states[4], true);
    assert.equal(states[5], lastRead);
    const rendered = JSON.stringify(render());
    assert.match(rendered, /ยังอ่านสถานะล่าสุดไม่ได้/);
    assert.match(rendered, /อ่านสถานะสำเร็จล่าสุด/);
    assert.doesNotMatch(rendered, /PRIVATE_.*CANARY/);
  }
  now += 3000;
  const completed = { ...initial, terminal: true, job: { ...initial.job, status: "completed" } };
  response = async () => ({ ok: true, json: async () => completed });
  await poll();
  assert.equal(states[0], completed);
  assert.equal(states[4], false);
  assert.equal(states[5], new Date(now).toISOString());
  assert.doesNotMatch(JSON.stringify(render()), /ยังอ่านสถานะล่าสุดไม่ได้/);
  cleanup.forEach(fn => fn?.());
  response = async () => { throw new Error("PRIVATE_NETWORK_CANARY"); };
  await poll();
  assert.equal(states[4], false, "an unmounted poll cannot change warning state");
  assert.equal(timers.size, 0);
});

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
  assert.match(component, /ลำดับการทำงาน/);
  assert.match(component, /baseline\.p50Ms/);
  assert.match(component, /baseline\.p90Ms/);
  assert.match(component, /heartbeat_stale/);
  assert.match(component, /n8nExecutionId/);
  assert.match(component, /Agent OS/);
  assert.match(component, /n8n Execution/);
  assert.match(component, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(component, /progress.*%|Math\.min\(100|setProgress/i);
});

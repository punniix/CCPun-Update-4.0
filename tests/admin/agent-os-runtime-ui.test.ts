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
  const initial = { job: { jobId: "synthetic-job", status: "waiting_external", stage: "n8n-received", action: "seo.cluster.uat", source: "admin", workflowKey: "seo.cluster.uat", startedAt: new Date(now - 602_000).toISOString(), queuedAt: new Date(now - 602_000).toISOString(), attempt: 1, maxAttempts: 2, rowVersion: 1, providerReference: null, errorCategory: null },
    terminal: false, elapsedMs: 0, pace: "unknown", baseline: { sampleSize: 0, p50Ms: null, p90Ms: null }, events: [], serverNow: new Date(now).toISOString() };
  const states: unknown[] = []; let index = 0;
  const effects: Array<() => (() => void) | undefined> = [];
  const timers = new Map<number, () => Promise<void>>();
  let response: () => Promise<unknown> = async () => { throw new Error("PRIVATE_NETWORK_CANARY"); };
  let fetchCount = 0;
  const loaded = { exports: {} as { AgentRuntimeJobStatus: (props: unknown) => unknown } };
  runInNewContext(compiled, { module: loaded, exports: loaded.exports, Date: Clock,
    window: { setInterval: (fn: () => Promise<void>, delay: number) => { timers.set(delay, fn); return delay; }, clearInterval: (id: number) => timers.delete(id) },
    fetch: () => { fetchCount++; return response(); },
    require: (name: string) => {
      if (name === "./job-copy") return jobCopy;
      if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
      assert.equal(name, "react");
      return { useEffect: (fn: () => (() => void) | undefined) => effects.push(fn), useMemo: (fn: () => unknown) => fn(),
        useRef: (value: unknown) => { const slot = index++; if (!(slot in states)) states[slot] = { current: value }; return states[slot]; },
        useState: (value: unknown) => { const slot = index++; if (!(slot in states)) states[slot] = typeof value === "function" ? (value as () => unknown)() : value;
          return [states[slot], (next: unknown) => { states[slot] = next; }]; } };
    } });
  const render = () => { index = 0; effects.length = 0; return loaded.exports.AgentRuntimeJobStatus({ initial, canReconcileTimeout: true }); };
  render();
  const cleanup = effects.map(fn => fn());
  const poll = timers.get(3000)!;
  assert.ok(poll);
  const lastRead = states[5];
  for (const fail of [
    async () => { throw new Error("PRIVATE_NETWORK_CANARY"); },
    async () => ({ ok: false, json: () => assert.fail("failed response body must not be read") }),
    async () => ({ ok: true, json: async () => { throw new Error("PRIVATE_BODY_CANARY"); } }),
    async () => ({ ok: true, json: async () => ({ terminal: false }) }),
    async () => ({ ok: true, json: async () => ({ ...initial, job: { ...initial.job, jobId: "synthetic-wrong-job" } }) }),
    async () => ({ ok: true, json: async () => ({ ...initial, events: [{ eventId: "synthetic", status: "running", attempt: 1, occurredAt: "invalid-date", errorCategory: null }] }) }),
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
  // Real deferred callbacks return out of order: late version 2 cannot undo version 3.
  const pending: Array<(value: unknown) => void> = [];
  response = async () => new Promise(resolve => pending.push(resolve));
  const olderPoll = poll();
  const newerPoll = poll();
  now += 3000;
  const newer = { ...initial, job: { ...initial.job, rowVersion: 3, status: "running" } };
  pending[1]({ ok: true, json: async () => newer });
  await newerPoll;
  const newerReadAt = states[5];
  now += 3000;
  pending[0]({ ok: true, json: async () => ({ ...initial, job: { ...initial.job, rowVersion: 2 } }) });
  await olderPoll;
  assert.equal(states[0], newer);
  assert.equal(states[5], newerReadAt, "a stale response cannot advance the last confirmed read time");
  assert.equal(states[4], true);
  now += 3000;
  const waiting = { ...initial, job: { ...initial.job, rowVersion: 4 } };
  response = async () => ({ ok: true, json: async () => waiting });
  await poll();
  // A reconciliation readback must not undo a newer poll that completed in parallel.
  type Node = { type?: string; props?: { children?: unknown; onClick?: () => Promise<void> } };
  const nodes: unknown[] = [render()];
  let reconcile: (() => Promise<void>) | undefined;
  while (nodes.length) {
    const value = nodes.pop();
    if (Array.isArray(value)) { nodes.push(...value); continue; }
    if (!value || typeof value !== "object") continue;
    const node = value as Node;
    if (node.type === "button") reconcile = node.props?.onClick;
    nodes.push(node.props?.children);
  }
  assert.ok(reconcile);
  const readbacks: Array<(value: unknown) => void> = [];
  response = async () => new Promise(resolve => readbacks.push(resolve));
  const reconciliation = reconcile();
  readbacks[0]({ ok: true });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(readbacks.length, 2);
  const latestPoll = poll();
  now += 3000;
  const latest = { ...initial, job: { ...initial.job, rowVersion: 6, status: "running" } };
  readbacks[2]({ ok: true, json: async () => latest });
  await latestPoll;
  const latestReadAt = states[5];
  now += 3000;
  readbacks[1]({ ok: true, json: async () => ({ ...initial, job: { ...initial.job, rowVersion: 5 } }) });
  await reconciliation;
  assert.equal(states[0], latest);
  assert.equal(states[5], latestReadAt);
  assert.equal(states[4], true);
  assert.match(String(states[3]), /ยังยืนยันสถานะล่าสุดไม่ได้/);
  now += 3000;
  const completed = { ...initial, terminal: true, job: { ...initial.job, rowVersion: 7, status: "completed" } };
  response = async () => ({ ok: true, json: async () => completed });
  await poll();
  assert.equal(states[0], completed);
  assert.equal(states[4], false);
  assert.equal(states[5], new Date(now).toISOString());
  assert.doesNotMatch(JSON.stringify(render()), /ยังอ่านสถานะล่าสุดไม่ได้/);
  // An expired session stops polling the same job and never exposes response bodies.
  response = async () => ({ ok: false, status: 401, json: () => assert.fail("401 body must not be read") });
  await poll();
  assert.equal(states[0], completed);
  assert.equal(states[6], true);
  assert.match(JSON.stringify(render()), /เซสชันหมดอายุ/);
  assert.equal(timers.has(3000), false);
  const expiredFetchCount = fetchCount;
  await poll();
  assert.equal(fetchCount, expiredFetchCount, "a callback already queued before 401 must not issue another request");
  cleanup.forEach(fn => fn?.());
  response = async () => { throw new Error("PRIVATE_NETWORK_CANARY"); };
  await poll();
  assert.equal(fetchCount, expiredFetchCount, "a stale callback cannot fetch after cleanup");
  assert.equal(states[4], true, "an unmounted poll cannot change warning state");
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

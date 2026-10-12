import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { z } from "zod";
import * as jobCopy from "../../features/admin/operations/job-copy";
import { isPostPublishAdminOriginAllowed } from "../../lib/admin/seo-intelligence/post-publish-origin";

const { transpileModule, ModuleKind } = createRequire(import.meta.url)("typescript") as typeof import("typescript");
const source = readFileSync(new URL("../../apps/admin/app/api/admin/operations/jobs/[jobId]/route.ts", import.meta.url), "utf8");
const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
const now = 1_797_800_000_000;
const jobId = "d2f46082-7149-401a-a8a7-f20ee8180e25";
const initialJob = { jobId, rowVersion: 2, source: "admin", action: "seo.cluster.uat", workflowKey: "seo.cluster.uat",
  status: "waiting_external", stage: "n8n-dispatching", startedAt: new Date(now - 601_001).toISOString() };
const env = { CCPUN_N8N_P1_UAT_ENABLED: "true", CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
  CCPUN_DEPLOYMENT_ROLE: "admin", AUTH_URL: "https://admin-test.ccpun.com" };

test("owner timeout reconciliation executes the route, preserves CAS and never redispatches", async () => {
  async function run(options: {
    environment?: string; enabled?: string; role?: string | null; origin?: string; host?: string;
    job?: Partial<typeof initialJob>; absent?: boolean; age?: number; readState?: string;
    payload?: unknown; raw?: string; contentType?: string; outcome?: string; dbFailure?: boolean;
  } = {}) {
    const writes: unknown[] = [];
    const stored = { ...initialJob, ...options.job };
    if (options.age !== undefined) stored.startedAt = new Date(now - options.age).toISOString();
    const loaded = { exports: {} as { PATCH: (request: Request, context: { params: Promise<{ jobId: string }> }) => Promise<Response> } };
    runInNewContext(compiled, {
      exports: loaded.exports, module: loaded, Buffer,
      Date: { now: () => now, parse: Date.parse },
      process: { env: { ...env, CCPUN_N8N_P1_UAT_ENABLED: options.enabled ?? "true" } },
      fetch: () => assert.fail("reconciliation must not dispatch external work"),
      require: (name: string) => {
        if (name === "next/server") return { NextResponse: { json: Response.json } };
        if (name === "zod") return { z };
        if (name.endsWith("/identity")) return { getAdminIdentity: async () => options.role === null ? null : { role: options.role ?? "owner" } };
        if (name.endsWith("/rbac")) return { hasAdminPermission: () => true };
        if (name.endsWith("/environment")) return { getAdminEnvironment: () => options.environment ?? "admin-uat" };
        if (name.endsWith("/post-publish-origin")) return { isPostPublishAdminOriginAllowed };
        if (name.endsWith("/agent-os-runtime-detail")) return {};
        if (name.endsWith("/agent-os-runtime")) return {
          readAgentRuntimeJobById: async (id: string) => {
            assert.equal(id, jobId);
            return { state: options.readState ?? "ready", job: options.absent ? null : stored };
          },
          updateAgentRuntimeJob: async (patch: Record<string, unknown>) => {
            writes.push(JSON.parse(JSON.stringify(patch)));
            if (options.dbFailure) throw new Error("synthetic-db-unavailable");
            if (options.outcome === "conflict") {
              stored.status = "completed"; // Concurrent signed callback wins the DB CAS.
              return { outcome: "conflict", rowVersion: 3 };
            }
            assert.equal(patch.expectedVersion, stored.rowVersion);
            Object.assign(stored, patch, { rowVersion: 3 });
            return { outcome: options.outcome ?? "updated", rowVersion: 3 };
          },
        };
        throw new Error("Unexpected dependency " + name);
      },
    });
    const request = new Request("http://127.0.0.1:3000/api/admin/operations/jobs/" + jobId + "/", {
      method: "PATCH", headers: { "content-type": options.contentType ?? "application/json",
        origin: options.origin ?? "https://admin-test.ccpun.com", host: options.host ?? "admin-test.ccpun.com",
        "x-forwarded-host": "admin-test.ccpun.com", "x-forwarded-proto": "https" },
      body: options.raw ?? JSON.stringify(options.payload ?? { action: "reconcile-seo-callback-timeout", expectedVersion: 2 }),
    });
    const response = await loaded.exports.PATCH(request, { params: Promise.resolve({ jobId }) });
    assert.match(response.headers.get("Cache-Control") ?? "", /no-store/);
    assert.match(response.headers.get("X-Robots-Tag") ?? "", /noindex/);
    return { response, writes, stored };
  }

  for (const [options, status] of [
    [{ environment: "production-admin" }, 404], [{ enabled: "false" }, 404],
    [{ role: null }, 401], [{ role: "editor" }, 403],
    [{ origin: "https://admin.ccpun.com" }, 403], [{ host: "evil.example" }, 403],
    [{ contentType: "text/plain" }, 415], [{ raw: "x".repeat(1025) }, 413], [{ raw: "{" }, 400],
    [{ payload: { action: "complete", expectedVersion: 2 } }, 400],
    [{ payload: { action: "reconcile-seo-callback-timeout", expectedVersion: 2, status: "completed" } }, 400],
    [{ payload: { action: "reconcile-seo-callback-timeout", expectedVersion: 1 } }, 409],
    [{ age: 601_000 }, 409], [{ age: -1 }, 409], [{ job: { startedAt: "invalid" } }, 409],
    [{ job: { source: "n8n" } }, 409], [{ job: { action: "exports.google_sheet.uat" } }, 409],
    [{ job: { workflowKey: "seo.cluster.production" } }, 409], [{ job: { stage: "other-stage" } }, 409],
    [{ job: { status: "completed" } }, 409], [{ job: { status: "reconciliation_required" } }, 409],
    [{ absent: true }, 404], [{ readState: "unavailable" }, 503],
  ] as const) {
    const result = await run(options);
    assert.equal(result.response.status, status, JSON.stringify(options));
    assert.equal(result.writes.length, 0, "rejected request mutated job metadata");
  }
  for (const stage of ["n8n-dispatching", "n8n-received"]) {
    const result = await run({ job: { stage } });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.writes, [{ jobId, expectedVersion: 2, status: "reconciliation_required",
      stage: "seo.uat.callback-timeout", errorCategory: "n8n-callback-timeout" }]);
    assert.deepEqual(await result.response.json(), { status: "reconciliation_required", jobId, rowVersion: 3 });
  }
  const race = await run({ outcome: "conflict" });
  assert.equal(race.response.status, 409);
  assert.equal(race.stored.status, "completed", "reconciliation overwrote the concurrent callback");
  const unavailable = await run({ dbFailure: true });
  assert.equal(unavailable.response.status, 503);
  assert.equal(unavailable.response.headers.get("Retry-After"), "5");
  assert.equal(unavailable.stored.status, "waiting_external");
});


test("existing job UI exposes explicit owner timeout action and reports stale versions without retry", async () => {
  const component = readFileSync(new URL("../../features/admin/operations/AgentRuntimeJobStatus.tsx", import.meta.url), "utf8");
  const ui = transpileModule(component, { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
  type Element = { type: string; props: { children?: unknown; onClick?: () => Promise<void> } };
  function buttons(node: unknown): Element[] {
    if (Array.isArray(node)) return node.flatMap(buttons);
    if (!node || typeof node !== "object" || !("props" in node)) return [];
    const element = node as Element;
    return [...(element.type === "button" ? [element] : []), ...buttons(element.props.children)];
  }
  async function fixture(permission: boolean, age: number, status = 200) {
    const initial = { job: { ...initialJob, startedAt: new Date(now - age).toISOString(), attempt: 1, maxAttempts: 2,
      queuedAt: initialJob.startedAt, createdAt: initialJob.startedAt, n8nExecutionId: null, providerReference: null, errorCategory: null },
      terminal: false, elapsedMs: age, pace: "unknown", baseline: { sampleSize: 0 }, events: [] };
    const states: unknown[] = []; let index = 0;
    const calls: Array<{ path: string; options?: RequestInit }> = [];
    const loaded = { exports: {} as { AgentRuntimeJobStatus: (props: unknown) => unknown } };
    runInNewContext(ui, {
      exports: loaded.exports, module: loaded, Date: { now: () => now, parse: Date.parse },
      fetch: async (path: string, options?: RequestInit) => {
        calls.push({ path, options });
        return options?.method === "PATCH"
          ? Response.json(status === 200 ? { status: "reconciliation_required" } : { error: "stale-version" }, { status })
          : Response.json({ ...initial, terminal: true, job: { ...initial.job, status: "reconciliation_required", rowVersion: 3 } });
      },
      require: (name: string) => {
        if (name === "./job-copy") return jobCopy;
        if (name === "react/jsx-runtime") return {
          jsx: (type: string, props: unknown) => ({ type, props }), jsxs: (type: string, props: unknown) => ({ type, props }),
        };
        assert.equal(name, "react");
        return { useEffect: () => {}, useMemo: (value: () => unknown) => value(),
          useState: (value: unknown) => {
            const slot = index++;
            states[slot] = typeof value === "function" ? (value as () => unknown)() : value;
            return [states[slot], (next: unknown) => { states[slot] = next; }];
          } };
      },
    });
    const tree = loaded.exports.AgentRuntimeJobStatus({ initial, canReconcileTimeout: permission });
    return { actions: buttons(tree), states, calls };
  }
  assert.equal((await fixture(false, 601_001)).actions.length, 0);
  assert.equal((await fixture(true, 601_000)).actions.length, 0);
  const success = await fixture(true, 601_001);
  assert.equal(success.actions.length, 1);
  await success.actions[0].props.onClick!();
  assert.equal(success.calls.length, 2);
  assert.equal(success.calls[0].path, `/api/admin/operations/jobs/${jobId}/`);
  assert.equal(success.calls[0].options?.method, "PATCH");
  assert.deepEqual(JSON.parse(success.calls[0].options?.body as string), { action: "reconcile-seo-callback-timeout", expectedVersion: 2 });
  assert.equal((success.states[0] as { job: { status: string } }).job.status, "reconciliation_required");
  assert.equal(success.states[2], false);
  const stale = await fixture(true, 601_001, 409);
  await stale.actions[0].props.onClick!();
  assert.equal(stale.calls.length, 1, "stale action must not automatically retry");
  assert.match(stale.states[3] as string, /สถานะงานเปลี่ยนแล้ว/);
  assert.equal((stale.states[0] as { job: { status: string } }).job.status, "waiting_external");
  assert.equal(stale.states[2], false);
});

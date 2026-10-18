import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");

// Mount the real Client Component, not a mocked button or copied handler.
// Never send a network request or use a real Owner/OAuth session.
test("GA4 Owner connect sends one native same-origin POST and visibly enters connecting state", async () => {
  const dom = new JSDOM("<div id='root'></div>", {
    url: "https://admin-test.ccpun.com/seo/opportunities/",
  });
  const previous = {
    window: globalThis.window, document: globalThis.document,
    HTMLFormElement: globalThis.HTMLFormElement,
    IS_REACT_ACT_ENVIRONMENT: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document,
    HTMLFormElement: dom.window.HTMLFormElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const submissions: Array<{ method: string; action: string }> = [];
  const originalSubmit = dom.window.HTMLFormElement.prototype.submit;
  dom.window.HTMLFormElement.prototype.submit = function () {
    submissions.push({ method: this.method, action: this.action });
  };
  const source = readFileSync(new URL("../../features/admin/seo/opportunities/Ga4ManualSync.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: { default?: React.ComponentType<Record<string, unknown>> } = {};
  new Function("require", "exports", compiled)(require, exports);
  const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    await act(async () => {
      root.render(createElement(exports.default!, {
        defaultStartDate: "2026-10-01", defaultEndDate: "2026-10-17",
        laneLabel: "พื้นที่ทดสอบ", sessionConnectAllowed: true,
        sessionConnectionState: "connect-required",
      }));
    });
    const form = dom.window.document.querySelector('form[action="/api/admin/seo/providers/connect/"]') as HTMLFormElement;
    assert.ok(form, "the same-origin native form is present");
    assert.equal(form.method.toLowerCase(), "post");
    const button = form.querySelector("button") as HTMLButtonElement;
    assert.equal(button.type, "submit");
    assert.equal(button.disabled, false);
    await act(async () => {
      form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    });
    assert.equal(button.disabled, true);
    assert.match(button.textContent ?? "", /กำลังเปิดหน้าการเชื่อมต่อ Google/);
    assert.match(form.textContent ?? "", /กำลังส่งคำขอเชื่อมต่อจาก Owner/);
    await new Promise(resolve => setTimeout(resolve, 110));
    assert.deepEqual(submissions, [{
      method: "post", action: "https://admin-test.ccpun.com/api/admin/seo/providers/connect/",
    }]);
    await act(async () => {
      form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    });
    assert.equal(submissions.length, 1, "repeated submit cannot start a second OAuth attempt");
  } finally {
    await act(async () => root.unmount());
    dom.window.HTMLFormElement.prototype.submit = originalSubmit;
    Object.assign(globalThis, previous);
    dom.window.close();
  }
});


test("deployed Admin CSP permits the exact Google OAuth form redirect without changing other security headers", () => {
  const { buildNextSecurityHeaders } = require("../../lib/runtime/security-headers.mjs");
  const source = readFileSync(new URL("../../apps/admin/next.config.ts", import.meta.url), "utf8");
  const expression = source.match(/const SECURITY_HEADERS = ([\s\S]*?);\nconst STUDIO_SECURITY_HEADERS/);
  assert.ok(expression, "evaluate the actual Admin security-header expression");
  type Header = { key: string; value: string };
  for (const environment of ["admin-uat", "production-admin", "production", "web-uat", "local-uat", "local-production", "development", "unknown", ""]) {
    const options = { isReviewEnvironment: true, sanityProjectId: "", appEnvironment: environment, nodeEnv: "production" };
    const baseline: Header[] = buildNextSecurityHeaders(options);
    const actual: Header[] = JSON.parse(JSON.stringify(runInNewContext(expression[1], {
      buildNextSecurityHeaders: (input: Record<string, unknown>) => buildNextSecurityHeaders({ ...input, nodeEnv: "production" }),
      USE_REAL_DRAFT_PREVIEW_RUNTIME: true, SANITY_PROJECT_ID: "", ADMIN_ENVIRONMENT: environment,
    })));
    const policy = actual.find(header => header.key === "Content-Security-Policy")!.value;
    const formAction = policy.split("; ").find(directive => directive.startsWith("form-action "))!;
    if (["admin-uat", "production-admin"].includes(environment)) {
      assert.equal(formAction, "form-action 'self' https://www.facebook.com https://accounts.google.com");
      const restored = actual.map(header => header.key === "Content-Security-Policy" ? {
        ...header, value: header.value.split("; ").map(directive => directive.startsWith("form-action ")
          ? directive.replace(" https://accounts.google.com", "") : directive).join("; "),
      } : header);
      assert.deepEqual(restored, baseline, "every other directive/header remains byte-identical");
    } else {
      assert.equal(formAction, "form-action 'self' https://www.facebook.com");
      assert.deepEqual(actual, baseline, "Web, local and unknown lanes retain their whole original policy");
    }
  }
});


test("GA4 manual failures retain friendly messages and redact all unrecognized response details", async () => {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://admin-test.ccpun.com/seo/opportunities/" });
  const previous = {
    window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch,
    IS_REACT_ACT_ENVIRONMENT: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const source = readFileSync(new URL("../../features/admin/seo/opportunities/Ga4ManualSync.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: { default?: React.ComponentType<Record<string, unknown>> } = {};
  new Function("require", "exports", compiled)(require, exports);
  const root = createRoot(dom.window.document.getElementById("root")!);
  const generic = "ดึงข้อมูลไม่สำเร็จและไม่มีข้อมูลใดถูกบันทึก";
  const marker = "SYNTHETIC_PRIVATE_RESPONSE_DO_NOT_DISPLAY";
  const cases = [
    { status: 502, body: `<html>${marker}</html>`, expected: `${generic} (HTTP 502; error=unknown-response; JSON=false)` },
    { status: 503, body: JSON.stringify({ error: "provider-unavailable", requestId: marker, detail: marker }), expected: `${generic} (HTTP 503; error=provider-unavailable; JSON=true)` },
    { status: 403, body: JSON.stringify({ error: "forbidden-origin", raw: marker }), expected: `${generic} (HTTP 403; error=forbidden-origin; JSON=true)` },
    { status: 403, body: JSON.stringify({ error: "invalid-origin", raw: marker }), expected: `${generic} (HTTP 403; error=invalid-origin; JSON=true)` },
    { status: 502, body: JSON.stringify({ error: marker, detail: marker }), expected: `${generic} (HTTP 502; error=unknown-response; JSON=true)` },
    { status: 502, body: JSON.stringify({ error: { message: marker } }), expected: `${generic} (HTTP 502; error=unknown-response; JSON=true)` },
    { status: 502, body: JSON.stringify({ error: "constructor", detail: marker }), expected: `${generic} (HTTP 502; error=unknown-response; JSON=true)` },
    { status: 502, body: "null", expected: `${generic} (HTTP 502; error=unknown-response; JSON=true)` },
    { status: 502, body: JSON.stringify([{ error: marker }]), expected: `${generic} (HTTP 502; error=unknown-response; JSON=true)` },
    { status: 409, body: JSON.stringify({ error: "provider-not-connected", detail: marker }), expected: "ยังไม่ได้เชื่อม GA4 สำหรับ พื้นที่ทดสอบ" },
    { status: 409, body: JSON.stringify({ error: "provider-auth-required", detail: marker }), expected: "สิทธิ์ GA4 หมดอายุ กรุณาเชื่อมใหม่" },
    { status: 429, body: JSON.stringify({ error: "provider-rate-limited", detail: marker }), expected: "GA4 จำกัดการเรียก กรุณารอแล้วลองใหม่" },
    { status: 504, body: JSON.stringify({ error: "provider-timeout", detail: marker }), expected: "GA4 ตอบช้าเกินกำหนด กรุณาลองใหม่" },
    { status: 502, body: JSON.stringify({ error: "provider-invalid-response", detail: marker }), expected: "ข้อมูลจาก GA4 ไม่อยู่ในรูปแบบที่รองรับ" },
    { status: 409, body: JSON.stringify({ error: "sync-in-progress", detail: marker }), expected: "มีการดึงข้อมูลอยู่แล้ว กรุณารอให้เสร็จ" },
  ];
  let calls = 0;
  try {
    await act(async () => root.render(createElement(exports.default!, {
      defaultStartDate: "2026-10-01", defaultEndDate: "2026-10-17", laneLabel: "พื้นที่ทดสอบ",
    })));
    for (const item of cases) {
      globalThis.fetch = async (input, init) => {
        calls++;
        assert.equal(input, "/api/admin/seo/opportunities/sync/ga4/");
        assert.equal(init?.method, "POST");
        assert.deepEqual(JSON.parse(String(init?.body)), { startDate: "2026-10-01", endDate: "2026-10-17" });
        return new Response(item.body, { status: item.status });
      };
      const button = dom.window.document.querySelector("button") as HTMLButtonElement;
      await act(async () => button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
      assert.equal(dom.window.document.querySelector('[role="alert"]')?.textContent, item.expected);
      assert.equal(dom.window.document.body.textContent?.includes(marker), false, "raw payload/requestId/unknown errors never reach the page");
    }
    assert.equal(calls, cases.length, "only the explicit click sends a request; no automatic retry");
  } finally {
    await act(async () => root.unmount());
    Object.assign(globalThis, previous);
    dom.window.close();
  }
});


test("GA4 UAT stage markers are fixed, best-effort and preserve real route guards and results", async () => {
  const source = readFileSync(new URL("../../apps/admin/app/api/admin/seo/opportunities/sync/ga4/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const prefix = "CCPUN_GA4_SYNC_STAGE:";
  const allowed = new Set(["entry", "gates-passed", "token-ready", "current-ready", "comparison-ready", "comparison-partial", "failed", "finished", "failed-ga4-auth", "failed-ga4-rate", "failed-ga4-timeout", "failed-ga4-invalid", "failed-ga4-unavailable", "failed-unclassified", "error-response-ready", "phase-input", "phase-fetch", "phase-http", "phase-decode", "phase-schema-headers", "phase-schema-dimension-value", "phase-schema-metric-value", "phase-schema-row-count", "phase-schema-metadata", "phase-schema-other", "phase-normalize-headers", "phase-normalize-values", "phase-normalize-other", "phase-unclassified", "schema-headers-landing-dimension-missing", "schema-headers-landing-dimension-null", "schema-headers-landing-dimension-nonarray", "schema-headers-landing-dimension-name-invalid", "schema-headers-landing-dimension-other", "schema-headers-landing-metric-missing", "schema-headers-landing-metric-null", "schema-headers-landing-metric-nonarray", "schema-headers-landing-metric-name-invalid", "schema-headers-landing-metric-other", "schema-headers-totals-dimension-missing", "schema-headers-totals-dimension-null", "schema-headers-totals-dimension-nonarray", "schema-headers-totals-dimension-name-invalid", "schema-headers-totals-dimension-other", "schema-headers-totals-metric-missing", "schema-headers-totals-metric-null", "schema-headers-totals-metric-nonarray", "schema-headers-totals-metric-name-invalid", "schema-headers-totals-metric-other"]);
  const marker = "SYNTHETIC_PRIVATE_VALUE_MUST_NEVER_BE_LOGGED";
  async function run(mode: string, options: { environment?: string; provider?: string; role?: string; loggerThrows?: boolean; responseThrows?: boolean; failurePhase?: string; failureGetter?: boolean } = {}) {
    const logs: unknown[][] = []; let tokenCalls = 0, providerCalls = 0;
    const environment = options.environment ?? "admin-uat";
    const variables = { CCPUN_DEPLOYMENT_PROVIDER: options.provider ?? "hostinger", CCPUN_DEPLOYMENT_ROLE: options.role ?? "admin",
      CCPUN_GA4_PROPERTY_ID: mode === "wrong-resource" ? "0" : environment === "production-admin" ? "219719845" : "551040812" };
    const response = { rows: [], totals: { sessions: 0, engagedSessions: 0, engagementRate: 0 }, truncated: false, timeZone: null, limitations: [] };
    const mocks: Record<string, unknown> = {
      "node:crypto": { randomUUID: () => marker }, "zod": require("zod"),
      "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => { if (options.responseThrows) throw Error(marker); return Response.json(body, init); } } },
      "@/lib/admin/seo-intelligence/post-publish-origin": { isPostPublishAdminOriginAllowed: () => mode !== "bad-origin" },
      "@/lib/admin/environment": { getAdminEnvironment: () => environment },
      "@/lib/admin/identity": { getAdminIdentity: async () => { if (mode === "auth-failed") throw Error(marker); return mode === "unauthorized" ? null : { actorType: "human", role: "owner" }; } },
      "@/lib/admin/rbac": { hasAdminPermission: () => true },
      "@/lib/admin/seo-intelligence/contracts": { previousEqualDateRange: () => ({ startDate: "2026-09-14", endDate: "2026-09-30" }), joinGa4DashboardRows: () => [] },
      "@/lib/admin/seo-intelligence/foundation": { getSeoIntelligenceRuntimeStatus: () => ({ enabled: mode !== "disabled" }) },
      "@/lib/admin/seo-intelligence/google-data-auth": { getGoogleDataAccessToken: () => assert.fail("no unplanned credential reader") },
      "next/headers": { cookies: async () => ({ set() {} }) },
      "@/lib/admin/seo-intelligence/google-session-connection": { hasGoogleSessionGrant: () => true, getConnectedGoogleAccessToken: async () => {
        tokenCalls++; if (mode === "token-failed") throw Error("GOOGLE_SESSION_CONNECT_REQUIRED"); return marker;
      } },
      "@/lib/admin/seo-intelligence/providers/ga4": { getGa4FailurePhase: (error: unknown) => Object.getOwnPropertyDescriptor(error, "ccpunGa4FailurePhase")?.value ?? null, ...Object.fromEntries(["fetchGa4LandingPages", "fetchGa4OrganicTotals"].map(name => [name, async (input: { startDate: string }) => {
        providerCalls++; if (options.failurePhase || options.failureGetter) { const failure = Error("GA4_INVALID_RESPONSE"); Object.defineProperty(failure, "ccpunGa4FailurePhase", options.failureGetter ? { get() { throw Error(marker); } } : { value: options.failurePhase }); throw failure; } const failure = ({ "current-auth": "GA4_AUTH_REQUIRED", "current-rate": "GA4_RATE_LIMITED", "current-invalid": "GA4_INVALID_RESPONSE", "current-unavailable": "GA4_PROVIDER_UNAVAILABLE", "current-unclassified": marker } as Record<string, string>)[mode]; if (failure) throw Error(failure); if (mode === "current-failed" || (mode === "comparison-failed" && input.startDate === "2026-09-14")) throw Error("GA4_TIMEOUT"); return response;
      }])) },
    };
    const exports: { POST?: (request: Request) => Promise<Response>; trace?: (value: string) => void } = {};
    const fakeConsole = { warn: (...args: unknown[]) => { logs.push(args); if (options.loggerThrows) throw Error(marker); } };
    new Function("require", "exports", "console", "process", compiled + "\nexports.trace = traceGa4SyncStage;")(
      (name: string) => { assert.ok(Object.hasOwn(mocks, name), "only explicit local mock imports"); return mocks[name]; }, exports, fakeConsole, { env: variables });
    const request = new Request("https://admin-test.ccpun.com/api/admin/seo/opportunities/sync/ga4/", { method: "POST", body: JSON.stringify(mode === "invalid-input" ? {} : { startDate: "2026-10-01", endDate: "2026-10-17" }) });
    let result: Response | undefined;
    if (mode === "auth-failed" || options.responseThrows) await assert.rejects(exports.POST!(request), error => error instanceof Error && error.message === marker);
    else result = await exports.POST!(request);
    const count = logs.length; exports.trace!(marker); exports.trace!("constructor"); assert.equal(logs.length, count);
    for (const args of logs) { assert.equal(args.length, 1); assert.equal(typeof args[0], "string"); assert.ok(allowed.has(String(args[0]).slice(prefix.length))); assert.ok(String(args[0]).startsWith(prefix)); }
    assert.equal(JSON.stringify(logs).includes(marker), false, "no request ID, error, token or dynamic value reaches logs");
    return { stages: logs.map(args => String(args[0]).slice(prefix.length)), tokenCalls, providerCalls, status: result?.status, body: result ? await result.json() : null };
  }
  const success = await run("ok"); assert.equal(success.status, 200); assert.equal(success.body.state, "ready"); assert.equal(success.tokenCalls, 1); assert.equal(success.providerCalls, 4);
  assert.deepEqual(success.stages, ["entry", "gates-passed", "token-ready", "current-ready", "comparison-ready", "finished"]);
  for (const [mode, status, error] of [["unauthorized", 401, "unauthorized"], ["bad-origin", 403, "forbidden-origin"], ["disabled", 404, "not-found"], ["invalid-input", 400, "invalid-input"], ["wrong-resource", 409, "provider-not-connected"]] as const) {
    const value = await run(mode); assert.equal(value.status, status); assert.equal(value.body.error, error); assert.deepEqual(value.stages, ["entry"]); assert.equal(value.tokenCalls + value.providerCalls, 0);
  }
  assert.deepEqual((await run("auth-failed")).stages, ["entry"], "no new catch around pre-existing auth failure");
  const token = await run("token-failed"); assert.equal(token.status, 409); assert.equal(token.body.error, "provider-auth-required"); assert.deepEqual(token.stages, ["entry", "gates-passed", "failed", "finished"]);
  const current = await run("current-failed"); assert.equal(current.status, 504); assert.equal(current.body.error, "provider-timeout"); assert.deepEqual(current.stages, ["entry", "gates-passed", "token-ready", "failed", "failed-ga4-timeout", "phase-unclassified", "error-response-ready", "finished"]);
  for (const [mode, status, code, stage] of [["current-auth", 409, "provider-auth-required", "failed-ga4-auth"], ["current-rate", 429, "provider-rate-limited", "failed-ga4-rate"], ["current-invalid", 502, "provider-invalid-response", "failed-ga4-invalid"], ["current-unavailable", 502, "provider-unavailable", "failed-ga4-unavailable"], ["current-unclassified", 502, "provider-unavailable", "failed-unclassified"]] as const) {
    const value = await run(mode); assert.equal(value.status, status); assert.equal(value.body.error, code);
    assert.deepEqual(value.stages, ["entry", "gates-passed", "token-ready", "failed", stage, "phase-unclassified", "error-response-ready", "finished"]);
  }
  assert.deepEqual((await run("current-failed", { responseThrows: true })).stages,
    ["entry", "gates-passed", "token-ready", "failed", "failed-ga4-timeout", "phase-unclassified", "finished"], "response-ready requires successful actual response construction; prior throw remains uncaught");
  for (const phase of ["input", "fetch", "http", "decode", "schema-headers", "schema-dimension-value", "schema-metric-value", "schema-row-count", "schema-metadata", "schema-other", "normalize-headers", "normalize-values", "normalize-other"]) {
    const value = await run("ok", { failurePhase: phase }); assert.equal(value.status, 502);
    assert.deepEqual(value.stages, ["entry", "gates-passed", "token-ready", "failed", "failed-ga4-invalid", "phase-" + phase, "error-response-ready", "finished"]);
  }
  for (const phase of ["schema-headers-landing-dimension-missing", "schema-headers-landing-dimension-null", "schema-headers-landing-dimension-nonarray", "schema-headers-landing-dimension-name-invalid", "schema-headers-landing-dimension-other", "schema-headers-landing-metric-missing", "schema-headers-landing-metric-null", "schema-headers-landing-metric-nonarray", "schema-headers-landing-metric-name-invalid", "schema-headers-landing-metric-other", "schema-headers-totals-dimension-missing", "schema-headers-totals-dimension-null", "schema-headers-totals-dimension-nonarray", "schema-headers-totals-dimension-name-invalid", "schema-headers-totals-dimension-other", "schema-headers-totals-metric-missing", "schema-headers-totals-metric-null", "schema-headers-totals-metric-nonarray", "schema-headers-totals-metric-name-invalid", "schema-headers-totals-metric-other"]) {
    const value = await run("ok", { failurePhase: phase }); assert.equal(value.status, 502); assert.equal(value.body.error, "provider-invalid-response");
    assert.deepEqual(value.stages, ["entry", "gates-passed", "token-ready", "failed", "failed-ga4-invalid", "phase-schema-headers", phase, "error-response-ready", "finished"]);
  }
  for (const options of [{ failurePhase: marker }, { failureGetter: true }]) {
    const value = await run("ok", options); assert.equal(value.status, 502);
    assert.ok(value.stages.includes("phase-unclassified")); assert.ok(value.stages.includes("error-response-ready"));
  }
  const comparison = await run("comparison-failed"); assert.equal(comparison.status, 200); assert.equal(comparison.body.state, "partial"); assert.deepEqual(comparison.stages, ["entry", "gates-passed", "token-ready", "current-ready", "comparison-partial", "finished"]);
  assert.equal((await run("ok", { loggerThrows: true })).status, 200, "logger failures cannot alter business response");
  for (const options of [{ environment: "production-admin" }, { provider: "local" }, { role: "web" }]) assert.deepEqual((await run("ok", options)).stages, [], "only exact Hostinger Admin UAT logs markers");
});

test("GA4 provider failure phases retain error enums and reveal only fixed schema groups", async () => {
  const source = readFileSync(new URL("../../lib/admin/seo-intelligence/providers/ga4.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
  const functions: { getGa4FailurePhase?: (error: unknown) => string | null; fetchGa4LandingPages?: (input: unknown, fetcher: typeof fetch) => Promise<unknown>; fetchGa4OrganicTotals?: (input: unknown, fetcher: typeof fetch) => Promise<unknown> } = {};
  const contracts = { ...require("../../lib/admin/seo-intelligence/contracts.ts") };
  new Function("require", "exports", compiled)((name: string) => {
    if (name === "server-only") return {};
    if (name === "zod") return require("zod");
    assert.equal(name, "../contracts"); return contracts;
  }, functions);
  const input = { propertyId: "1", token: "SYNTHETIC_NOT_REAL_TOKEN", startDate: "2026-10-01", endDate: "2026-10-17" };
  const dimensionHeaders = [{ name: "landingPage" }], metricHeaders = [{ name: "sessions" }, { name: "engagedSessions" }];
  const base = { dimensionHeaders, metricHeaders };
  let requests = 0;
  async function failure(phase: string, code: string, payload: unknown, status = 200, mode = "json", totals = false) {
    const fakeFetch = (async () => { requests++;
      if (mode === "network") throw TypeError("SYNTHETIC_PRIVATE_NOT_LOGGABLE");
      if (mode === "timeout") throw new DOMException("SYNTHETIC_PRIVATE_NOT_LOGGABLE", "TimeoutError");
      return mode === "decode" ? new Response("SYNTHETIC_NOT_JSON", { status }) : Response.json(payload, { status });
    }) as typeof fetch;
    await assert.rejects((totals ? functions.fetchGa4OrganicTotals! : functions.fetchGa4LandingPages!)(input, fakeFetch), (error: unknown) => {
      assert.ok(error instanceof Error); assert.equal(error.message, code);
      const field = Object.getOwnPropertyDescriptor(error, "ccpunGa4FailurePhase");
      assert.deepEqual(field, { value: phase, enumerable: false, writable: false, configurable: false });
      assert.equal(functions.getGa4FailurePhase!(error), phase);
      assert.equal(functions.getGa4FailurePhase!(new Proxy(error, { getOwnPropertyDescriptor() { throw Error("SYNTHETIC_ONLY"); } })), null);
      assert.equal(JSON.stringify(error), "{}", "phase metadata does not become response data"); return true;
    });
  }
  for (const [status, code] of [[401, "GA4_AUTH_REQUIRED"], [403, "GA4_AUTH_REQUIRED"], [429, "GA4_RATE_LIMITED"], [400, "GA4_INVALID_RESPONSE"], [500, "GA4_PROVIDER_UNAVAILABLE"]] as const)
    await failure("http", code, {}, status);
  await failure("fetch", "GA4_PROVIDER_UNAVAILABLE", {}, 200, "network");
  await failure("fetch", "GA4_TIMEOUT", {}, 200, "timeout");
  await failure("decode", "GA4_INVALID_RESPONSE", {}, 200, "decode");
  await failure("schema-headers-landing-dimension-missing", "GA4_INVALID_RESPONSE", {});
  await failure("schema-dimension-value", "GA4_INVALID_RESPONSE", { ...base, rows: [{ dimensionValues: [{}], metricValues: [{ value: "1" }, { value: "0" }] }] });
  await failure("schema-metric-value", "GA4_INVALID_RESPONSE", { ...base, rows: [{ dimensionValues: [{ value: "/synthetic/" }], metricValues: [{}, { value: "0" }] }] });
  await failure("schema-row-count", "GA4_INVALID_RESPONSE", { ...base, rowCount: null });
  await failure("schema-metadata", "GA4_INVALID_RESPONSE", { ...base, metadata: null });
  await failure("schema-other", "GA4_INVALID_RESPONSE", { ...base, rows: "SYNTHETIC_NOT_AN_ARRAY" });
  await failure("normalize-headers", "GA4_INVALID_RESPONSE", { ...base, dimensionHeaders: [{ name: "syntheticWrongHeader" }] });
  await failure("normalize-values", "GA4_INVALID_RESPONSE", { ...base, rows: [{ dimensionValues: [{ value: "/synthetic/" }], metricValues: [{ value: "1" }, { value: "2" }] }] });
  await failure("schema-metric-value", "GA4_INVALID_RESPONSE", { metricHeaders, rows: [{ metricValues: [{}] }] }, 200, "json", true);
  const zod = require("zod"), privateMessage = Error("SYNTHETIC_ONLY");
  Object.defineProperty(privateMessage, "message", { get() { throw Error("SYNTHETIC_ONLY"); } });
  const issuePath = new zod.ZodError([{ code: "custom", path: [], message: "SYNTHETIC_ONLY" }]);
  Object.defineProperty(issuePath.issues[0], "path", { get() { throw Error("SYNTHETIC_ONLY"); } });
  const issueGetter = new Proxy(new zod.ZodError([{ code: "custom", path: [], message: "SYNTHETIC_ONLY" }]), {
    get(target, key, receiver) { if (key === "issues") throw Error("SYNTHETIC_ONLY"); return Reflect.get(target, key, receiver); },
  });
  const originalLanding = contracts.normalizeGa4LandingPageReport, originalTotals = contracts.normalizeGa4OrganicTotalsReport;
  for (const malformed of [privateMessage, issueGetter, issuePath]) {
    contracts.normalizeGa4LandingPageReport = () => { throw malformed; };
    contracts.normalizeGa4OrganicTotalsReport = () => { throw malformed; };
    await failure("normalize-other", "GA4_INVALID_RESPONSE", base);
    await failure("normalize-other", "GA4_INVALID_RESPONSE", { metricHeaders }, 200, "json", true);
  }
  contracts.normalizeGa4LandingPageReport = originalLanding; contracts.normalizeGa4OrganicTotalsReport = originalTotals;
  const forged = Error("GA4_INVALID_RESPONSE"); Object.defineProperty(forged, "ccpunGa4FailurePhase", { value: "http" });
  assert.equal(functions.getGa4FailurePhase!(forged), null, "plain errors cannot impersonate private provider provenance");
  const getter = Error("GA4_INVALID_RESPONSE"); Object.defineProperty(getter, "ccpunGa4FailurePhase", { get() { assert.fail("no untrusted getter invocation"); } });
  assert.equal(functions.getGa4FailurePhase!(getter), null);
  const noData = await functions.fetchGa4LandingPages!(input, (async () => { requests++; return Response.json(base); }) as typeof fetch);
  assert.deepEqual((noData as { rows: unknown[] }).rows, []);
  // Exact published Google REST sample, not a query against the Owner property.
  // https://developers.google.com/analytics/devguides/reporting/data/v1/basics#read_the_response
  const googleSample = { dimensionHeaders: [{ name: "country" }], metricHeaders: [{ name: "activeUsers", type: "TYPE_INTEGER" }], rows: [
    { dimensionValues: [{ value: "Japan" }], metricValues: [{ value: "2541" }] },
    { dimensionValues: [{ value: "France" }], metricValues: [{ value: "12" }] },
  ], metadata: {}, rowCount: 2 };
  await failure("normalize-headers", "GA4_INVALID_RESPONSE", googleSample);
  for (const totals of [false, true]) for (const group of ["dimension", "metric"] as const) {
    for (const shape of ["missing", "null", "nonarray", "name-invalid", "other"] as const) {
      if (totals && group === "dimension" && shape === "missing") continue; // Existing totals contract legitimately defaults absent dimensions.
      if (totals && group === "metric" && shape === "missing") continue; // Proven-empty totals now admit omitted repeated metric headers only.
      const payload: Record<string, unknown> = { dimensionHeaders: totals ? [] : dimensionHeaders, metricHeaders };
      const field = group === "dimension" ? "dimensionHeaders" : "metricHeaders";
      if (shape === "missing") delete payload[field];
      else payload[field] = shape === "null" ? null : shape === "nonarray" ? {} : shape === "name-invalid" ? [{}] : [null];
      await failure(`schema-headers-${totals ? "totals" : "landing"}-${group}-${shape}`, "GA4_INVALID_RESPONSE", payload, 200, "json", totals);
    }
  }
  // Untrusted accessor/Proxy metadata must never invoke a getter or change the public error.
  const headerIssue = new zod.ZodError([{ code: "custom", path: ["dimensionHeaders"], message: "SYNTHETIC_ONLY" }]);
  contracts.normalizeGa4LandingPageReport = () => { throw headerIssue; };
  for (const raw of [Object.defineProperty({}, "dimensionHeaders", { get() { assert.fail("no raw getter invocation"); } }),
    new Proxy({}, { getOwnPropertyDescriptor() { throw Error("SYNTHETIC_ONLY"); } })]) {
    await assert.rejects(functions.fetchGa4LandingPages!(input, (async () => { const response = Response.json({}); Object.defineProperty(response, "json", { value: async () => raw }); return response; }) as typeof fetch), (error: unknown) => {
      assert.ok(error instanceof Error); assert.equal(error.message, "GA4_INVALID_RESPONSE");
      assert.equal(functions.getGa4FailurePhase!(error), "schema-headers-landing-dimension-other"); return true;
    });
  }
  contracts.normalizeGa4LandingPageReport = originalLanding;
  for (const phase of ["schema-headers-landing-dimension-missing", "schema-headers-landing-dimension-SYNTHETIC_ONLY"]) {
    const forged = Object.defineProperty(Error("GA4_INVALID_RESPONSE"), "ccpunGa4FailurePhase", { value: phase });
    assert.equal(functions.getGa4FailurePhase!(forged), null, "new structural phases retain private class provenance");
  }
  const before = requests;
  await assert.rejects(functions.fetchGa4LandingPages!({ ...input, token: "" }, (async () => { requests++; assert.fail("invalid input cannot reach a provider"); }) as typeof fetch), error => error instanceof require("zod").ZodError);
  assert.equal(requests, before, "input validation remains before egress and retains its original ZodError");
});


test("GA4 totals accept only documented empty ProtoJSON envelopes without synthesizing headers or summing landing rows", async () => {
  const source = readFileSync(new URL("../../lib/admin/seo-intelligence/contracts.ts", import.meta.url), "utf8");
  const contracts: { normalizeGa4OrganicTotalsReport?: (raw: unknown) => { totals: { sessions: number; engagedSessions: number; engagementRate: number }; timeZone: string | null; limitations: string[] }; normalizeGa4LandingPageReport?: (raw: unknown) => { rows: Array<{ sessions: number }> } } = {};
  new Function("require", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText)(require, contracts);
  const normalize = contracts.normalizeGa4OrganicTotalsReport!;
  // RunReportResponse/ProtoJSON: repeated arrays and default rowCount=0 may be absent.
  // https://protobuf.dev/programming-guides/json/ and Google RunReportResponse reference.
  const empty = [{}, { metricHeaders: [], rows: [], rowCount: 0, dimensionHeaders: [] },
    { kind: "analyticsData#runReport", metadata: { timeZone: "Asia/Bangkok", currencyCode: "THB", emptyReason: "SYNTHETIC_EMPTY_REASON" }, propertyQuota: { tokensPerDay: { consumed: 1, remaining: 9 } } }];
  for (const payload of empty) assert.deepEqual(normalize(payload).totals, { sessions: 0, engagedSessions: 0, engagementRate: 0 });
  assert.equal(normalize(empty[2]).timeZone, "Asia/Bangkok");
  const malformed: unknown[] = [null, [], { metricHeaders: null }, { rows: null }, { rows: [{}] }, { rowCount: 1 }, { rowCount: "0" },
    { dimensionHeaders: [{ name: "country" }] }, { metricHeaders: [{ name: "wrong" }] }, { totals: [{}] }, { maximums: [{}] }, { minimums: [{}] },
    { error: {} }, { reports: [] }, { unexpected: true }, { kind: "other" }, { metadata: null }, { metadata: { error: "SYNTHETIC_ONLY" } },
    { metadata: { timeZone: 0 } }, { propertyQuota: null }, { propertyQuota: { unknown: {} } }, { propertyQuota: { tokensPerDay: { consumed: "1" } } }];
  malformed.push(Object.defineProperty({}, "rowCount", { get() { return 0; } }),
    { metadata: Object.defineProperty({}, "emptyReason", { enumerable: true, get() { return "SYNTHETIC_ONLY"; } }) },
    new Proxy({ rowCount: 0 }, { getOwnPropertyDescriptor() { throw Error("SYNTHETIC_ONLY"); } }));
  for (const payload of malformed) assert.throws(() => normalize(payload));
  const metricHeaders = [{ name: "sessions" }, { name: "engagedSessions" }];
  assert.equal(normalize({ metricHeaders, rows: [{ metricValues: [{ value: "17" }, { value: "5" }] }] }).totals.sessions, 17);
  const landing = contracts.normalizeGa4LandingPageReport!({ dimensionHeaders: [{ name: "landingPage" }], metricHeaders, rows: [
    { dimensionValues: [{ value: "/known/" }], metricValues: [{ value: "10" }, { value: "3" }] },
    { dimensionValues: [{ value: "(not set)" }], metricValues: [{ value: "7" }, { value: "2" }] },
  ] });
  assert.equal(landing.rows.reduce((sum, row) => sum + row.sessions, 0), 10, "landing rows cannot replace exact ungrouped totals");
  const provider = readFileSync(new URL("../../lib/admin/seo-intelligence/providers/ga4.ts", import.meta.url), "utf8");
  const functions: { fetchGa4OrganicTotals?: (input: unknown, fetcher: typeof fetch) => Promise<{ totals: { sessions: number } }> } = {};
  new Function("require", "exports", ts.transpileModule(provider, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText)((name: string) => name === "server-only" ? {} : name === "../contracts" ? { ...require("../../lib/admin/seo-intelligence/contracts.ts"), ...contracts } : require(name), functions);
  const input = { propertyId: "1", token: "SYNTHETIC_ONLY", startDate: "2026-10-01", endDate: "2026-10-17" };
  let calls = 0;
  for (const payload of empty) {
    const result = await functions.fetchGa4OrganicTotals!(input, (async () => { calls++; return Response.json(payload); }) as typeof fetch);
    assert.equal(result.totals.sessions, 0);
  }
  for (const payload of malformed.slice(0, 22)) await assert.rejects(functions.fetchGa4OrganicTotals!(input, (async () => { calls++; return Response.json(payload); }) as typeof fetch), (error: unknown) => error instanceof Error && error.message === "GA4_INVALID_RESPONSE");
  assert.equal(calls, empty.length + 22, "one existing request per invocation; no extra provider retry");
  assert.throws(() => contracts.normalizeGa4LandingPageReport!({}), "headerless landing reports remain rejected");
});

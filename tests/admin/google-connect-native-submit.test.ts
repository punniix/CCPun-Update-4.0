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
  const allowed = new Set(["entry", "gates-passed", "token-ready", "current-ready", "comparison-ready", "comparison-partial", "failed", "finished"]);
  const marker = "SYNTHETIC_PRIVATE_VALUE_MUST_NEVER_BE_LOGGED";
  async function run(mode: string, options: { environment?: string; provider?: string; role?: string; loggerThrows?: boolean } = {}) {
    const logs: unknown[][] = []; let tokenCalls = 0, providerCalls = 0;
    const environment = options.environment ?? "admin-uat";
    const variables = { CCPUN_DEPLOYMENT_PROVIDER: options.provider ?? "hostinger", CCPUN_DEPLOYMENT_ROLE: options.role ?? "admin",
      CCPUN_GA4_PROPERTY_ID: mode === "wrong-resource" ? "0" : environment === "production-admin" ? "219719845" : "551040812" };
    const response = { rows: [], totals: { sessions: 0, engagedSessions: 0, engagementRate: 0 }, truncated: false, timeZone: null, limitations: [] };
    const mocks: Record<string, unknown> = {
      "node:crypto": { randomUUID: () => marker }, "zod": require("zod"),
      "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
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
      "@/lib/admin/seo-intelligence/providers/ga4": Object.fromEntries(["fetchGa4LandingPages", "fetchGa4OrganicTotals"].map(name => [name, async (input: { startDate: string }) => {
        providerCalls++; if (mode === "current-failed" || (mode === "comparison-failed" && input.startDate === "2026-09-14")) throw Error("GA4_TIMEOUT"); return response;
      }])),
    };
    const exports: { POST?: (request: Request) => Promise<Response>; trace?: (value: string) => void } = {};
    const fakeConsole = { warn: (...args: unknown[]) => { logs.push(args); if (options.loggerThrows) throw Error(marker); } };
    new Function("require", "exports", "console", "process", compiled + "\nexports.trace = traceGa4SyncStage;")(
      (name: string) => { assert.ok(Object.hasOwn(mocks, name), "only explicit local mock imports"); return mocks[name]; }, exports, fakeConsole, { env: variables });
    const request = new Request("https://admin-test.ccpun.com/api/admin/seo/opportunities/sync/ga4/", { method: "POST", body: JSON.stringify(mode === "invalid-input" ? {} : { startDate: "2026-10-01", endDate: "2026-10-17" }) });
    let result: Response | undefined;
    if (mode === "auth-failed") await assert.rejects(exports.POST!(request), error => error instanceof Error && error.message === marker);
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
  const current = await run("current-failed"); assert.equal(current.status, 504); assert.equal(current.body.error, "provider-timeout"); assert.deepEqual(current.stages, ["entry", "gates-passed", "token-ready", "failed", "finished"]);
  const comparison = await run("comparison-failed"); assert.equal(comparison.status, 200); assert.equal(comparison.body.state, "partial"); assert.deepEqual(comparison.stages, ["entry", "gates-passed", "token-ready", "current-ready", "comparison-partial", "finished"]);
  assert.equal((await run("ok", { loggerThrows: true })).status, 200, "logger failures cannot alter business response");
  for (const options of [{ environment: "production-admin" }, { provider: "local" }, { role: "web" }]) assert.deepEqual((await run("ok", options)).stages, [], "only exact Hostinger Admin UAT logs markers");
});

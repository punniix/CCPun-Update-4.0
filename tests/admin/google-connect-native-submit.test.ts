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

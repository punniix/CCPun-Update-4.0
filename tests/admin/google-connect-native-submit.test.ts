import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
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
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
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

import { readPhase1Source } from "../../qa/read-phase1-source.mjs";
import { isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import path from "node:path";
import test from "node:test";
import { ADMIN_ROLES, hasAdminPermission } from "../../lib/admin/rbac";
import { ADMIN_OPERATIONS_LANES, resolveAdminOperationsRuntimeIdentity } from "../../lib/admin/operations/foundation";
import { buildAdminNavigation } from "../../features/admin/components/admin-navigation-model";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readCurrentSource(path.join(root, file), "utf8");
const checksum = "99519369562761cfb4cb95fe7d6e14f5d0a158ba31b116200d729eb865a451e0";

test("R2 Bangkok follow-up roundtrips across browser timezones and note fields have associated labels", async () => {
  const { transpileModule, ModuleKind } = createRequire(import.meta.url)("typescript") as typeof import("typescript");
  const source = readFileSync(new URL("../../features/admin/line/AdvisorCaseOperations.tsx", import.meta.url), "utf8");
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
  const states: unknown[] = []; let index = 0;
  const calls: Array<{ path: string; body: { followUpAt?: string; text?: string } }> = [];
  let finishRequest!: () => void;
  const loaded = { exports: {} as { bangkokFollowUpIso: (value: string) => string | null; formatBangkokFollowUp: (value: string) => string; AdvisorCaseOperations: (props: unknown) => unknown } };
  runInNewContext(compiled, { module: loaded, exports: loaded.exports, Date, Intl, JSON,
    FormData: class { get() { return "2026-10-14T09:45"; } },
    fetch: async (requestPath: string, options: { body: string }) => { calls.push({ path: requestPath, body: JSON.parse(options.body) }); return new Promise(resolve => { finishRequest = () => resolve({ ok: true, status: 200, json: async () => requestPath.endsWith("/notes/") ? { outcome: "created", noteId: "00000000-0000-4000-8000-000000000001" } : { outcome: "updated" } }); }); },
    require: (name: string) => {
      if (name === "../components/AdminDataRefresh") return { useAdminCaseDraft: (_lead: string, _kind: string, initial: () => unknown) => {
        const slot = index++; if (!(slot in states)) states[slot] = initial();
        return { data: states[slot], phase: "idle", available: true, restored: false, capacityMessage: null,
          update: (next: unknown) => { states[slot] = next; return 1; }, begin: () => 1,
          complete: (_revision: number, next: unknown) => { states[slot] = next; return 1; }, unknown: () => 1,
          settled: () => {}, authFailed: () => {}, refresh: () => {}, reviewed: () => 1 };
      } };
      if (name === "next/navigation") return { useRouter: () => ({ refresh: () => {} }) };
      if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
      assert.equal(name, "react");
      return {
        useEffect: (fn: () => unknown) => { fn(); },
        useId: () => `synthetic-field-${index++}`,
        useRef: (value: unknown) => { const slot = index++; if (!(slot in states)) states[slot] = { current: value }; return states[slot]; },
        useState: (value: unknown) => { const slot = index++; if (!(slot in states)) states[slot] = value; return [states[slot], (next: unknown) => { states[slot] = next; }]; },
      };
    } });
  const originalTimezone = process.env.TZ;
  try {
    for (const timezone of ["Asia/Bangkok", "UTC", "America/Los_Angeles", "Pacific/Auckland"]) {
      process.env.TZ = timezone;
      assert.equal(loaded.exports.bangkokFollowUpIso("2026-10-14T09:45"), "2026-10-14T02:45:00.000Z");
      assert.equal(loaded.exports.bangkokFollowUpIso("2028-02-29T00:00"), "2028-02-28T17:00:00.000Z");
      assert.match(loaded.exports.formatBangkokFollowUp("2026-10-14T02:45:00.000Z"), /09:45/);
      for (const invalid of ["", "2026-02-29T09:45", "2026-04-31T09:45", "2026-10-14T24:00", "2026-10-14T09:60", "2026-10-14T09:45Z"]) assert.equal(loaded.exports.bangkokFollowUpIso(invalid), null);
    }
  } finally { if (originalTimezone === undefined) delete process.env.TZ; else process.env.TZ = originalTimezone; }
  type Node = { type?: string; props?: Record<string, unknown> & { children?: unknown } };
  function nodes(value: unknown): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object") return [];
    const node = value as Node;
    return [node, ...nodes(node.props?.children)];
  }
  const render = () => { index = 0; return loaded.exports.AdvisorCaseOperations({ leadId: "synthetic", notesEnabled: true }); };
  let tree = nodes(render());
  const textarea = tree.find(node => node.type === "textarea")!;
  assert.ok(tree.some(node => node.type === "label" && node.props?.htmlFor === textarea.props?.id));
  const form = tree.find(node => node.type === "form")!;
  const submit = form.props!.onSubmit as (event: unknown) => void;
  submit({ preventDefault() {}, currentTarget: {} });
  submit({ preventDefault() {}, currentTarget: {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.followUpAt, "2026-10-14T02:45:00.000Z");
  finishRequest(); await new Promise<void>(resolve => setImmediate(resolve));
  tree = nodes(render());
  assert.match(JSON.stringify(tree), /09:45/);
  assert.match(JSON.stringify(tree), /Asia\/Bangkok/);
  (tree.find(node => node.type === "textarea")!.props!.onChange as (event: unknown) => void)({ target: { value: "synthetic-note" } });
  tree = nodes(render());
  const saveNote = tree.find(node => node.type === "button" && node.props?.type === "button")!.props!.onClick as () => void;
  saveNote(); saveNote();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.text, "synthetic-note");
  finishRequest(); await new Promise<void>(resolve => setImmediate(resolve));
});

test("protected draft scope restores native Back/Forward drafts, bounds memory and correlates late acknowledgements", async () => {
  assert.ok(process.env.NODE_PATH, "Use the declared installed dependency runtime for mounted React QA");
  const dependency = createRequire(path.join(process.env.NODE_PATH!, "package.json"));
  const { JSDOM } = dependency("jsdom") as typeof import("jsdom");
  const ts = dependency("typescript") as typeof import("typescript");
  const dom = new JSDOM('<div id="root"></div>', { url: "https://admin-test.ccpun.com/case/a" });
  const globals = ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "Element", "HTMLAnchorElement", "HTMLFormElement", "FormData", "File", "IS_REACT_ACT_ENVIRONMENT"];
  const previous = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of globals) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === "IS_REACT_ACT_ENVIRONMENT" ? true : (dom.window as unknown as Record<string, unknown>)[key] });
  const React = dependency("react") as typeof import("react");
  const { createRoot } = dependency("react-dom/client") as typeof import("react-dom/client");
  let confirmed = false, confirmations = 0, refreshes = 0, privateBodyReads = 0;
  dom.window.confirm = () => { confirmations++; return confirmed; };
  const router = { refresh: () => { refreshes++; } };
  type Reply = { ok: boolean; status: number; json: () => Promise<unknown> };
  const noteAck = { outcome: "created", noteId: "00000000-0000-4000-8000-000000000001" };
  const followAck = { outcome: "updated" };
  const ok = (data: unknown = {}) => ({ ok: true, status: 200, json: async () => data });
  let response: () => Promise<Reply> = async () => ok();
  const calls: Array<{ path: string; body: unknown }> = [];
  const modules: Record<string, unknown> = {};
  function compile(file: string): Record<string, unknown> {
    const source = readFileSync(new URL("../../" + file, import.meta.url), "utf8");
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: 4 } }).outputText;
    const loaded = { exports: {} as Record<string, unknown> };
    runInNewContext(output, { exports: loaded.exports, module: loaded, Date, Intl, URL, TextEncoder,
      window: dom.window, document: dom.window.document, Element: dom.window.Element, HTMLAnchorElement: dom.window.HTMLAnchorElement, HTMLFormElement: dom.window.HTMLFormElement, FormData: dom.window.FormData,
      fetch: async (requestPath: string, options: { body: unknown }) => { calls.push({ path: requestPath, body: options.body }); return response(); },
      require: (name: string) => {
        if (name === "react") return React;
        if (name === "react/jsx-runtime") return dependency(name);
        if (name === "next/navigation") return { useRouter: () => router };
        assert.ok(name in modules, `Unexpected ${name}`); return modules[name];
      } });
    return loaded.exports;
  }
  const guard = compile("features/admin/components/AdminDataRefresh.tsx") as unknown as typeof import("../../features/admin/components/AdminDataRefresh");
  modules["../components/AdminDataRefresh"] = guard;
  const advisor = compile("features/admin/line/AdvisorCaseOperations.tsx") as unknown as typeof import("../../features/admin/line/AdvisorCaseOperations");
  modules["./AdvisorCaseOperations"] = advisor;
  const ocr = compile("features/admin/line/ChatScreenshotImport.tsx") as unknown as typeof import("../../features/admin/line/ChatScreenshotImport");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const ownerScope = JSON.stringify(["owner@example.invalid", "uat", "owner", "full"]);
  let scope: string | null = ownerScope, notesEnabled = true, reuse = false;
  function Page() {
    const [lead, setLead] = React.useState(() => dom.window.location.pathname.split("/").at(-1)!);
    React.useEffect(() => { const route = () => setLead(dom.window.location.pathname.split("/").at(-1)!); dom.window.addEventListener("popstate", route); return () => dom.window.removeEventListener("popstate", route); }, []);
    return React.createElement(React.Fragment, null,
      React.createElement("a", { id: "leave", href: "/case/elsewhere" }, "Leave"),
      React.createElement("a", { id: "newtab", href: "/case/elsewhere", target: "_blank" }, "New"),
      React.createElement("form", { id: "logout", "data-admin-logout": true }, React.createElement("button", { type: "submit" }, "Logout")),
      lead === "elsewhere" ? null : React.createElement(React.Fragment, { key: reuse ? "same-form" : lead },
        React.createElement(advisor.AdvisorCaseOperations, { leadId: lead, notesEnabled }),
        React.createElement(ocr.ChatScreenshotImport, { leadId: lead })));
  }
  const mount = () => React.act(async () => root.render(React.createElement(guard.AdminDraftScope, { scope }, React.createElement(guard.default), React.createElement(Page))));
  const change = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => React.act(async () => {
    const prototype = element.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    element.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  const note = () => dom.window.document.querySelector<HTMLTextAreaElement>("textarea[placeholder]")!;
  const follow = () => dom.window.document.querySelector<HTMLInputElement>('input[name="follow"]')!;
  const text = () => dom.window.document.querySelector<HTMLTextAreaElement>("textarea:not([placeholder])")!;
  const button = (label: string) => [...dom.window.document.querySelectorAll("button")].find(node => node.textContent!.includes(label))!;
  const click = async (label: string) => React.act(async () => button(label).click());
  const pick = async (file: File) => React.act(async () => {
    const element = dom.window.document.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(element, "files", { configurable: true, value: [file] });
    element.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  const go = async (lead: string) => React.act(async () => {
    dom.window.history.pushState({}, "", "/case/" + lead);
    dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
  });
  const back = () => React.act(async () => { dom.window.history.back(); await new Promise(resolve => setTimeout(resolve, 30)); });
  const forward = () => React.act(async () => { dom.window.history.forward(); await new Promise(resolve => setTimeout(resolve, 30)); });
  const proposal = { status: "proposal", requestId: "synthetic-request", messages: [{ text: "synthetic-reviewed-text", direction: "inbound", confidence: 0.9 }] };
  try {
    await mount();
    await React.act(async () => dom.window.dispatchEvent(new dom.window.Event("focus"))); assert.equal(refreshes, 1);
    await change(note(), "synthetic-private-note"); await change(follow(), "2026-10-15T10:30");
    scope = JSON.stringify(JSON.parse(ownerScope)); await mount();
    assert.equal(note().value, "synthetic-private-note", "equivalent newly serialized auth tuple preserves the draft");
    await go("b"); assert.equal(note().value, ""); await back();
    assert.equal(note().value, "synthetic-private-note"); assert.equal(follow().value, "2026-10-15T10:30");
    assert.match(dom.window.document.body.textContent!, /นำฉบับในแท็บนี้กลับมา/); assert.equal(calls.length, 0);
    await forward(); assert.equal(note().value, ""); await back();
    await go("elsewhere");
    const unload = new dom.window.Event("beforeunload", { cancelable: true }); dom.window.dispatchEvent(unload);
    assert.equal(unload.defaultPrevented, true, "cached drafts warn even when their forms are unmounted");
    await React.act(async () => dom.window.dispatchEvent(new dom.window.Event("focus"))); assert.equal(refreshes, 1);
    await back();
    const file = new dom.window.File(["synthetic-image"], "synthetic-a.png", { type: "image/png" });
    await pick(file); response = async () => ok(proposal); await click("อ่านภาพด้วย Local OCR");
    await change(text(), "synthetic-edited-text");
    await React.act(async () => dom.window.document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    await go("b"); await back();
    assert.equal(text().value, "synthetic-edited-text"); assert.equal(button("ยืนยันและบันทึก").disabled, true);
    const before = calls.length; await click("อ่านภาพด้วย Local OCR"); assert.equal(calls.length, before, "Cancel re-OCR keeps the edited proposal");
    await pick(new dom.window.File(["other"], "synthetic-b.png"));
    assert.match(dom.window.document.body.textContent!, /synthetic-a.png/); assert.equal(text().value, "synthetic-edited-text");
    await React.act(async () => dom.window.document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    for (const malformed of [{ imported: 0, duplicate: 0, total: 1 }, { imported: 1, duplicate: 0, total: 0 }, { imported: 1, duplicate: 0, total: 1, requestId: "wrong-job" }]) {
      response = async () => ok(malformed); await click("ยืนยันและบันทึก");
      assert.equal(text().value, "synthetic-edited-text"); assert.equal(button("ยืนยันและบันทึก").disabled, true);
      await go("b"); await back();
      assert.equal(button("ยืนยันและบันทึก").disabled, true, "unknown result never restores as ready to retry");
      assert.doesNotMatch(dom.window.document.body.textContent!, /ข้อมูลเดิมยังไม่ถูกแก้ไข/);
      await click("ตรวจประวัติแล้ว · เปิดการดำเนินการอีกครั้ง");
    }
    response = async () => ok({ imported: 1, duplicate: 0, total: 1 }); await click("ยืนยันและบันทึก");
    assert.equal(dom.window.document.querySelector("textarea:not([placeholder])"), null);
    assert.equal(note().value, "synthetic-private-note"); assert.equal(refreshes, 1);

    let finish!: (reply: Reply) => void;
    response = () => new Promise(resolve => { finish = resolve; });
    await click("บันทึกโน้ต"); const pendingCount = calls.length; await click("บันทึกโน้ต"); assert.equal(calls.length, pendingCount);
    await go("b"); await back(); assert.equal(button("บันทึกโน้ต").disabled, true);
    await change(note(), "newer-private-note");
    await React.act(async () => finish(ok(noteAck)));
    assert.equal(note().value, "newer-private-note", "old valid ACK cannot clear a newer revision");
    assert.equal(button("บันทึกโน้ต").disabled, true);
    await click("ตรวจประวัติแล้ว · เปิดการบันทึกอีกครั้ง");
    response = () => new Promise(resolve => { finish = resolve; });
    await click("บันทึกโน้ต"); await go("b"); await back();
    await React.act(async () => finish(ok(noteAck)));
    assert.equal(note().value, "", "matching late ACK resolves only its submitted draft");
    assert.equal(follow().value, "2026-10-15T10:30");

    await change(note(), "not-visible-when-disabled"); notesEnabled = false; await mount();
    assert.equal(note().value, ""); notesEnabled = true; await mount(); assert.equal(note().value, "", "current form permission gates restore");
    await change(note(), "revoked-private-note");
    for (const nextScope of [JSON.stringify(["other@example.invalid", "uat", "owner", "full"]), JSON.stringify(["other@example.invalid", "uat", "owner", "editorial"]), JSON.stringify(["other@example.invalid", "local-uat", "owner", "editorial"])]) {
      scope = nextScope; await mount(); assert.equal(note().value, ""); await change(note(), "scope-local-note");
    }
    scope = null; await mount(); await change(note(), "demo-no-cache"); await go("b"); await back(); assert.equal(note().value, "", "missing verified owner scope never restores");
    scope = ownerScope; await mount();
    for (const lead of ["a", "b", "c", "d"]) { await go(lead); await change(note(), "case-" + lead); }
    await go("e"); await change(note(), "fifth-case"); assert.equal(note().value, ""); assert.match(dom.window.document.body.textContent!, /ความจำ|ยังเก็บการแก้ไขใหม่ไม่ได้/);
    await go("a"); assert.equal(note().value, "case-a", "capacity Cancel preserves existing entries");
    await pick(file); await go("b"); await pick(new dom.window.File(["second"], "second.png")); assert.doesNotMatch(dom.window.document.body.textContent!, /ภาพที่เลือก: second.png/);
    await go("a"); assert.match(dom.window.document.body.textContent!, /ภาพที่เลือก: synthetic-a.png/);
    confirmed = true; await go("b"); await pick(new dom.window.File(["second"], "second.png")); await go("a");
    assert.doesNotMatch(dom.window.document.body.textContent!, /ภาพที่เลือก: synthetic-a.png/); assert.equal(note().value, "case-a");
    await go("b"); await pick(new dom.window.File([new Uint8Array(8 * 1024 * 1024 + 1)], "too-large.png")); assert.match(dom.window.document.body.textContent!, /ภาพที่เลือก: second.png/);
    response = async () => ok(proposal); await click("อ่านภาพด้วย Local OCR");
    await change(text(), "x".repeat(1024 * 1024 + 1));
    assert.equal(text().value, "synthetic-reviewed-text", "text capacity rejects the new edit without replacing the draft");
    assert.match(dom.window.document.body.textContent!, /ข้อความเกิน 1 MiB/);
    await go("a"); assert.equal(note().value, "case-a", "a rejected oversized edit cannot commit its proposed discards");
    await go("e"); await change(note(), "explicit-fifth"); await go("a"); assert.equal(note().value, "", "only explicit capacity confirmation discards other cases");

    response = () => new Promise(resolve => { finish = resolve; });
    await change(note(), "logout-private-note"); await click("บันทึกโน้ต"); await go("b");
    confirmed = false;
    const logout = () => dom.window.document.getElementById("logout")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    let blocked = false; await React.act(async () => { blocked = !logout(); }); assert.equal(blocked, true);
    let navigations = 0;
    dom.window.document.addEventListener("click", event => { if (event.target instanceof dom.window.Element && event.target.closest("a")) { navigations++; event.preventDefault(); } });
    dom.window.document.getElementById("leave")!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(navigations, 0, "Cancel prevents the delegated page navigation");
    const count = confirmations;
    for (const options of [{ ctrlKey: true }, { metaKey: true }, { button: 1 }]) dom.window.document.getElementById("leave")!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, ...options }));
    dom.window.document.getElementById("newtab")!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(confirmations, count);
    confirmed = true; await React.act(async () => { logout(); }); await React.act(async () => finish(ok(noteAck)));
    await go("a"); assert.equal(note().value, ""); assert.equal(button("บันทึกโน้ต").disabled, true, "logout revokes old responses");
    scope = JSON.stringify(["fresh@example.invalid", "uat", "owner", "full"]); await mount(); await change(note(), "expire-private-note");
    response = async () => ({ ok: false, status: 401, json: async () => { privateBodyReads++; return { private: "must-not-read" }; } });
    await click("บันทึกโน้ต"); assert.equal(note().value, ""); assert.equal(privateBodyReads, 0); assert.equal(button("บันทึกโน้ต").disabled, true);
    scope = JSON.stringify(["unmount@example.invalid", "uat", "owner", "full"]); await mount();
    await pick(file); await click("อ่านภาพด้วย Local OCR");
    assert.equal(privateBodyReads, 0, "OCR 401 clears drafts without consuming the private response body");
    assert.equal(button("อ่านภาพด้วย Local OCR").disabled, true);
    scope = JSON.stringify(["unmount-fresh@example.invalid", "uat", "owner", "full"]); await mount();
    await change(note(), "unmounted-private-note");
    response = () => new Promise(resolve => { finish = resolve; }); await click("บันทึกโน้ต");
    await React.act(async () => root.render(null)); await mount();
    await React.act(async () => finish(ok(noteAck))); assert.equal(note().value, "", "destroyed protected scope cannot be repopulated by its old response");
    scope = JSON.stringify(["ack@example.invalid", "uat", "owner", "full"]); await mount(); await go("a");
    await change(note(), "unconfirmed-note"); await change(follow(), "2026-10-15T12:30");
    for (const malformed of [{}, { outcome: "created", noteId: "not-a-uuid" }, { outcome: "error" }]) {
      response = async () => ok(malformed); await click("บันทึกโน้ต");
      assert.equal(note().value, "unconfirmed-note"); assert.doesNotMatch(dom.window.document.body.textContent!, /บันทึกแล้ว/);
      await click("ตรวจประวัติแล้ว · เปิดการบันทึกอีกครั้ง");
    }
    response = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("synthetic login HTML"); } });
    await click("บันทึกโน้ต"); assert.equal(note().value, "unconfirmed-note"); await click("ตรวจประวัติแล้ว · เปิดการบันทึกอีกครั้ง");
    for (const malformed of [{}, { outcome: "created" }, { outcome: "error" }]) {
      assert.equal(button("ตั้งวันติดตาม").disabled, false);
      const beforeFollow = calls.length;
      response = async () => ok(malformed); await React.act(async () => { follow().form!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });
      assert.equal(calls.length, beforeFollow + 1);
      assert.equal(follow().value, "2026-10-15T12:30"); assert.doesNotMatch(dom.window.document.body.textContent!, /บันทึกแล้ว/);
      const section = follow().closest("section")!;
      await React.act(async () => [...section.querySelectorAll("button")].find(node => node.textContent!.includes("ตรวจประวัติแล้ว"))!.click());
    }
    response = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("synthetic empty body"); } });
    await click("ตั้งวันติดตาม"); assert.equal(follow().value, "2026-10-15T12:30");
    await React.act(async () => [...follow().closest("section")!.querySelectorAll("button")].find(node => node.textContent!.includes("ตรวจประวัติแล้ว"))!.click());
    response = async () => ok(followAck); await click("ตั้งวันติดตาม"); assert.equal(follow().value, "2026-10-15T12:30");

    scope = JSON.stringify(["capacity-pending@example.invalid", "uat", "owner", "full"]); await mount(); await go("a");
    await change(note(), "pending-capacity-note"); response = () => new Promise(resolve => { finish = resolve; }); await click("บันทึกโน้ต");
    const inFlightCount = calls.length;
    await go("b"); await back(); await click("ตรวจประวัติแล้ว · เปิดการบันทึกอีกครั้ง"); await click("บันทึกโน้ต");
    assert.equal(calls.length, inFlightCount, "manual history cannot release a genuine in-flight request");
    for (const lead of ["b", "c", "d"]) { await go(lead); await change(note(), "case-" + lead); }
    await go("e"); await change(note(), "cannot-evict-pending"); assert.equal(note().value, "");
    await go("a"); assert.equal(note().value, "pending-capacity-note");
    await React.act(async () => finish(ok({})));
    await go("e"); await change(note(), "cannot-evict-unknown"); assert.equal(note().value, "");
    await go("a"); assert.equal(note().value, "pending-capacity-note");

    scope = JSON.stringify(["image-pending@example.invalid", "uat", "owner", "full"]); await mount();
    await pick(file); response = async () => ok(proposal); await click("อ่านภาพด้วย Local OCR");
    response = () => new Promise(resolve => { finish = resolve; }); await click("ยืนยันและบันทึก");
    await go("b"); await pick(new dom.window.File(["other"], "blocked.png")); assert.doesNotMatch(dom.window.document.body.textContent!, /ภาพที่เลือก: blocked.png/);
    await back(); await click("ตรวจประวัติแล้ว · เปิดการดำเนินการอีกครั้ง");
    assert.equal(button("ยืนยันและบันทึก").disabled, true);
    await React.act(async () => finish(ok({})));
    await go("b"); await pick(new dom.window.File(["other"], "blocked.png")); assert.doesNotMatch(dom.window.document.body.textContent!, /ภาพที่เลือก: blocked.png/);
    await go("a"); assert.match(dom.window.document.body.textContent!, /ภาพที่เลือก: synthetic-a.png/);

    scope = JSON.stringify(["reuse@example.invalid", "uat", "owner", "full"]); reuse = true; await mount(); await go("a");
    await change(note(), "same-instance-a"); response = () => new Promise(resolve => { finish = resolve; }); await click("บันทึกโน้ต");
    await go("b"); assert.equal(note().value, ""); assert.equal(follow().disabled, false, "A in-flight local state must not disable B");
    await change(note(), "same-instance-b"); await React.act(async () => finish(ok(noteAck)));
    assert.equal(note().value, "same-instance-b"); assert.doesNotMatch(dom.window.document.body.textContent!, /บันทึกแล้ว/, "A acknowledgement cannot announce B saved");
    await go("a"); await pick(file); response = () => new Promise(resolve => { finish = resolve; }); await click("อ่านภาพด้วย Local OCR");
    await go("b"); assert.equal(dom.window.document.querySelector<HTMLInputElement>('input[type="file"]')!.disabled, false);
    assert.doesNotMatch(dom.window.document.body.textContent!, /ภาพที่เลือก: synthetic-a.png/);
    await React.act(async () => finish(ok(proposal)));
    assert.equal(note().value, "same-instance-b"); assert.equal(dom.window.document.querySelector("textarea:not([placeholder])"), null);
    assert.doesNotMatch(dom.window.document.body.textContent!, /อ่านได้ 1 ข้อความ/, "A OCR response cannot announce or hydrate B");
    await go("a"); assert.equal(text().value, "synthetic-reviewed-text", "only A's exact cached revision receives the matching proposal");
    assert.equal(dom.window.localStorage.length, 0); assert.equal(dom.window.sessionStorage.length, 0);
    assert.match(readFileSync(new URL("../../apps/admin/app/(control-plane)/layout.tsx", import.meta.url), "utf8"), /draftAuthScope=\{role === "owner" && session\?\.user\?\.email/);
    assert.doesNotMatch(readFileSync(new URL("../../features/admin/components/AdminDataRefresh.tsx", import.meta.url), "utf8"), /localStorage|sessionStorage|popstate|pushState|replaceState/);
  } finally {
    await React.act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test("R2 generic error preserves unknown effect outcome", () => {
  const source = readFileSync(new URL("../../apps/admin/app/(control-plane)/error.tsx", import.meta.url), "utf8");
  assert.match(source, /ยังยืนยันผลล่าสุดไม่ได้/);
  assert.match(source, /ประวัติงานเดิมก่อนดำเนินการซ้ำ/);
  assert.doesNotMatch(source, /ไม่ได้ถูกเผยแพร่|ลองใหม่ได้อย่างปลอดภัย/);
});

function checksumSource(sql: string) {
  return sql.split("-- checksum-source-begin\n", 2)[1]?.split("-- checksum-source-end", 1)[0] ?? "";
}

function normalizedMigration(sql: string) {
  return sql
    .replaceAll("20260917_private_line_runtime_v1_uat", "20260917_private_line_runtime_v1_BASE")
    .replaceAll("20260917_private_line_runtime_v1_production", "20260917_private_line_runtime_v1_BASE")
    .replaceAll("20260918_line_advisor_inbox_v1_uat", "20260918_line_advisor_inbox_v1_LANE")
    .replaceAll("20260918_line_advisor_inbox_v1_production", "20260918_line_advisor_inbox_v1_LANE")
    .replaceAll("young-term-47483330", "PROJECT_ID")
    .replaceAll("lively-bar-43618798", "PROJECT_ID")
    .replaceAll("br-crimson-mouse-az7ajkv8", "BRANCH_ID")
    .replaceAll("br-long-resonance-b3ys5xrv", "BRANCH_ID")
    .replaceAll("ep-mute-frost-aztvz394", "ENDPOINT_ID")
    .replaceAll("ep-broad-butterfly-b3ro7u8w", "ENDPOINT_ID")
    .replaceAll("sha256:19a7dfaf26d2cc4f6cbf01d7ff2380056383f8e87dd079a6e141e73b878985d3", "sha256:BASE_CHECKSUM")
    .replaceAll("sha256:f562ba174f50cf617d0e12ffd13c46e5815b069dc823ecb7c8522d7b05d6c57b", "sha256:BASE_CHECKSUM")
    .replaceAll("Base private_line UAT", "Base private_line LANE")
    .replaceAll("Base private_line Production", "Base private_line LANE");
}

test("Advisor Inbox migrations keep UAT and Production behavior in parity", () => {
  const uat = read("db/migrations/20260918_line_advisor_inbox_v1_uat.sql");
  const production = read("db/migrations/20260918_line_advisor_inbox_v1_production.sql");
  assert.equal(normalizedMigration(uat), normalizedMigration(production));
  assert.equal(checksumSource(uat), checksumSource(production));
  assert.equal(createHash("sha256").update(checksumSource(uat)).digest("hex"), checksum);
  assert.match(uat, new RegExp(`sha256:${checksum}`));
  assert.match(production, new RegExp(`sha256:${checksum}`));
});

test("safe view exposes operational context only and preserves least privilege", () => {
  const migration = read("db/migrations/20260918_line_advisor_inbox_v1_production.sql");
  const source = checksumSource(migration);
  for (const column of [
    "lead_id", "advisor_case_id", "customer_code", "stage", "journey", "material_received",
    "conversation_status", "unread_count", "last_activity_at", "priority", "assigned_advisor",
    "latest_message_type", "latest_message_status", "latest_message_needs_human", "updated_at",
  ]) assert.match(source, new RegExp(`\\b${column}\\b`), column);

  for (const forbidden of [
    "external_ref_digest", "external_ref_ciphertext_b64", "provider_message_digest",
    "provider_message_ciphertext_b64", "content_ciphertext_b64", "content_nonce_b64",
    "content_auth_tag_b64", "external_file_id", "external_folder_id",
  ]) assert.doesNotMatch(source, new RegExp(`\\b${forbidden}\\b`), forbidden);

  assert.match(source, /REVOKE ALL ON TABLE private_line\.advisor_inbox_safe FROM ccpun_line_ingress/);
  assert.match(source, /GRANT SELECT ON TABLE private_line\.advisor_inbox_safe TO ccpun_admin_runtime/);
  assert.match(source, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*private_line\.message_tombstone[\s\S]*FROM ccpun_admin_runtime/);
  assert.doesNotMatch(source, /GRANT SELECT ON TABLE\s+private_line\.(?:customer|provider_identity|conversation|message|document|lead|advisor_case)/);
});

test("readbacks prove safe-view access without changing the ingress boundary", () => {
  for (const file of [
    "db/migrations/20260918_line_advisor_inbox_v1_uat_readback.sql",
    "db/migrations/20260918_line_advisor_inbox_v1_production_readback.sql",
  ]) {
    const sql = read(file);
    assert.match(sql, /base_identity_unchanged/);
    assert.match(sql, /admin_base_tables_direct_denied/);
    assert.match(sql, /admin_safe_view_select_ok/);
    assert.match(sql, /ingress_safe_view_select_denied/);
    assert.match(sql, /ingress_execute_unchanged/);
    assert.match(sql, /ingress_base_tables_direct_denied/);
  }
});

test("Advisor Inbox runtime reuses the exact Admin Neon lane guard", () => {
  const controlPlane = read("lib/admin/line/control-plane.ts");
  assert.match(controlPlane, /adminOperationsRuntimeInputFromEnvironment/);
  assert.match(controlPlane, /resolveAdminOperationsRuntimeIdentity/);
  assert.match(controlPlane, /FROM private_line\.admin_read_advisor_inbox/);
  assert.doesNotMatch(controlPlane, /FROM private_line\.(?:customer|provider_identity|conversation|message|document|lead|advisor_case|lead_context)\b/);
  assert.doesNotMatch(controlPlane, /createLinePrivateCrypto|CCPUN_LINE_IDENTITY_HMAC_KEY/);
  assert.match(controlPlane, /createLineContentCrypto/);
  assert.match(controlPlane, /CCPUN_LINE_TRANSCRIPT_ENABLED/);
  assert.match(controlPlane, /outboundEnabled:\s*false/);

  for (const [lane, environment] of [
    ["uat", "admin-uat"],
    ["production", "production-admin"],
  ] as const) {
    const identity = ADMIN_OPERATIONS_LANES[lane];
    const input = {
      environment,
      projectId: identity.projectId,
      branchId: identity.branchId,
      database: identity.database,
      connectionString: `postgresql://${identity.runtimeRole}:test-only@${identity.endpointId}.${identity.hostSuffix}/${identity.database}?sslmode=require`,
      deploymentProvider: "hostinger",
      deploymentRole: "admin",
      gitBranch: lane === "production" ? "v4-production" : "admin/line-advisor-inbox-20260918",
    };
    assert.equal(resolveAdminOperationsRuntimeIdentity(input)?.lane, lane);
    assert.equal(resolveAdminOperationsRuntimeIdentity({ ...input, deploymentProvider: "vercel", vercelProjectId: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN" }), null);
    assert.equal(resolveAdminOperationsRuntimeIdentity({ ...input, branchId: "wrong-branch" }), null);
    assert.equal(resolveAdminOperationsRuntimeIdentity({ ...input, database: "wrong-db" }), null);
    assert.equal(resolveAdminOperationsRuntimeIdentity({ ...input, connectionString: input.connectionString.replace(identity.runtimeRole, "neondb_owner") }), null);
  }
});

test("advisor:read is owner-only in Phase 3A", () => {
  assert.equal(hasAdminPermission("owner", "advisor:read"), true);
  for (const role of ADMIN_ROLES.filter((role) => role !== "owner")) {
    assert.equal(hasAdminPermission(role, "advisor:read"), false, role);
  }
});

test("deployed Admin separates Advisor Inbox from SEO Reviews with canonical routes only", () => {
  const inbox = read("apps/admin/app/(control-plane)/dashboard/inbox/page.tsx");
  const reviews = read("apps/admin/app/(control-plane)/dashboard/reviews/page.tsx");
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");
  const routes = read("lib/admin/routes.ts");
  const dashboard = read("apps/admin/app/(control-plane)/dashboard/page.tsx");
  const articles = read("apps/admin/app/(control-plane)/content/articles/page.tsx");
  const seo = read("apps/admin/app/(control-plane)/seo/page.tsx");

  assert.match(inbox, /requireAdminPermission\("advisor:read"\)/);
  assert.match(inbox, /ลูกค้า LINE/);
  assert.match(inbox, /ตอบใน LINE OA ตามเดิม/);
  assert.doesNotMatch(inbox, /Private-by-default|conversation archive owner-only|name=["'](?:priority|caseState|journey|tag)["']|>\s*(?:caseState|Case state|priority)\s*</i);
  assert.doesNotMatch(inbox, />[^<{}\n]*(?:caseState|Case state|priority)[^<{}\n]*<|\{\s*(?:item|row|lead)\.(?:caseState|priority)\s*\}/i);
  assert.match(inbox, /\/dashboard\/inbox\/\$\{item\.leadId\}\//);
  assert.doesNotMatch(inbox, /ApproveSuggestionButton|ApplySuggestionButton|ReviewDecisionControls/);
  assert.match(reviews, /requireAdminPermission\("reviews:read"\)/);
  assert.match(reviews, /ReviewDecisionControls/);
  assert.match(layout, /buildAdminNavigation\(/);
  const navigation = buildAdminNavigation({ profile: "full", hasPermission: permission => hasAdminPermission("owner", permission), isPathAllowed: () => true });
  const leaves = navigation.flatMap(item => item.children);
  assert.equal(leaves.find(item => item.href === "/dashboard/inbox/")?.label, "ลูกค้า LINE");
  assert.equal(leaves.find(item => item.href === "/dashboard/reviews/")?.label, "งานรอตรวจ");
  for (const [href, permission] of [["/dashboard/inbox/", "advisor:read"], ["/dashboard/reviews/", "reviews:read"]]) {
    const restricted = buildAdminNavigation({ profile: "full", hasPermission: candidate => candidate !== permission, isPathAllowed: () => true });
    assert.equal(restricted.flatMap(item => item.children).some(item => item.href === href), false);
  }
  assert.doesNotMatch(routes, /\/snt-admin\/reviews/);
  assert.match(routes, /ADMIN_PAGE_PREFIXES = CONTROL_PLANE_PAGE_PREFIXES/);
  for (const source of [dashboard, articles, seo]) {
    assert.doesNotMatch(source, /href="\/dashboard\/inbox\/"[\s\S]{0,120}(?:ข้อเสนอ|Review inbox)/);
  }
});

test("Advisor Inbox API is authenticated, owner-gated, no-store, and safe-only", () => {
  const route = read("apps/admin/app/api/admin/line/inbox/route.ts");
  assert.match(route, /getAdminIdentity\(\)/);
  assert.match(route, /status: 401/);
  assert.match(route, /"advisor:read"/);
  assert.match(route, /status: 403/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /no-store/);
  assert.match(route, /listAdvisorInboxSafe\(\)/);
  assert.doesNotMatch(route, /request\.json|request\.text|LINE_CHANNEL|ciphertext|external_ref|provider_message/);
});

function readCurrentSource(file: string | URL, encoding: "utf8"): string {
  void encoding;
  return readPhase1Source(file instanceof URL ? relative(process.cwd(), fileURLToPath(file)) : isAbsolute(file) ? relative(process.cwd(), file) : file);
}

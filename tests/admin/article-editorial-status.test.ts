import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { act, createElement, type ReactNode } from "react";
import type { ObjectInputProps } from "sanity";
import { createPublishedId, getVersionId } from "@sanity/id-utils";
import ts from "typescript";
import { publicationSummary, reviewLabels } from "../../cms/sanity/policy/article-publication";
import { LINE_TITLE_DEFAULT_INSTRUCTIONS, LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS } from "../../lib/local-ai/editorial-instructions";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");

test("editorial controls preview the selected draft, focus review and show UAT notice only in UAT", async () => {
  const dom = new JSDOM("<div id='root'></div>");
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  // Initialize DOM before React DOM so native textarea input events are enabled.
  const { createRoot } = await import("react-dom/client");
  const { presentationTool } = await import("sanity/presentation");
  const { LineEditorialFields } = await import("../../cms/sanity/policy/article-line-copy-action");
  const { ThemeProvider } = await import("@sanity/ui");
  const { buildTheme } = await import("@sanity/ui/theme");
  const theme = buildTheme();
  const root = createRoot(dom.window.document.getElementById("root"));
  const article = { _id: "drafts.selected", _rev: "draft-rev", slug: { current: "aia-vitality" }, category: { _ref: "life" }, review: { status: "drafting" }, lineTitle: "", lineDescription: "" };
  let draft: typeof article | null = article;
  const published = { ...article, _id: "selected", _rev: "published-rev" };
  const requests: { id: string; revision: string; instructions: unknown }[] = [];
  let syncing = false;
  let changed = 0;
  let workspace = { projectId: "kyfxgjnq", dataset: "production" };
  let category: { slug?: { current: string } } = { slug: { current: "life-insurance" } };
  let focused: unknown;
  let params: Record<string, string> = {};
  const exports: Partial<typeof import("../../cms/sanity/policy/article-editorial-status")> = {};
  const source = readFileSync(new URL("../../cms/sanity/policy/article-editorial-status.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "exports", compiled)((id: string) => {
    if (id === "sanity") return {
      useWorkspace: () => workspace,
      useEditState: (_id: string, type: string) => type === "category" ? { draft: null, published: category, ready: true } : { draft, published, ready: true },
      useSyncState: () => ({ isSyncing: syncing }),
    };
    if (id === "./article-line-copy-action") return { LineEditorialFields, requestArticleLineCopy: async (id: string, revision: string, instructions: unknown) => { requests.push({ id, revision, instructions }); await Promise.resolve(); return { status: "applied", lineTitle: "Generated", lineDescription: "Generated description" }; } };
    // Only the themed modal shell is substituted; real React hooks and the
    // exported field controls execute their actual DOM event handlers.
    if (id === "@sanity/ui") return {
      Button: require("@sanity/ui").Button,
      Card: ({ children }: { children: ReactNode }) => createElement("div", null, children),
      Dialog: ({ children, header }: { children: ReactNode; header: ReactNode }) => createElement("section", { role: "dialog" }, createElement("h2", null, header), children),
    };
    if (id === "../../../lib/local-ai/editorial-instructions") return { LINE_TITLE_DEFAULT_INSTRUCTIONS, LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS };
    if (id === "./article-publication") return { publicationSummary, reviewLabels };
    if (id === "sanity/router") return { IntentLink: (props: { params: Record<string, string>; children: string }) => { params = props.params; return createElement("a", { href: "/intent" }, props.children); } };
    return require(id);
  }, exports);
  const props = { value: article, onChange: () => { changed++; }, renderDefault: () => null, onPathFocus: (path: unknown) => { focused = path; } } as unknown as ObjectInputProps;
  const render = () => act(async () => root.render(createElement(ThemeProvider, { theme }, createElement(exports.ArticleEditorialInput!, props))));
  try {
    await render();
    assert.equal(params.id, "selected"); assert.equal(params.preview, "/blog/life-insurance/aia-vitality/"); assert.equal(params.perspective, undefined);
    assert.equal(params.version, undefined);
    assert.equal(dom.window.document.body.textContent.includes("ใน UAT"), false);
    await act(async () => dom.window.document.querySelector("button").click());
    assert.deepEqual(focused, ["review", "status"]);
    const tools = presentationTool({ previewUrl: "/" }).tools;
    assert.ok(Array.isArray(tools));
    const state = tools[0].getIntentState!("edit", params, {}, undefined) as { id: string; _searchParams: string[][] };
    assert.equal(state.id, "selected");
    assert.deepEqual(state._searchParams, [["preview", "/blog/life-insurance/aia-vitality/"]]);
    // Native Presentation interprets an explicit perspective as a release version. Drafts is reserved.
    assert.throws(() => getVersionId(createPublishedId(state.id), "drafts"), /invalid VERSION/);
    assert.equal(state._searchParams.some(([key]) => key === "perspective" || key === "version"), false);
    workspace = { projectId: "ccb9lnw5", dataset: "uat" }; await render();
    assert.equal(dom.window.document.body.textContent.includes("ใน UAT"), true);
    draft = null; await render();
    const generate = () => dom.window.document.querySelector('section[aria-label="สร้างข้อความสำหรับ LINE Card"] button') as HTMLButtonElement;
    assert.match(dom.window.document.body.textContent, /หน้า Live จะไม่เปลี่ยน/);
    const button = (label: string) => { const found = Array.from(document.querySelectorAll("button")).find(item => item.textContent === label); assert.ok(found, label); return found; };
    const edit = async (index: number, value: string) => {
      const input = document.querySelectorAll("textarea")[index]; assert.ok(input);
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value")?.set; assert.ok(setter);
      await act(async () => { setter.call(input, value); input.dispatchEvent(new dom.window.Event("input", { bubbles: true })); input.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    };
    await act(async () => { generate().click(); generate().click(); });
    assert.equal(requests.length, 0, "opening the inline dialog never generates");
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
    assert.deepEqual(Array.from(document.querySelectorAll("textarea"), field => field.value), [LINE_TITLE_DEFAULT_INSTRUCTIONS, LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS]);
    await act(async () => button("ยกเลิก").click()); assert.equal(requests.length, 0);
    await act(async () => generate().click());
    await act(async () => button("คืนค่าเริ่มต้นของ Title").click()); assert.equal(requests.length, 0, "reset is local only");
    await edit(0, "หัวข้อเน้นประเด็นสำคัญ"); await edit(1, "คำโปรยสรุปสิ่งที่จะได้อ่าน");
    await act(async () => { button("สร้างข้อความ LINE").click(); button("สร้างข้อความ LINE").click(); });
    assert.deepEqual(requests, [{ id: "selected", revision: "published-rev", instructions: { lineTitle: "หัวข้อเน้นประเด็นสำคัญ", lineDescription: "คำโปรยสรุปสิ่งที่จะได้อ่าน" } }]);
    assert.deepEqual(focused, ["lineTitle"]);
    assert.equal(changed, 0, "server-persisted fields must not overwrite newer Studio edits");
    assert.match(dom.window.document.body.textContent, /บันทึกไว้ใน Draft/);
    published.lineTitle = "Existing title"; await render();
    await act(async () => generate().click()); assert.equal(requests.length, 1);
    assert.equal(document.querySelectorAll("textarea").length, 1, "filled title has no editable preference");
    await act(async () => button("คืนค่าเริ่มต้นของ Description").click()); assert.equal(requests.length, 1);
    await act(async () => button("สร้างข้อความ LINE").click());
    assert.deepEqual(requests[1], { id: "selected", revision: "published-rev", instructions: { lineDescription: LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS } });
    assert.equal(published.lineTitle, "Existing title"); assert.equal(changed, 0);
    syncing = true; await render();
    assert.equal(generate().disabled, true);
    category = {}; await render();
    assert.equal(dom.window.document.querySelector("a"), null);
    assert.match(dom.window.document.body.textContent, /ตรวจหมวดหมู่และ URL/);
  } finally { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous); }
});

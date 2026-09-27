import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { ObjectInputProps } from "sanity";
import { presentationTool } from "sanity/presentation";
import { createPublishedId, getVersionId } from "@sanity/id-utils";
import ts from "typescript";
import { publicationSummary, reviewLabels } from "../../cms/sanity/policy/article-publication";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");

test("editorial controls preview the selected draft, focus review and show UAT notice only in UAT", async () => {
  const dom = new JSDOM("<div id='root'></div>");
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(dom.window.document.getElementById("root"));
  const article = { _id: "drafts.selected", _rev: "draft-rev", slug: { current: "aia-vitality" }, category: { _ref: "life" }, review: { status: "drafting" } };
  let draft: typeof article | null = article;
  const published = { ...article, _id: "selected", _rev: "published-rev" };
  const requests: string[][] = [];
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
    if (id === "./article-line-copy-action") return { requestArticleLineCopy: async (id: string, revision: string) => { requests.push([id, revision]); await Promise.resolve(); return { status: "applied", lineTitle: "Generated", lineDescription: "Generated description" }; } };
    if (id === "./article-publication") return { publicationSummary, reviewLabels };
    if (id === "sanity/router") return { IntentLink: (props: { params: Record<string, string>; children: string }) => { params = props.params; return createElement("a", { href: "/intent" }, props.children); } };
    return require(id);
  }, exports);
  const props = { value: article, onChange: () => { changed++; }, renderDefault: () => null, onPathFocus: (path: unknown) => { focused = path; } } as unknown as ObjectInputProps;
  const render = () => act(async () => root.render(createElement(exports.ArticleEditorialInput!, props)));
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
    await act(async () => { generate().click(); generate().click(); });
    assert.deepEqual(requests, [["selected", "published-rev"]]);
    assert.deepEqual(focused, ["lineTitle"]);
    assert.equal(changed, 0, "server-persisted fields must not overwrite newer Studio edits");
    assert.match(dom.window.document.body.textContent, /บันทึกไว้ใน Draft/);
    syncing = true; await render();
    assert.equal(generate().disabled, true);
    category = {}; await render();
    assert.equal(dom.window.document.querySelector("a"), null);
    assert.match(dom.window.document.body.textContent, /ตรวจหมวดหมู่และ URL/);
  } finally { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous); }
});

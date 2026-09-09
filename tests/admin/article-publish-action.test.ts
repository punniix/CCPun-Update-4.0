import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import ts from "typescript";

// ponytail: compile only the wrapper to inject Sanity hooks; React mounts real hook state.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
 type Bag = Record<string, any>;
const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
const source = readFileSync(new URL("../../cms/sanity/policy/article-publish-action.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

async function mount() {
  const dom = new JSDOM("<div id='root'></div>");
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(dom.window.document.getElementById("root"));
  const state: Bag = { validation: { isValidating: false, validation: [] }, sync: { isSyncing: false }, calls: [], complete: 0, fail: false };
  const exports: Bag = {};
  new Function("require", "exports", compiled)((id: string) => {
    if (id === "sanity") return { useClient: () => ({}), useSyncState: () => state.sync, useValidationStatus: () => state.validation };
    if (id === "./article-publication") return {
      articlePublishBlock: (draft: Bag) => draft?.review?.status === "approved" ? null : "not approved",
      publishApprovedArticle: async (_client: unknown, draft: Bag, published: Bag) => {
        state.calls.push({ draft, published });
        if (state.fail) throw new Error("revision conflict");
      },
    };
    return require(id);
  }, exports);
  const action = exports.createGoogleSafeArticlePublishAction(() => ({ label: "publish", disabled: false }));
  let current: Bag;
  let props: Bag = {
    id: "article", type: "article", onComplete: () => state.complete++,
    draft: { _id: "drafts.article", _type: "article", _rev: "draft-1", publishedAt: "2020-01-01", review: { status: "approved" } },
    published: { _id: "article", _type: "article", _rev: "live-1", publishedAt: "2020-01-01" },
  };
  function Probe() { current = action(props); return null; }
  const render = async (update: Bag = {}) => { props = { ...props, ...update }; await act(async () => root.render(createElement(Probe))); };
  await render();
  return {
    state, get result() { return current!; }, get props() { return props; }, render,
    handle: async () => { await act(async () => current!.onHandle()); },
    cancel: async () => { await act(async () => current!.dialog.onCancel()); },
    confirm: async () => { await act(async () => current!.dialog.onConfirm()); },
    close: async () => { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous); },
  };
}

test("mounted publish confirmation cancels without mutation; successful confirmation uses approved snapshot", async () => {
  const ui = await mount();
  try {
    await ui.handle(); assert.equal(ui.result.dialog.type, "confirm");
    await ui.cancel(); assert.equal(ui.result.dialog, null); assert.equal(ui.state.calls.length, 0);
    await ui.handle(); await ui.confirm();
    assert.equal(ui.state.calls.length, 1); assert.equal(ui.state.complete, 1);
    assert.equal(ui.state.calls[0].draft._rev, "draft-1");
    assert.equal(ui.state.calls[0].published._rev, "live-1");
    assert.equal(ui.props.draft.publishedAt, "2020-01-01");
    assert.equal(ui.props.draft.contentUpdatedAt, undefined);
  } finally { await ui.close(); }
});

test("mounted wrapper blocks validation, syncing and review changes, including while confirmation is open", async () => {
  const ui = await mount();
  try {
    ui.state.validation.validation = [{ level: "error" }]; await ui.render();
    assert.equal(ui.result.disabled, true); await ui.handle(); assert.equal(Boolean(ui.result.dialog), false);
    ui.state.validation.validation = [{ level: "warning" }]; await ui.render();
    assert.equal(ui.result.disabled, false); await ui.handle();
    ui.state.sync.isSyncing = true; await ui.render(); await ui.confirm();
    assert.equal(ui.result.dialog.type, "dialog"); assert.equal(ui.state.calls.length, 0);
    ui.state.sync.isSyncing = false;
    await ui.render({ draft: { ...ui.props.draft, review: { status: "drafting" } } });
    assert.equal(ui.result.disabled, true);
  } finally { await ui.close(); }
});

test("mounted wrapper rejects either revision changing after confirmation opens", async () => {
  for (const version of ["draft", "published"]) {
    const ui = await mount();
    try {
      await ui.handle(); await ui.render({ [version]: { ...ui.props[version], _rev: "new-revision" } });
      await ui.confirm(); assert.equal(ui.state.calls.length, 0); assert.equal(ui.state.complete, 0);
      assert.equal(ui.result.dialog.type, "dialog");
    } finally { await ui.close(); }
  }
});

test("mounted wrapper surfaces commit failure without completion or timestamp mutation", async () => {
  const ui = await mount();
  try {
    const before = structuredClone(ui.props.draft); ui.state.fail = true;
    await ui.handle(); await ui.confirm();
    assert.equal(ui.state.complete, 0); assert.equal(ui.result.dialog.type, "dialog");
    assert.deepEqual(ui.props.draft, before); assert.equal(ui.result.disabled, false);
  } finally { await ui.close(); }
});

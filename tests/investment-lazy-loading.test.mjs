import { ownerReviewLocationsPredecessor } from '../qa/v5-owner-review-source-successor.mjs';
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const React = require("react");
const { act } = React;
const { JSDOM } = require("jsdom");
const ts = require("typescript");
const root = fileURLToPath(new URL("../", import.meta.url));
const defaults = require("../lib/content/investment-copy-defaults.ts");
const lazyKeys = ["investment.mode.loading", "investment.mode.loadError", "investment.mode.reload"];
const sha = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function renderTool(scope, fail = false) {
  const dom = new JSDOM('<div id="app"></div>', { url: "https://fixture.invalid/" });
  const names = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  const { createRoot } = require("react-dom/client");
  const { flushSync } = require("react-dom");
  const state = { imports: 0, reloads: 0 };
  const component = id => function ModeFixture({ scope: value }) { return React.createElement("section", { id, "data-scope": value }, id); };
  const css = new Proxy({}, { get: (_, name) => String(name) });
  const mocks = {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "@/components/ui/PublicCopyProvider": require("../components/ui/PublicCopyProvider.tsx"),
    "@/lib/content/investment-copy-defaults": defaults,
    "./InvestmentAllocation.module.css": { __esModule: true, default: css },
    "./SingleFundBuilder": { __esModule: true, default: component("single-fixture") },
  };
  const source = readFileSync(root + "features/investment-allocation/InvestmentAllocationTool.tsx", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const exports = {};
  new Function("require", "exports", "window", compiled)(id => {
    if (id === "./PortfolioBuilder") {
      state.imports++;
      if (fail) throw new Error("synthetic chunk failure");
      return { __esModule: true, default: component("portfolio-fixture") };
    }
    if (Object.hasOwn(mocks, id)) return mocks[id];
    throw new Error("Unexpected test import: " + id);
  }, exports, { location: { reload: () => { state.reloads++; } } });
  const node = createRoot(dom.window.document.getElementById("app"));
  const flush = () => new Promise(resolve => setImmediate(resolve));
  try {
    await act(async () => { node.render(React.createElement(exports.default, { scope })); await flush(); });
    assert.equal(state.imports, 0, "default single must not import Portfolio");
    assert.equal(dom.window.document.getElementById("single-fixture").dataset.scope, scope);
    const buttons = [...dom.window.document.querySelectorAll("button[aria-pressed]")];
    assert.equal(buttons[0].getAttribute("aria-pressed"), "true");
    await act(async () => {
      flushSync(() => buttons[1].click());
      assert.equal(dom.window.document.querySelector('[role="status"]').textContent, defaults.INVESTMENT_COPY_DEFAULTS["investment.mode.loading"]);
      await flush();
    });
    assert.equal(state.imports, 1);
    if (fail) {
      const alert = dom.window.document.querySelector('[role="alert"]');
      assert.ok(alert);
      assert.ok(!alert.textContent.includes("synthetic chunk failure"));
      assert.equal(state.reloads, 0, "never automatically reload or discard user state");
      await act(async () => { alert.querySelector("button").click(); });
      assert.equal(state.reloads, 1, "reload happens only on the explicit recovery button");
    } else {
      assert.equal(dom.window.document.getElementById("portfolio-fixture").dataset.scope, scope);
      await act(async () => { buttons[0].click(); await flush(); });
      assert.ok(dom.window.document.getElementById("single-fixture"));
      await act(async () => { buttons[1].click(); await flush(); });
      assert.ok(dom.window.document.getElementById("portfolio-fixture"));
      assert.equal(state.imports, 1, "subsequent switches use the native lazy cache");
    }
  } finally {
    await act(async () => { node.unmount(); });
    dom.window.close();
    for (const name of names) {
      if (previous.get(name)) Object.defineProperty(globalThis, name, previous.get(name));
      else delete globalThis[name];
    }
  }
}

for (const scope of ["main", "aia"]) {
  test(`native App Router lazy loading keeps default, scope and mode switches: ${scope}`, async () => renderTool(scope));
}
test("failed native lazy import renders accessible explicit reload recovery", async () => renderTool("main", true));

test("cached native formatters preserve the original numeric display", () => {
  const values = [0, -0, 0.49, 0.5, -0.5, 1, 1.5, -1.5, 999.49, 999.5, -12345.67, 1e11, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MAX_VALUE, Number.MIN_VALUE, NaN, Infinity, -Infinity];
  for (const file of ["SingleFundBuilder.tsx", "PortfolioBuilder.tsx"]) {
    const source = readFileSync(root + "features/investment-allocation/" + file, "utf8");
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let declaration;
    const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "formatMoney") declaration = node; ts.forEachChild(node, visit); };
    visit(tree);
    assert.ok(declaration?.initializer, file + " uses one native formatter per module");
    const current = new Function("return (" + declaration.initializer.getText(tree) + ")")();
    for (const value of values) assert.equal(current(value), new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value), file);
  }
});

test("lazy labels are CMS-editable without changing prior copy or location contracts", () => {
  const old = Object.entries(defaults.INVESTMENT_COPY_DEFAULTS).filter(([key]) => !lazyKeys.includes(key));
  assert.equal(sha(old), "70cb8d8027c674071c51130bd90248c0a08bc54367f72d66e1cfba7877783735");
  const locations = JSON.parse(ownerReviewLocationsPredecessor(readFileSync(root + "lib/content/public-copy-locations.json", "utf8")));
  for (const key of lazyKeys) {
    assert.ok(locations.investment.entries[key]);
    assert.ok(!old.some(([, value]) => value === defaults.INVESTMENT_COPY_DEFAULTS[key]), "new labels must not change reverse-map last-wins identity");
  }
  // Preserve the original eight pre-Investment scope objects from 7ba6, while
  // Investment locations follow the existing source generator rather than the
  // broad manual placeholders introduced alongside its new copy keys.
  const { investment, ...originalScopes } = locations;
  assert.equal(sha(originalScopes), "39e8e72a3bf1c12508c6fda7a4005ccb2da0bd174e838dde69fbf06e2d5a34e8");
  assert.deepEqual(Object.keys(investment.entries).sort(), Object.keys(defaults.INVESTMENT_COPY_DEFAULTS).sort());
  for (const [index, location] of Object.values(investment.entries).entries()) {
    assert.ok(investment.sections.includes(location.section));
    assert.ok(location.kind.length > 0);
    assert.equal(typeof location.visible, "boolean");
    assert.equal(location.order, index);
  }
  const winners = new Map(old.map(([key, value]) => [value, key]));
  for (const [value, key] of winners) assert.equal(defaults.investmentLabel(value, resolved => resolved), key);
});


test('Reviewed generated location metadata retains every original byte and rejects unknown changes', () => {
  const source = readFileSync(root + 'lib/content/public-copy-locations.json', 'utf8');
  const prior = ownerReviewLocationsPredecessor(source);
  assert.notEqual(prior, source);
  const actual = JSON.parse(source), original = JSON.parse(prior);
  for (const key of ['blog.categoryAccounts.title','blog.categoryAccounts.phillip','blog.categoryAccounts.maybank']) {
    assert.ok(actual.blog.entries[key]);
    assert.equal(original.blog.entries[key], undefined);
  }
  for (const changed of [source + ' ', source.replace('blog.categoryAccounts.title', 'blog.categoryAccounts.changed')]) {
    assert.notEqual(changed, source);
    assert.equal(ownerReviewLocationsPredecessor(changed), changed);
  }
  assert.equal(ownerReviewLocationsPredecessor(prior), prior);
});

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

const source = process.cwd();

const require = createRequire(`${source}/package.json`);
const { JSDOM } = require("jsdom");
const React = require("react");
const { act } = React;
const esbuild = require("esbuild");
const dom = new JSDOM('<!doctype html><body style="overflow:clip"><div id="root"></div><h2 id="section-1">First section</h2></body>', { url: "https://test.ccpun.com/blog/personal-finance/uat-qa/" });
for (const name of ["window", "document", "Element", "HTMLElement", "HTMLDialogElement", "MouseEvent", "Event"]) globalThis[name] = name === "window" ? dom.window : name === "document" ? dom.window.document : dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const media = new Map();
window.matchMedia = (query) => {
  if (!media.has(query)) media.set(query, { media: query, matches: query.includes("max-width"), listeners: new Set(), addEventListener(_, callback) { this.listeners.add(callback); }, removeEventListener(_, callback) { this.listeners.delete(callback); } });
  return media.get(query);
};
const resize = (query, matches) => {
  const state = window.matchMedia(query);
  state.matches = matches;
  state.listeners.forEach((callback) => callback(state));
};
Object.defineProperties(window.HTMLDialogElement.prototype, {
  showModal: { configurable: true, value() { this.open = true; this.querySelector("button")?.focus(); } },
  close: { configurable: true, value() { if (!this.open) return; this.open = false; this.dispatchEvent(new Event("close")); } },
});
const { createRoot } = require("react-dom/client");
const load = (path) => {
  const result = esbuild.buildSync({ entryPoints: [`${source}/${path}`], outfile: "/private/tmp/v5-client-check.cjs", bundle: true, platform: "node", format: "cjs", write: false, external: ["react", "react-dom"], loader: { ".css": "empty", ".module.css": "empty" }, logLevel: "silent" });
  const compiledModule = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${result.outputFiles[0].text}\n})`)(require, compiledModule, compiledModule.exports);
  return compiledModule.exports.default;
};
const Toc = existsSync(`${source}/features/blog/v5/V5ArticleMobileToc.tsx`) ? load("features/blog/v5/V5ArticleMobileToc.tsx") : null;
const Disclosure = load("components/layout/v5/V5FooterDisclosure.tsx");
const host = document.getElementById("root");
let root = createRoot(host);
const checks = [];
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
if (Toc) {
await act(async () => root.render(React.createElement(Toc, { label: "สารบัญ", countLabel: "1 หัวข้อ", closeLabel: "ปิดสารบัญ" }, React.createElement("a", { href: "#section-1" }, "First section"))));
const trigger = host.querySelector("button");
const dialog = host.querySelector("dialog");
await act(async () => trigger.click());
assert.equal(dialog.open, true);
assert.equal(document.body.style.overflow, "hidden");
assert.equal(trigger.getAttribute("aria-controls"), dialog.id);
assert.equal(dialog.getAttribute("aria-labelledby"), host.querySelector("h2").id);
checks.push("dialog opens with labelled native modal and body scroll lock");
await act(async () => dialog.querySelector("button").click());
assert.equal(dialog.open, false);
assert.equal(document.body.style.overflow, "clip");
assert.equal(document.activeElement, trigger);
checks.push("close control restores exact prior overflow and trigger focus");
await act(async () => { trigger.click(); dialog.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
assert.equal(dialog.open, false);
checks.push("backdrop click dismisses");
await act(async () => { trigger.click(); const cancelled = new Event("cancel", { cancelable: true }); dialog.dispatchEvent(cancelled); if (!cancelled.defaultPrevented) dialog.close(); });
assert.equal(dialog.open, false);
assert.equal(document.activeElement, trigger);
checks.push("Escape native cancel contract remains unblocked and restores focus");
await act(async () => { trigger.click(); dialog.querySelector("a").click(); await tick(); });
assert.equal(dialog.open, false);
assert.equal(document.activeElement, document.getElementById("section-1"));
assert.equal(document.getElementById("section-1").getAttribute("tabindex"), "-1");
checks.push("TOC selection keeps fragment anchor and moves focus to its heading");
await act(async () => { trigger.focus(); trigger.click(); });
assert.equal(document.getElementById("section-1").hasAttribute("tabindex"), false);
const handle = dialog.querySelector('[aria-hidden="true"]');
await act(async () => { handle.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientY: 20 })); handle.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientY: 40 })); });
assert.equal(dialog.open, true);
await act(async () => { handle.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientY: 20 })); handle.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientY: 100 })); });
assert.equal(dialog.open, false);
checks.push("small gesture preserves sheet; downward swipe dismisses");
await act(async () => { trigger.click(); resize("(min-width: 1280px)", true); });
assert.equal(dialog.open, false);
checks.push("desktop resize cannot leave an invisible modal open");
await act(async () => { resize("(min-width: 1280px)", false); trigger.click(); root.unmount(); });
assert.equal(document.body.style.overflow, "clip");
checks.push("unmount restores background scroll state");
} else { await act(async () => root.unmount()); }
root = createRoot(host);
await act(async () => root.render(React.createElement(Disclosure, { title: React.createElement("h2", null, "เครื่องมือ") }, React.createElement("ul", null, React.createElement("li", null, React.createElement("a", { href: "/tools/" }, "All tools"))))));
const details = host.querySelector("details");
assert.equal(details.open, false);
assert.equal(details.querySelector("summary").tabIndex, 0);
await act(async () => { details.querySelector("summary").click(); await tick(); });
assert.equal(details.open, true);
await act(async () => { resize("(max-width: 639px)", false); await tick(); });
assert.equal(details.open, true);
assert.equal(details.querySelector("summary").tabIndex, -1);
await act(async () => { details.open = false; details.dispatchEvent(new Event("toggle")); await tick(); });
assert.equal(details.open, true);
assert.equal(details.querySelector("a").getAttribute("href"), "/tools/");
checks.push("native footer disclosure toggles on phone and remains expanded on desktop with links intact");
await act(async () => root.unmount());
// The same physical URL pager must work when five/six cards fit on one
// desktop page but need two mobile pages. No article disappears from the DOM.
resize("(max-width: 639px)", true);
const grid = document.createElement("div"); grid.id = "native-category-check";
const section = document.createElement("section"); section.scrollIntoView = () => {};
for (let index = 0; index < 6; index++) grid.appendChild(document.createElement("article"));
section.appendChild(grid); document.body.appendChild(section);
const Pager = load("features/blog/v5/V5GroupPager.tsx");
root = createRoot(host);
await act(async () => { root.render(React.createElement(Pager, { gridId: grid.id, total: 6, groupTitle: "หมวดทดสอบ" })); await tick(); });
const visible = () => [...grid.children].filter(card => !card.hasAttribute("data-pager-hidden"));
assert.equal(visible().length, 4);
await act(async () => { host.querySelectorAll("button")[2].nextElementSibling.click(); await tick(); });
assert.equal(visible().length, 2);
assert.equal(grid.children.length, 6);
assert.equal(window.location.search, "");
await act(async () => { resize("(max-width: 639px)", false); await tick(); });
assert.equal(visible().length, 6);
assert.equal(host.querySelector("nav"), null);
await act(async () => root.unmount()); section.remove();
checks.push("existing six-card pager shows four/two on mobile, six on desktop, with full DOM and no URL changes");
assert.equal([...media.values()].reduce((sum, state) => sum + state.listeners.size, 0), 0);
checks.push("media listeners are cleaned up");
const paths = ["features/blog/v5/V5ArticleMobileToc.tsx", "components/layout/v5/V5FooterDisclosure.tsx"].filter(path => existsSync(`${source}/${path}`));
const result = { result: "PASS", node: process.version, checks, sourceHashes: Object.fromEntries(paths.map((path) => [path, createHash("sha256").update(readFileSync(`${source}/${path}`)).digest("hex")])), limitations: ["JSDOM native-dialog contract shim; actual browser must verify top-layer focus trapping, touch and rendered CSS.", "All runtime source files unchanged by this check."] };
console.log(JSON.stringify(result));
dom.window.close();

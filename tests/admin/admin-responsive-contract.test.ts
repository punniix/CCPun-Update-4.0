import { readFileSync } from "node:fs";
import { readPhase1Source } from "../../qa/read-phase1-source.mjs";
import { isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const readSource = (relativePath: string) =>
  readCurrentSource(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("compact header preserves a wrapping account/logout and leaves tools in contextual navigation", async () => {
  const { transpileModule, ModuleKind } = createRequire(import.meta.url)("typescript") as typeof import("typescript");
  const compiled = transpileModule(readFileSync(new URL("../../apps/admin/app/(control-plane)/layout.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
  type Element = { type: unknown; props: { children?: unknown; className?: string; href?: string; action?: () => Promise<void>; target?: string; rel?: string; "aria-label"?: string } };
  const elements = (node: unknown): Element[] => {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!node || typeof node !== "object" || !("props" in node)) return [];
    const element = node as Element;
    if (typeof element.type === "function") return elements(element.type(element.props));
    return [element, ...elements(element.props.children)];
  };
  const identity = "synthetic-long-account-".repeat(10) + "@example.invalid";
  for (const advisorAllowed of [true, false]) {
    const signOutCalls: unknown[] = [];
    const loaded = { exports: {} as { default: (props: unknown) => Promise<unknown> } };
    const fixtureRequire = (name: string): unknown => {
      if (name === "@/features/admin/components/AdminProtectedChrome") {
        const owner = { exports: {} };
        const source = readFileSync(new URL("../../features/admin/components/AdminProtectedChrome.tsx", import.meta.url), "utf8");
        const ownerCode = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
        runInNewContext(ownerCode, { module: owner, exports: owner.exports, require: fixtureRequire });
        return owner.exports;
      }
      if (name.endsWith("/admin-navigation-model")) {
        const model = { exports: {} };
        const modelCode = transpileModule(readFileSync(new URL("../../features/admin/components/admin-navigation-model.ts", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
        runInNewContext(modelCode, { module: model, exports: model.exports });
        return model.exports;
      }
      if (name.endsWith("/page-seo")) return { isPageSeoUatAllowed: () => false };
      if (name.endsWith(".module.css")) return { default: { chrome: "admin-owner-chrome" } };
      if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
      if (name === "next/link") return { default: "a" };
      if (name === "next/navigation") return { redirect: () => assert.fail("authenticated fixture must not redirect") };
      if (name === "@/auth") return { auth: async () => ({ user: { role: "owner", email: identity } }), signOut: async (options: unknown) => { signOutCalls.push(options); } };
      if (name.endsWith("/environment")) return { getAdminEnvironment: () => "admin-uat" };
      if (name.endsWith("/presentation")) return { environmentLabel: () => "UAT", roleLabel: () => "เจ้าของระบบ" };
      if (name.endsWith("/rbac")) return { hasAdminPermission: (_role: string, permission: string) => permission !== "advisor:read" || advisorAllowed };
      if (name.endsWith("/capability-profile")) return { getAdminCapabilityProfile: () => "full", isAdminCapabilityPathAllowed: () => true };
      if (name.endsWith("/AdminNavigation") || name.endsWith("/AdminDataRefresh")) return { default: () => null };
      assert.fail("Unexpected dependency " + name);
    };
    runInNewContext(compiled, { module: loaded, exports: loaded.exports, require: fixtureRequire });
    const tree = elements(await loaded.exports.default({ children: "synthetic-content" }));
    const safetySummary = tree.find(element => element.type === "summary" && element.props.children === "ขอบเขตการใช้งาน")!;
    assert.ok(safetySummary, "safety information remains in a native collapsed details disclosure");
    assert.match(safetySummary.props.className!, /\btext-base\b/);
    assert.match(safetySummary.props.className!, /\bleading-6\b/);
    assert.match(safetySummary.props.className!, /\bmin-h-11\b/);
    assert.match(safetySummary.props.className!, /focus-visible:outline-2/);
    const header = tree.find(element => element.type === "header")!;
    const headerNodes = elements(header);
    const tools = headerNodes.find(element => element.props["aria-label"] === "เครื่องมือศูนย์จัดการ")!;
    const account = headerNodes.find(element => element.props["aria-label"] === "บัญชีที่เข้าสู่ระบบ")!;
    assert.equal(tools, undefined, "global tools must not duplicate the task navigation");
    assert.ok(account);
    assert.equal(headerNodes.some(element => element.props.href === "/dashboard/inbox/"), false);
    const navigationElement = (await loaded.exports.default({ children: "synthetic-content" })) as Element;
    const chromeProps = navigationElement.props as typeof navigationElement.props & { navItems: Array<{ id: string; children: Array<{ href: string }> }> };
    assert.equal(chromeProps.navItems.some(group => group.children.some(leaf => leaf.href === "/dashboard/inbox/")), advisorAllowed, "customer destination still follows its original permission");
    assert.equal(elements(account).some(element => element.props.href), false, "tool links must not share the account wrapping row");
    const label = elements(account).find(element => element.props.children === identity)!;
    assert.match(label.props.className!, /overflow-wrap:anywhere/);
    assert.match(account.props.className!, /min-w-0/);
    const form = elements(account).find(element => element.type === "form")!;
    assert.match(form.props.className!, /shrink-0/);
    await form.props.action!();
    assert.equal(JSON.stringify(signOutCalls), JSON.stringify([{ redirectTo: "/login/" }]));
    assert.equal(headerNodes.some(element => element.props.href === "/studio/"), false, "Studio belongs in Content context");
    for (const control of headerNodes.filter(element => element.type === "a" || element.type === "button")) {
      assert.match(control.props.className!, /min-h-11/);
      assert.match(control.props.className!, /focus-visible:outline-2/);
    }
  }
});

test("Admin layout contains wide content without widening the mobile viewport", () => {
  const layout = readSource("apps/admin/app/(control-plane)/layout.tsx");

  assert.match(layout, /<div className=\{`[^`]*\boverflow-x-hidden\b[^`]*`\}>/);
  assert.match(layout, /grid-cols-\[minmax\(0,1fr\)\]/);
  assert.match(layout, /lg:grid-cols-\[220px_minmax\(0,1fr\)\]/);
  assert.match(layout, /<aside className="[^"]*\bmin-w-0\b/);
  assert.match(layout, /<main[^>]*className="[^"]*\bmin-w-0\b/);
});

test("Admin data tables remain horizontally scrollable inside labelled regions", () => {
  const tablePages = [
    "apps/admin/app/(control-plane)/content/articles/page.tsx",
    "apps/admin/app/(control-plane)/seo/page.tsx",
    "features/admin/research/page.tsx",
    "apps/admin/app/(control-plane)/operations/audit-log/page.tsx",
  ];

  for (const page of tablePages) {
    const source = readSource(page);
    assert.match(source, /role="region"[^>]*className="(?:[^"\s]+\s+)*overflow-x-auto(?:\s+[^"\s]+)*"/, page);
  }
});

test("Research workflow links keep a 44px mobile touch target", () => {
  const research = readSource("features/admin/research/page.tsx");

  assert.match(research, /<a key=\{href\} href=\{href\} className="[^"]*\bmin-h-11\b[^"]*\bitems-center\b/);
});

function readCurrentSource(file: string | URL, encoding: "utf8"): string {
  void encoding;
  return readPhase1Source(file instanceof URL ? relative(process.cwd(), fileURLToPath(file)) : isAbsolute(file) ? relative(process.cwd(), file) : file);
}

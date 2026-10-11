import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("header separates tools from a wrapping long account label and preserves permissions/logout", async () => {
  const { transpileModule, ModuleKind } = createRequire(import.meta.url)("typescript") as typeof import("typescript");
  const compiled = transpileModule(readSource("apps/admin/app/(control-plane)/layout.tsx"), { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
  type Element = { type: unknown; props: { children?: unknown; className?: string; href?: string; action?: () => Promise<void>; target?: string; rel?: string; "aria-label"?: string } };
  const elements = (node: unknown): Element[] => {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!node || typeof node !== "object" || !("props" in node)) return [];
    const element = node as Element;
    return [element, ...elements(element.props.children)];
  };
  const identity = "synthetic-long-account-".repeat(10) + "@example.invalid";
  for (const advisorAllowed of [true, false]) {
    const signOutCalls: unknown[] = [];
    const loaded = { exports: {} as { default: (props: unknown) => Promise<unknown> } };
    runInNewContext(compiled, { module: loaded, exports: loaded.exports, require: (name: string) => {
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
    } });
    const tree = elements(await loaded.exports.default({ children: "synthetic-content" }));
    const header = tree.find(element => element.type === "header")!;
    const headerNodes = elements(header);
    const tools = headerNodes.find(element => element.props["aria-label"] === "เครื่องมือศูนย์จัดการ")!;
    const account = headerNodes.find(element => element.props["aria-label"] === "บัญชีที่เข้าสู่ระบบ")!;
    assert.ok(tools && account);
    assert.equal(elements(tools).some(element => element.props.href === "/dashboard/inbox/"), advisorAllowed);
    assert.equal(elements(account).some(element => element.props.href), false, "tool links must not share the account wrapping row");
    const label = elements(account).find(element => element.props.children === identity)!;
    assert.match(label.props.className!, /overflow-wrap:anywhere/);
    assert.match(account.props.className!, /min-w-0/);
    const form = elements(account).find(element => element.type === "form")!;
    assert.match(form.props.className!, /shrink-0/);
    await form.props.action!();
    assert.equal(JSON.stringify(signOutCalls), JSON.stringify([{ redirectTo: "/login/" }]));
    const studio = elements(tools).find(element => element.props.href === "/studio/")!;
    assert.equal(studio.props.target, "_blank");
    assert.equal(studio.props.rel, "noopener noreferrer");
    for (const control of headerNodes.filter(element => element.type === "a" || element.type === "button")) {
      assert.match(control.props.className!, /min-h-11/);
      assert.match(control.props.className!, /focus-visible:outline-2/);
    }
  }
});

test("Admin layout contains wide content without widening the mobile viewport", () => {
  const layout = readSource("apps/admin/app/(control-plane)/layout.tsx");

  assert.match(layout, /<div className="[^"]*\boverflow-x-hidden\b[^"]*">/);
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
    assert.match(source, /role="region"[^>]*className="overflow-x-auto"/, page);
  }
});

test("Research workflow links keep a 44px mobile touch target", () => {
  const research = readSource("features/admin/research/page.tsx");

  assert.match(research, /<a key=\{href\} href=\{href\} className="[^"]*\bmin-h-11\b[^"]*\bitems-center\b/);
});

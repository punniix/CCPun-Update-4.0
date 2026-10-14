import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import type * as Model from "../../features/admin/components/admin-navigation-model";
import type { AdminPermission } from "../../lib/admin/rbac";

const { transpileModule, ModuleKind } = createRequire(import.meta.url)("typescript") as typeof import("typescript");
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
function load<T>(path: string, dependencies: Record<string, unknown> = {}): T {
  const loaded = { exports: {} };
  const code = transpileModule(read(path), { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
  runInNewContext(code, { module: loaded, exports: loaded.exports, process: { env: {} }, require: (name: string) => {
    assert.ok(name in dependencies, "unexpected pure-model dependency " + name);
    return dependencies[name];
  } });
  return loaded.exports as T;
}
const model = load<typeof Model>("features/admin/components/admin-navigation-model.ts");
const rbac = load<typeof import("../../lib/admin/rbac")>("lib/admin/rbac.ts", { "./environment": { getAdminEnvironment: () => "admin-uat" } });
const capability = load<typeof import("../../lib/admin/capability-profile")>("lib/admin/capability-profile.ts", { "./routes": {}, "../runtime/deployment-identity": {} });
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// Independent audit inventory: redirects and dynamic IDs are preserved as effective URLs.
const coverage: Record<string, string[]> = {
  today: ["/dashboard/", "/dashboard/reviews/"],
  customers: ["/dashboard/inbox/", "/dashboard/inbox/synthetic-lead/", "/dashboard/inbox/synthetic-lead/evidence/", "/dashboard/campaigns/"],
  content: ["/content/", "/content/articles/", "/content/articles/synthetic-article/", "/content/calendar/", "/content/research/", "/seo/", "/seo/audits/", "/seo/audits/synthetic-audit/", "/seo/opportunities/", "/seo/keywords/", "/seo/competitors/", "/seo/internal-links/", "/seo/reports/", "/social/", "/social/posts/", "/social/posts/synthetic-post/", "/social/calendar/", "/social/queue/", "/social/campaigns/", "/seo/pages/"],
  results: ["/analytics/", "/analytics/search/", "/analytics/social/", "/analytics/social/post-live/", "/analytics/conversions/", "/analytics/exports/", "/analytics/performance/", "/analytics/website/"],
  settings: ["/social/accounts/", "/social/accounts/meta/", "/social/accounts/youtube/", "/social/accounts/tiktok/", "/operations/", "/operations/health/", "/operations/deployments/", "/operations/jobs/", "/operations/jobs/synthetic-job/", "/operations/local-ai/", "/operations/privacy/", "/operations/audit-log/", "/settings/", "/settings/integrations/", "/settings/access/", "/settings/system/"],
};

test("all 50 effective routes select the explicit owner with or without a trailing slash", () => {
  assert.equal(Object.values(coverage).flat().length, 50);
  assert.deepEqual(Object.values(coverage).map(routes => routes.length), [2, 4, 20, 8, 16]);
  for (const [owner, paths] of Object.entries(coverage)) for (const path of paths) {
    assert.equal(model.adminNavigationRouteOwner(path), owner, path);
    assert.equal(model.adminNavigationRouteOwner(path.slice(0, -1)), owner, path);
  }
});

test("unknown, utility and malformed paths do not select a global task", () => {
  for (const path of ["/", "/login/", "/studio/", "/blog/", "/dashboard/unknown/", "/analytics/unknown/", "/social/accounts/unknown/", "/dashboardish/", "/seo/pages/extra/", "/content/articles/id/extra/", "/seo//", "/seo/%2Fpages/", "/seo/%5cpages/", "/seo/%3f/", "/seo/%ZZ/", "/seo/../settings/", "https://evil.invalid/seo/", "/seo/?private=value"]) assert.equal(model.adminNavigationRouteOwner(path), null, path);
});

test("all six RBAC roles retain exact old permitted leaves in full and editorial profiles", () => {
  const families: Array<[AdminPermission, string[]]> = [
    ["dashboard:read", ["/dashboard/", "/analytics/", "/analytics/search/", "/analytics/social/", "/analytics/conversions/"]],
    ["content:read", ["/content/", "/content/articles/", "/content/calendar/", "/content/research/"]],
    ["seo:read", ["/seo/", "/seo/opportunities/", "/seo/audits/"]],
    ["social:read", ["/social/", "/social/posts/", "/social/calendar/", "/social/queue/", "/social/accounts/"]],
    ["settings:read", ["/operations/", "/operations/health/", "/operations/deployments/", "/operations/jobs/", "/operations/local-ai/", "/operations/privacy/", "/operations/audit-log/", "/settings/", "/settings/integrations/", "/settings/access/", "/settings/system/"]],
  ];
  for (const role of rbac.ADMIN_ROLES) for (const profile of ["full", "editorial"] as const) {
    const hasPermission = (permission: AdminPermission) => rbac.hasAdminPermission(role, permission);
    const isPathAllowed = (path: string) => capability.isAdminCapabilityPathAllowed(path, profile);
    const expected = families.flatMap(([permission, paths]) => hasPermission(permission) ? paths : []);
    if (hasPermission("dashboard:read")) for (const [permission, path] of [["advisor:read", "/dashboard/inbox/"], ["campaign:read", "/dashboard/campaigns/"], ["reviews:read", "/dashboard/reviews/"], ["settings:read", "/analytics/exports/"]] as const) if (hasPermission(permission)) expected.push(path);
    const groups = model.buildAdminNavigation({ profile, hasPermission, isPathAllowed });
    const actual = groups.flatMap(group => group.children.map(leaf => leaf.href));
    assert.deepEqual(plain(actual.sort()), expected.filter(isPathAllowed).sort(), `${role}/${profile}`);
    assert.equal(new Set(actual).size, actual.length);
    for (const group of groups) assert.equal(group.href, group.children[0].href, "first authorized landing");
    if (profile === "editorial") assert.deepEqual(plain(groups.map(group => group.id)), ["content"]);
  }
});

test("new groups never impose or remove a leaf permission", () => {
  const socialOnly = model.buildAdminNavigation({ profile: "full", hasPermission: permission => permission === "social:read", isPathAllowed: () => true });
  assert.deepEqual(plain(socialOnly.map(group => group.id)), ["content", "settings"]);
  assert.equal(socialOnly[1].href, "/social/accounts/", "Settings cannot impose settings:read on Social accounts");
  const dashboardOnly = model.buildAdminNavigation({ profile: "full", hasPermission: permission => permission === "dashboard:read", isPathAllowed: () => true });
  assert.equal(dashboardOnly.some(group => group.id === "customers"), false);
  assert.equal(dashboardOnly.flatMap(group => group.children).some(leaf => leaf.href === "/dashboard/reviews/"), false);
  const seoOnly = model.buildAdminNavigation({ profile: "full", hasPermission: permission => permission === "seo:read", isPathAllowed: () => true });
  assert.equal(seoOnly[0].href, "/seo/");
});

test("disabled/empty menus stay hidden and UAT Page SEO retains its existing owner and capability guards", () => {
  assert.deepEqual(plain(model.buildAdminNavigation({ profile: "disabled", hasPermission: () => true, isPathAllowed: () => true })), []);
  assert.deepEqual(plain(model.buildAdminNavigation({ profile: "full", hasPermission: () => false, isPathAllowed: () => true })), []);
  const extraDestinations = [{ href: "/seo/pages/", label: "SEO หน้าเว็บ · UAT", permissions: ["seo:read"] as AdminPermission[] }];
  for (const profile of ["full", "editorial"] as const) {
    const groups = model.buildAdminNavigation({ profile, hasPermission: () => true, isPathAllowed: path => capability.isAdminCapabilityPathAllowed(path, profile), extraDestinations });
    assert.equal(groups.flatMap(group => group.children).some(leaf => leaf.href === "/seo/pages/"), profile === "full");
  }
  assert.match(read("apps/admin/app/(control-plane)/layout.tsx"), /role === "owner" && isPageSeoUatAllowed\(\)/);
});

test("active group and longest child context preserve deep customer, review and account routes", () => {
  const groups = model.buildAdminNavigation({ profile: "full", hasPermission: () => true, isPathAllowed: () => true });
  for (const [path, id, leaf] of [["/dashboard/inbox/synthetic-lead/evidence/", "customers", "/dashboard/inbox/"], ["/dashboard/reviews/", "today", "/dashboard/reviews/"], ["/social/accounts/meta/", "settings", "/social/accounts/"], ["/social/posts/synthetic-post/", "content", "/social/posts/"], ["/seo/opportunities/", "content", "/seo/opportunities/"]] as const) {
    const group = model.activeAdminNavigationItem(groups, path)!;
    assert.equal(group.id, id);
    assert.equal(model.activeAdminNavigationChild(group, path)?.href, leaf);
  }
  assert.equal(model.activeAdminNavigationItem(groups, "/dashboard/unknown/"), null);
  const editorial = model.buildAdminNavigation({ profile: "editorial", hasPermission: () => true, isPathAllowed: path => capability.isAdminCapabilityPathAllowed(path, "editorial") });
  assert.equal(model.activeAdminNavigationItem(editorial, "/dashboard/reviews/")?.id, "content");
});


test("Today attention cards use the shared Inbox selection and distinguish people from signal counts", async () => {
  type Element = { type: unknown; props: { children?: unknown; href?: string } };
  const elements = (node: unknown): Element[] => {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!node || typeof node !== "object" || !("props" in node)) return [];
    const element = node as Element;
    return [element, ...elements(element.props.children)];
  };
  const text = (node: unknown): string => {
    if (Array.isArray(node)) return node.map(text).join(" ");
    if (node && typeof node === "object" && "props" in node) return text((node as Element).props.children);
    return typeof node === "string" || typeof node === "number" ? String(node) : "";
  };
  const signals = [
    { leadId: "synthetic-a", kind: "human_handoff", reason: "synthetic human" },
    { leadId: "synthetic-a", kind: "new_lead_unread", reason: "synthetic unread" },
    { leadId: "synthetic-b", kind: "new_lead_unread", reason: "synthetic new" },
    { leadId: "synthetic-a", kind: "follow_up_today", reason: "synthetic today" },
    { leadId: "synthetic-b", kind: "follow_up_overdue", reason: "synthetic overdue" },
  ];
  for (const unavailable of [false, true]) {
    let inboxReads = 0;
    const selections: string[] = [];
    const dashboard = load<{ default: (props: { searchParams: Promise<{ error?: string }> }) => Promise<unknown> }>("apps/admin/app/(control-plane)/dashboard/page.tsx", {
      "react/jsx-runtime": { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
      "next/link": { default: "a" },
      "@/lib/admin/require-permission": { requireAdminPermission: async () => ({ role: "owner" }) },
      "@/lib/admin/rbac": { hasAdminPermission: () => true },
      "@/lib/admin/line/advisor-workflow": { listAdvisorInboxOperational: async (options: unknown) => {
        inboxReads++;
        assert.deepEqual(plain(options), {}, "retain the existing single bounded metadata read");
        if (unavailable) throw new Error("synthetic unavailable");
        return [{ leadId: "synthetic-a" }, { leadId: "synthetic-b" }];
      } },
      "@/lib/admin/agent-os/action-center": {
        buildActionCenterSignals: (rows: unknown[]) => { assert.equal(rows.length, 2); return signals; },
        summarizeActionCenter: () => ({}),
        selectActionCenterSignals: (input: unknown, view: string) => {
          assert.equal(input, signals, "Dashboard selects the same built signal set for each attention view");
          selections.push(view);
          return view === "human" ? signals.slice(0, 3) : signals.slice(3);
        },
      },
      "@/lib/admin/presentation": { adminDataLaneLabel: () => "UAT", connectionLabel: () => "ยังไม่พร้อม", datasetLabel: () => "UAT", environmentLabel: () => "UAT" },
      "@/lib/admin/environment": { isStudioDataPlaneAllowed: () => false },
      "@/lib/admin/operations/foundation": { getAdminOperationsRuntimeStatus: () => ({ configured: false, identityValid: false }) },
      "@/lib/admin/operations/jobs-read-model": { readOperationsJobs: async () => ({ jobs: [], status: "partial" }) },
      "@/lib/admin/line/business-intelligence": { readConversionAnalytics: async () => ({ state: "unavailable", summary: null }) },
      "@/lib/admin/sanity-control": { getAdminSanityStatus: () => ({ environment: "admin-uat", dataset: "uat", readReady: false, writeReady: false }), listSeoSuggestions: async () => ({ rows: [] }) },
      "@/lib/admin/dashboard-summary": { editorialDashboardSteps: () => [] },
    });
    const rendered = await dashboard.default({ searchParams: Promise.resolve({}) });
    const tree = elements(rendered);
    const humanCard = tree.find(element => element.props.href === "/dashboard/inbox/?attention=human")!;
    const followUpCard = tree.find(element => element.props.href === "/dashboard/inbox/?attention=follow-up")!;
    assert.ok(humanCard && followUpCard, "each attention card opens its exact selected Inbox view");
    assert.equal(inboxReads, 1);
    if (unavailable) {
      assert.match(text(humanCard), /ยังอ่านไม่ได้/);
      assert.match(text(followUpCard), /ยังอ่านไม่ได้/);
      assert.deepEqual(selections, []);
    } else {
      assert.match(text(humanCard), /2 คน · 3 เรื่อง/);
      assert.match(text(followUpCard), /2 คน · 2 เรื่อง/);
      assert.deepEqual(selections, ["human", "follow-up"]);
    }
    assert.match(text(rendered), /รายการล่าสุดสูงสุด 100 รายการ/);
    assert.match(text(rendered), /แหล่งงานบางส่วนยังอ่านไม่ได้/);
    assert.match(text(followUpCard), /ยังไม่ส่งข้อความแทนคุณ/);
  }
});

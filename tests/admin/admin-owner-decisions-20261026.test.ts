import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  activeMobileTab,
  activeNavigationGroup,
  ADMIN_MOBILE_ALL_MENU_LABEL,
  contextualNavigationItems,
  mobileNavigationTabs,
  type AdminNavigationGroup,
} from "../../features/admin/components/admin-navigation-model";
import { LINE_RICH_MENU_ITEMS } from "../../lib/line/ecosystem";
import {
  adminFaRoomMenu20261026Sources,
  adminOwnerDecisions20261026DomPredecessor,
  adminOwnerDecisions20261026PredecessorDigest,
  adminOwnerDecisions20261026Sources,
} from "../../qa/admin-owner-decisions-20261026-proof.mjs";
import { adminOps20261025PredecessorDigest, adminOps20261025Sources } from "../../qa/admin-ops-20261025-proof.mjs";
import { adminPhase1DomPredecessor } from "../../qa/admin-phase1-quick-wins-proof.mjs";

// Owner Admin decisions (ปั้น, 2026-10-26, marked-up PDF section 5): 5.2 "วันนี้", 5.3 the LINE
// chat button settings under "ลูกค้า & LINE", 5.4 a four-button bottom tab bar on phones,
// 5.5 the light theme on every Admin page, 5.6 "คุยกับปั้น" on the LINE Rich Menu.
const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const LAYOUT = "apps/admin/app/(control-plane)/layout.tsx";

type Group = AdminNavigationGroup & { permission: string };
function navigationGroups(): Group[] {
  const source = read(LAYOUT);
  const block = source.slice(source.indexOf("const NAV_ITEMS"), source.indexOf("];", source.indexOf("const NAV_ITEMS")));
  const groups: Group[] = [];
  for (const line of block.split("\n")) {
    const match = line.match(/\{ href: "([^"]+)", label: "([^"]+)"(?:, permission: "([^"]+)")?/);
    if (!match) continue;
    if (/^ {2}\{ href:/.test(line)) groups.push({ href: match[1], label: match[2], permission: match[3] ?? "", children: [] });
    else groups.at(-1)!.children!.push({ href: match[1], label: match[2] });
  }
  return groups;
}

test("5.2 + 5.3: the home item is วันนี้ and ลูกค้า & LINE holds LINE customers, notices and the chat button", () => {
  const groups = navigationGroups();
  assert.deepEqual(groups.slice(0, 3).map((group) => group.label), ["วันนี้", "ลูกค้า & LINE", "เนื้อหา"]);
  assert.ok(!groups.some((group) => group.label === "ภาพรวม"), "no menu group is still called ภาพรวม");
  const [today, customers] = groups;
  assert.equal(today.href, "/dashboard/");
  assert.deepEqual(today.children!.map((child) => child.href), ["/dashboard/reviews/"]);
  assert.equal(customers.href, "/dashboard/inbox/");
  assert.equal(customers.permission, "advisor:read", "owner-only like the LINE inbox itself");
  assert.deepEqual(customers.children!.map((child) => [child.href, child.label]), [
    ["/dashboard/inbox/", "ลูกค้า LINE"],
    ["/dashboard/campaigns/", "ข้อความแจ้งลูกค้า"],
    ["/settings/line-chat/", "ปุ่มแชท LINE"],
  ]);
  const settings = groups.find((group) => group.href === "/settings/")!;
  assert.ok(!settings.children!.some((child) => child.href === "/settings/line-chat/"), "the chat button is not also listed under ตั้งค่า");
  // Every child keeps the permission it had: inbox advisor:read, notices campaign:read, chat button settings:read.
  const layout = read(LAYOUT);
  assert.match(layout, /\{ href: "\/dashboard\/inbox\/", label: "ลูกค้า LINE", permission: "advisor:read" \}/);
  assert.match(layout, /\{ href: "\/dashboard\/campaigns\/", label: "ข้อความแจ้งลูกค้า", permission: "campaign:read" \}/);
  assert.match(layout, /\{ href: "\/settings\/line-chat\/", label: "ปุ่มแชท LINE", permission: "settings:read" \}/);
  assert.match(read("apps/admin/app/(control-plane)/settings/line-chat/page.tsx"), /requireAdminPermission\("settings:read"\)/);
  // No duplicate destination inside the new group (the group page is its first child).
  const links = contextualNavigationItems(customers).map((item) => item.href);
  assert.deepEqual(links, ["/dashboard/inbox/", "/dashboard/campaigns/", "/settings/line-chat/"]);
  assert.equal(contextualNavigationItems(today)[0].href, "/dashboard/", "วันนี้ keeps its own page link");
});

test("the most specific group is active, so /dashboard/inbox/ and /settings/line-chat/ open ลูกค้า & LINE", () => {
  const groups = navigationGroups();
  const active = (pathname: string) => activeNavigationGroup(groups, pathname)?.label ?? null;
  assert.equal(active("/dashboard/"), "วันนี้");
  assert.equal(active("/dashboard/reviews/"), "วันนี้");
  assert.equal(active("/dashboard/inbox/"), "ลูกค้า & LINE");
  assert.equal(active("/dashboard/inbox/lead-123/evidence/"), "ลูกค้า & LINE");
  assert.equal(active("/dashboard/campaigns/"), "ลูกค้า & LINE");
  assert.equal(active("/settings/line-chat/"), "ลูกค้า & LINE");
  assert.equal(active("/settings/access/"), "ตั้งค่า");
  assert.equal(active("/content/articles/abc/"), "เนื้อหา");
  assert.equal(active("/operations/jobs/"), "สถานะระบบ");
  assert.equal(active("/login/"), null);
  const nav = read("features/admin/components/AdminNavigation.tsx");
  assert.match(nav, /const activeItem = useMemo\(\(\) => activeNavigationGroup\(items, pathname\), \[items, pathname\]\);/);
  assert.match(nav, /const active = item === activeItem;/);
  assert.doesNotMatch(nav, /item\.label\.toLowerCase\(\)/, "ids never come from labels with spaces such as ลูกค้า & LINE");
});

test("5.4: phones get วันนี้, ลูกค้า LINE, เนื้อหา and เมนูทั้งหมด; each tab only when its page is in the menu", () => {
  const owner = navigationGroups();
  assert.deepEqual([...mobileNavigationTabs(owner).map((tab) => tab.label), ADMIN_MOBILE_ALL_MENU_LABEL], ["วันนี้", "ลูกค้า LINE", "เนื้อหา", "เมนูทั้งหมด"]);
  // An editor has no LINE inbox: three buttons, never a dead link.
  const editor = owner.filter((group) => group.permission !== "advisor:read" && group.permission !== "settings:read");
  assert.deepEqual(mobileNavigationTabs(editor).map((tab) => tab.key), ["today", "content"]);
  // Editorial capability: the dashboard is off, its reviews child is promoted to the top level.
  const editorial: AdminNavigationGroup[] = [{ href: "/dashboard/reviews/", label: "งานรอตรวจ" }, { href: "/content/", label: "เนื้อหา", children: [{ href: "/content/articles/", label: "บทความ" }] }];
  assert.deepEqual(mobileNavigationTabs(editorial).map((tab) => tab.key), ["content"]);
  const tab = (pathname: string) => activeMobileTab(owner, pathname);
  assert.equal(tab("/dashboard/"), "today");
  assert.equal(tab("/dashboard/reviews/"), "today");
  assert.equal(tab("/dashboard/inbox/lead-1/"), "customers");
  assert.equal(tab("/settings/line-chat/"), "customers");
  assert.equal(tab("/content/calendar/"), "content");
  assert.equal(tab("/seo/"), "all");
  assert.equal(tab("/operations/health/"), "all");
});

test("5.4: the tab bar is fixed at the bottom, at least 44px per button, safe-area aware and replaces the drawer", () => {
  const nav = read("features/admin/components/AdminNavigation.tsx");
  const css = read("features/admin/components/AdminNavigation.module.css");
  assert.doesNotMatch(nav, /เมนูศูนย์จัดการ\s*\n\s*<span aria-hidden="true">☰<\/span>/, "no side-drawer trigger");
  // The menu is a full-screen sheet, not a side drawer: the module class overrides the kept drawer utilities.
  assert.match(nav, /lg:hidden \$\{styles\.sheet\}`\}/);
  const sheet = css.slice(css.indexOf(".sheet {"), css.indexOf("}", css.indexOf(".sheet {")));
  assert.match(sheet, /width: 100%;/);
  assert.match(sheet, /height: 100dvh;/);
  assert.match(nav, /<div ref=\{triggerRef\} className="lg:hidden">\s*<MobileTabBar /);
  assert.match(nav, /<nav aria-label="เมนูหลักบนมือถือ" className=\{styles\.tabBar\} data-admin-tab-bar="">/);
  assert.match(nav, /aria-haspopup="dialog"\s*aria-controls="admin-mobile-navigation"\s*aria-expanded=\{menuOpen\}/);
  assert.match(nav, /aria-current=\{active \? \(pathname === tab\.href \? "page" : "true"\) : undefined\}/);
  const block = (selector: string) => css.slice(css.indexOf(`${selector} {`), css.indexOf("}", css.indexOf(`${selector} {`)));
  assert.match(block(".tabBar"), /position: fixed;/);
  assert.match(block(".tabBar"), /bottom: 0;/);
  assert.match(block(".tabBar"), /padding-bottom: env\(safe-area-inset-bottom, 0px\);/);
  const minHeight = Number(block(".tab").match(/min-height: (\d+)px;/)?.[1]);
  const minWidth = Number(block(".tab").match(/min-width: (\d+)px;/)?.[1]);
  assert.ok(minHeight >= 44 && minWidth >= 44, `hit target ${minWidth}x${minHeight}`);
  // 390px: four equal columns of 97.5px, each wider than 44px.
  assert.ok(390 / 4 >= 44);
  assert.match(block(".tab"), /font-size: 0\.875rem;/, "14px labels as in the FigCraft frame");
  assert.match(css, /@media \(min-width: 64rem\) \{\s*\.tabBar \{\s*display: none;/);
  assert.match(css, /\.tabActive::before \{/, "the current tab has a visible marker, not colour only");
  // Page content keeps room for the bar and the iOS home indicator.
  assert.match(read("features/admin/components/admin-theme.css"), /@media \(max-width: 63\.999rem\) \{\s*\.admin-theme-scope \{\s*padding-bottom: calc\(57px \+ env\(safe-area-inset-bottom, 0px\)\);/);
});

test("5.5: the light theme covers every page inside the Admin shell, from the header toggle, without a dark flash", () => {
  const chrome = read("features/admin/components/AdminProtectedChrome.tsx");
  assert.match(chrome, /<div className="min-h-screen overflow-x-hidden bg-navy-900 text-white admin-theme-scope">/);
  assert.match(chrome, /<AdminThemeToggle \/>/);
  // The protected layout wraps every control-plane route in this one chrome.
  assert.match(read(LAYOUT), /return <AdminProtectedChrome/);
  const toggle = read("features/admin/components/AdminThemeToggle.tsx");
  assert.match(toggle, /import "\.\/admin-theme\.css";/);
  assert.match(toggle, /<script dangerouslySetInnerHTML=\{\{ __html: ADMIN_THEME_BOOT_SCRIPT \}\} \/>/);
  assert.match(toggle, /localStorage\.setItem\(ADMIN_THEME_STORAGE_KEY, next\)/);
  assert.match(toggle, /<span data-admin-theme-label="light">ธีมสว่าง<\/span>/);
  assert.match(toggle, /<span data-admin-theme-label="dark">ธีมมืด<\/span>/);
  assert.doesNotMatch(toggle, /trackEvent|gtag|fbq|dataLayer/, "a display preference is not an analytics event");

  // Boot script: stored choice first, then the device setting, dark when storage is blocked.
  const { ADMIN_THEME_BOOT_SCRIPT } = { ADMIN_THEME_BOOT_SCRIPT: toggle.match(/ADMIN_THEME_BOOT_SCRIPT = `([^`]+)`/)![1].replace("${ADMIN_THEME_STORAGE_KEY}", "ccpun-admin-theme") };
  const run = (stored: string | null, prefersLight: boolean, blocked = false) => {
    const attributes: Record<string, string> = {};
    const document = { documentElement: { setAttribute: (name: string, value: string) => { attributes[name] = value; } } };
    const localStorage = { getItem: () => { if (blocked) throw new Error("blocked"); return stored; } };
    const window = { matchMedia: () => ({ matches: prefersLight }) };
    new Function("document", "localStorage", "window", ADMIN_THEME_BOOT_SCRIPT)(document, localStorage, window);
    return attributes["data-admin-theme"];
  };
  assert.equal(run("light", false), "light");
  assert.equal(run("dark", true), "dark");
  assert.equal(run(null, true), "light");
  assert.equal(run(null, false), "dark");
  assert.equal(run("purple", false), "dark");
  assert.equal(run(null, true, true), "dark");

  const css = read("features/admin/components/admin-theme.css");
  const scope = 'html[data-admin-theme="light"] .admin-theme-scope';
  assert.ok(css.includes(`${scope} {\n    color-scheme: light;`));
  assert.match(css, /--color-white: #251818;/, "white-alpha text, surfaces and borders become ink-alpha");
  for (const hue of ["amber", "emerald", "sky", "rose", "red", "violet", "cyan"]) for (const shade of [50, 100, 200, 300]) assert.match(css, new RegExp(`--color-${hue}-${shade}: #`), `${hue}-${shade}`);
  for (const literal of [".bg-navy-900", ".bg-navy-800\\/95", ".text-\\[\\#e0c985\\]", ".text-\\[\\#f4df9b\\]", ".focus\\:ring-\\[\\#e0c985\\]:focus", ".bg-\\[\\#252a32\\]"]) {
    assert.ok(css.includes(`${scope} ${literal}`), literal);
  }
  assert.match(css, /^@media screen \{/m, "print keeps its original colours");
  // Every rule that changes colour is scoped to the light Admin shell.
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const selector of body.match(/^[^@{}\n][^{}]*(?=\{)/gm) ?? []) {
    const ok = selector.includes('html[data-admin-theme="light"]') || selector.includes("[data-admin-theme-label=") || selector.trim() === ".admin-theme-scope";
    assert.ok(ok, `unscoped selector: ${selector.trim()}`);
  }
});

test("5.5: light theme text tokens meet WCAG AA on warm white", () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  for (const color of ["#251818", "#5f4f4c", "#54443f", "#765612", "#6a4e0f", "#1d6a4c", "#4a3a3a", "#7a4a04", "#0b5d40", "#0b5679", "#9b1b3c", "#9a1c1c", "#5a2a9e", "#125d70"]) {
    for (const surface of ["#faf6f0", "#ffffff", "#fffdf9", "#f3ece3"]) assert.ok(contrast(color, surface) >= 4.5, `${color} on ${surface}: ${contrast(color, surface).toFixed(2)}`);
  }
  assert.ok(contrast("#251818", "#e0c985") >= 4.5, "dark label on the gold button stays readable");
});

test("5.6: every Rich Menu definition in the repo reads คุยกับปั้น (the typo only lives in the v1 image and its historical seed)", () => {
  assert.equal(LINE_RICH_MENU_ITEMS.find((item) => item.id === "human")?.label, "คุยกับปั้น");
  for (const file of ["lib/line/ecosystem.ts", "lib/admin/line/rich-menu-asset.ts", "scripts/build-line-rich-menu-asset.mjs", "features/admin/line/LineProviderActivationActions.tsx"]) {
    assert.doesNotMatch(read(file), /คุยกับปัน(?!้)/, file);
    assert.match(read(file), /คุยกับปั้น/, file);
  }
  // The historical v1 image and the 2026-09-18 seed migration are checksum-locked records; they are not edited.
  assert.equal(sha(readFileSync(path.join(root, "lib/admin/line/assets/ccpun-line-rich-menu-v1.png")) as unknown as string), "4d8c51ff24ed0a619147a846d9d22872c67dd61c7f756c2c671393cd9b52b5a8");
});

test("owner-decision admissions are exact, chain to the 2026-10-25 successors and reject any further edit", () => {
  const entries = Object.entries(adminOwnerDecisions20261026Sources as Record<string, { before: string; after: string }>);
  assert.deepEqual(entries.map(([file]) => file), [
    LAYOUT,
    "features/admin/components/AdminNavigation.tsx",
    "features/admin/components/AdminProtectedChrome.tsx",
    "features/admin/components/admin-navigation-model.ts",
  ]);
  const reviewed = adminOps20261025Sources as Record<string, { before: string; after: string }>;
  const menu = adminFaRoomMenu20261026Sources as Record<string, { before: string; after: string }>;
  assert.deepEqual(Object.keys(menu), [LAYOUT]);
  for (const [file, { before, after }] of entries) {
    const source = read(file);
    // 8.2 replaced the layout successor once more; it must name the owner-decision successor it replaced.
    if (menu[file]) {
      assert.equal(sha(source), menu[file].after, `${file}: byte-identical to the reviewed FA room menu successor`);
      assert.equal(menu[file].before, after);
      assert.equal(adminOwnerDecisions20261026PredecessorDigest(file, menu[file].after), before);
    } else assert.equal(sha(source), after, `${file}: byte-identical to the reviewed owner-decision successor`);
    assert.equal(before, reviewed[file]!.after, `${file}: names the 2026-10-25 successor it replaced`);
    assert.equal(adminOwnerDecisions20261026PredecessorDigest(file, after), before);
    assert.equal(adminOps20261025PredecessorDigest(file, after), reviewed[file]!.before, `${file}: chains to its original predecessor`);
    const current = sha(source);
    assert.equal(adminOps20261025PredecessorDigest(file, current), reviewed[file]!.before, `${file}: current bytes chain to the original predecessor`);
    const tampered = sha(source + "\n// tamper");
    assert.equal(adminOps20261025PredecessorDigest(file, tampered), tampered, `${file}: unreviewed bytes are not admitted`);
  }
});

test("8.2: the financial planning room is an owner-only menu group and its pages exist", () => {
  const groups = navigationGroups();
  const planning = groups.find((group) => group.href === "/dashboard/planning/")!;
  assert.ok(planning, "ห้องวางแผน FA is in the menu");
  assert.equal(planning.label, "ห้องวางแผน FA");
  assert.equal(planning.permission, "planning:read");
  assert.deepEqual(planning.children!.map((child) => child.href), ["/dashboard/planning/", "/dashboard/planning/retention/"]);
  assert.equal(activeNavigationGroup(groups, "/dashboard/planning/hh-1/")?.href, "/dashboard/planning/", "not the วันนี้ group");
  assert.equal(activeMobileTab(groups, "/dashboard/planning/"), "all");
  const rbac = read("lib/admin/rbac.ts");
  assert.match(rbac, /"planning:read",\n\s*"planning:write",/);
  // Only the owner holds planning permissions (owner: new Set(ADMIN_PERMISSIONS)); no other role lists them.
  assert.equal(rbac.match(/"planning:read"/g)?.length, 1);
  assert.match(read("lib/admin/financial-planning/access.ts"), /identity\.role === "owner"/);
  for (const page of ["page.tsx", "[householdId]/page.tsx", "retention/page.tsx"]) assert.match(read(`apps/admin/app/(control-plane)/dashboard/planning/${page}`), /export const dynamic = "force-dynamic";|PlanningPages/);
  const q = "&quot;";
  const planningJson = `,{${q}href${q}:${q}/dashboard/planning/${q},${q}label${q}:${q}ห้องวางแผน FA${q},${q}permission${q}:${q}planning:read${q},${q}children${q}:[{${q}href${q}:${q}/dashboard/planning/${q},${q}label${q}:${q}ครอบครัวลูกค้า${q}},{${q}href${q}:${q}/dashboard/planning/retention/${q},${q}label${q}:${q}ข้อมูลที่ครบกำหนดตรวจ${q}}]}`;
  assert.equal(adminOwnerDecisions20261026DomPredecessor(`[A${planningJson},B]`), "[A,B]");
});

test("DOM inverse rebuilds only the renamed/regrouped menu, the shell marker and the toggle", () => {
  const q = "&quot;";
  const child = (href: string, label: string) => `{${q}href${q}:${q}${href}${q},${q}label${q}:${q}${label}${q}}`;
  const owner = `{${q}href${q}:${q}/dashboard/${q},${q}label${q}:${q}วันนี้${q},${q}permission${q}:${q}dashboard:read${q},${q}children${q}:[${child("/dashboard/reviews/", "งานรอตรวจ")}]},{${q}href${q}:${q}/dashboard/inbox/${q},${q}label${q}:${q}ลูกค้า &amp; LINE${q},${q}permission${q}:${q}advisor:read${q},${q}children${q}:[${child("/dashboard/inbox/", "ลูกค้า LINE")},${child("/dashboard/campaigns/", "ข้อความแจ้งลูกค้า")},${child("/settings/line-chat/", "ปุ่มแชท LINE")}]}`;
  const original = `{${q}href${q}:${q}/dashboard/${q},${q}label${q}:${q}ภาพรวม${q},${q}permission${q}:${q}dashboard:read${q},${q}children${q}:[${child("/dashboard/inbox/", "ลูกค้า LINE")},${child("/dashboard/campaigns/", "ข้อความแจ้งลูกค้า")},${child("/dashboard/reviews/", "งานรอตรวจ")}]}`;
  assert.equal(adminOwnerDecisions20261026DomPredecessor(owner), original);
  assert.equal(adminOwnerDecisions20261026DomPredecessor('<div class="min-h-screen overflow-x-hidden bg-navy-900 text-white admin-theme-scope"><button data-fixture-component="AdminThemeToggle" data-fixture-props="{}"></button></div>'), '<div class="min-h-screen overflow-x-hidden bg-navy-900 text-white"></div>');
  // Anything else is still compared byte for byte.
  for (const other of ['<div class="admin-theme-scope">', '<button data-fixture-component="AdminThemeToggle" data-fixture-props="{&quot;x&quot;:1}"></button>', `{${q}label${q}:${q}วันนี้${q}}`]) {
    assert.equal(adminOwnerDecisions20261026DomPredecessor(other), other);
  }
  // The chain applies it before the 2026-10-25 and quick-win inverses.
  assert.equal(adminPhase1DomPredecessor(`<div class="min-h-screen overflow-x-hidden bg-navy-900 text-white admin-theme-scope">`), '<div class="min-h-screen overflow-x-hidden bg-navy-900 text-white">');
});

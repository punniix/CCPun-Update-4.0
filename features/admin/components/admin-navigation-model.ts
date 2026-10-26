export type AdminNavigationChild = { href: string; label: string; technical?: boolean };
export type AdminNavigationGroup = { href: string; label: string; children?: AdminNavigationChild[] };

// Group/legacy routes that only redirect to another page. They keep working (old
// bookmarks), but the menu must not show them as a second item for the same page.
// tests/admin/admin-phase1-quick-wins.test.ts checks this map against the redirects.
export const ADMIN_NAVIGATION_REDIRECTS: Readonly<Record<string, string>> = {
  "/content/": "/content/articles/",
  "/operations/": "/operations/health/",
  "/seo/audits/": "/seo/",
  // The manual GSC/GA4 pull page became the "ดึงใหม่ตอนนี้" button on the morning report (A4).
  "/seo/opportunities/": "/analytics/",
};

export function adminNavigationDestination(href: string): string {
  return ADMIN_NAVIGATION_REDIRECTS[href] ?? href;
}

// The automatic "ภาพรวม" link is only added when the group page is a real page
// that no listed child already opens.
export function contextualNavigationItems(item: AdminNavigationGroup): AdminNavigationChild[] {
  const seen = new Set<string>();
  const links: AdminNavigationChild[] = [];
  const children = item.children ?? [];
  const overviewDestination = adminNavigationDestination(item.href);
  const overviewIsChild = children.some((child) => adminNavigationDestination(child.href) === overviewDestination);
  for (const link of [...(overviewIsChild ? [] : [{ href: item.href, label: "ภาพรวม" }]), ...children]) {
    const destination = adminNavigationDestination(link.href);
    if (seen.has(destination)) continue;
    seen.add(destination);
    links.push(link);
  }
  return links;
}

// Technical children are grouped in a collapsed "สำหรับทีมเทคนิค" section (A9).
export function splitTechnicalNavigationItems(links: AdminNavigationChild[]): { everyday: AdminNavigationChild[]; technical: AdminNavigationChild[] } {
  return { everyday: links.filter((link) => !link.technical), technical: links.filter((link) => link.technical) };
}

function isNavigationPathWithin(pathname: string, href: string) {
  if (pathname === href) return true;
  return pathname.startsWith(href.endsWith("/") ? href : `${href}/`);
}

// Owner decision 5.3 (2026-10-26) puts /dashboard/inbox/ and /settings/line-chat/ in their own
// "ลูกค้า & LINE" group, so a page can sit under two group prefixes. The active group is the one
// whose own page or listed child matches the path most specifically; a plain prefix match is the
// fallback for pages that are not in the menu.
export function activeNavigationGroup<T extends AdminNavigationGroup>(items: readonly T[], pathname: string): T | null {
  let best: { item: T; length: number } | null = null;
  for (const item of items) {
    for (const href of [item.href, ...(item.children ?? []).map((child) => child.href)]) {
      if (!isNavigationPathWithin(pathname, href)) continue;
      if (!best || href.length > best.length) best = { item, length: href.length };
    }
  }
  return best?.item ?? null;
}

// Owner decision 5.4 (2026-10-26): phones use a bottom tab bar with four buttons, as in the
// FigCraft frame "A01 วันนี้ · 390": วันนี้, ลูกค้า LINE, เนื้อหา and เมนูทั้งหมด (opens every group).
// A tab only appears when its destination is in this person's menu; เมนูทั้งหมด is always there.
export type AdminMobileTab = { key: "today" | "customers" | "content"; href: string; label: string; group: string };
export const ADMIN_MOBILE_TABS: readonly AdminMobileTab[] = Object.freeze([
  { key: "today", href: "/dashboard/", label: "วันนี้", group: "/dashboard/" },
  { key: "customers", href: "/dashboard/inbox/", label: "ลูกค้า LINE", group: "/dashboard/inbox/" },
  { key: "content", href: "/content/articles/", label: "เนื้อหา", group: "/content/" },
]);
export const ADMIN_MOBILE_ALL_MENU_LABEL = "เมนูทั้งหมด";

export function mobileNavigationTabs(items: readonly AdminNavigationGroup[]): AdminMobileTab[] {
  const reachable = new Set(items.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)]).map(adminNavigationDestination));
  return ADMIN_MOBILE_TABS.filter((tab) => reachable.has(adminNavigationDestination(tab.href)));
}

// Which bottom tab is current: the tab of the active group, otherwise เมนูทั้งหมด ("all").
export function activeMobileTab(items: readonly AdminNavigationGroup[], pathname: string): AdminMobileTab["key"] | "all" {
  const group = activeNavigationGroup(items, pathname);
  const tab = group ? mobileNavigationTabs(items).find((candidate) => candidate.group === group.href) : undefined;
  return tab?.key ?? "all";
}

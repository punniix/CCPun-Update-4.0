export type AdminNavigationChild = { href: string; label: string };
export type AdminNavigationGroup = { href: string; label: string; children?: AdminNavigationChild[] };

// Group/legacy routes that only redirect to another page. They keep working (old
// bookmarks), but the menu must not show them as a second item for the same page.
// tests/admin/admin-phase1-quick-wins.test.ts checks this map against the redirects.
export const ADMIN_NAVIGATION_REDIRECTS: Readonly<Record<string, string>> = {
  "/content/": "/content/articles/",
  "/operations/": "/operations/health/",
  "/seo/audits/": "/seo/",
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

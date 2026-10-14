import type { AdminPermission } from "@/lib/admin/rbac";
import type { AdminCapabilityProfile } from "@/lib/admin/capability-profile";

export type AdminNavigationGroupId = "today" | "customers" | "content" | "results" | "settings";
export type AdminNavigationChild = { href: string; label: string };
export type AdminNavigationItem = { id: AdminNavigationGroupId; href: string; label: string; children: AdminNavigationChild[] };

type Destination = AdminNavigationChild & { permissions: AdminPermission[] };
// Retain each old parent permission and each explicit leaf permission before regrouping.
export const ADMIN_NAVIGATION_DESTINATIONS: readonly Destination[] = [
  { href: "/dashboard/", label: "วันนี้", permissions: ["dashboard:read"] },
  { href: "/dashboard/inbox/", label: "ลูกค้า LINE", permissions: ["dashboard:read", "advisor:read"] },
  { href: "/dashboard/campaigns/", label: "ข้อความแจ้งลูกค้า", permissions: ["dashboard:read", "campaign:read"] },
  { href: "/dashboard/reviews/", label: "งานรอตรวจ", permissions: ["dashboard:read", "reviews:read"] },
  { href: "/content/articles/", label: "บทความ", permissions: ["content:read"] },
  { href: "/content/", label: "ภาพรวมบทความ", permissions: ["content:read"] },
  { href: "/content/calendar/", label: "แผนเผยแพร่บทความ", permissions: ["content:read"] },
  { href: "/content/research/", label: "ข้อมูลประกอบ", permissions: ["content:read"] },
  { href: "/seo/", label: "ตรวจคุณภาพและ SEO", permissions: ["seo:read"] },
  { href: "/seo/opportunities/", label: "โอกาสปรับปรุง SEO", permissions: ["seo:read"] },
  { href: "/seo/audits/", label: "ผลตรวจ SEO", permissions: ["seo:read"] },
  { href: "/social/", label: "ภาพรวมโซเชียล", permissions: ["social:read"] },
  { href: "/social/posts/", label: "โพสต์", permissions: ["social:read"] },
  { href: "/social/calendar/", label: "แผนเผยแพร่โพสต์", permissions: ["social:read"] },
  { href: "/social/queue/", label: "คิวส่งโพสต์", permissions: ["social:read"] },
  { href: "/social/accounts/", label: "บัญชีโซเชียลที่เชื่อมต่อ", permissions: ["social:read"] },
  { href: "/analytics/", label: "ภาพรวมข้อมูล", permissions: ["dashboard:read"] },
  { href: "/analytics/search/", label: "Google และเว็บไซต์", permissions: ["dashboard:read"] },
  { href: "/analytics/social/", label: "ผลลัพธ์โซเชียล", permissions: ["dashboard:read"] },
  { href: "/analytics/conversions/", label: "เส้นทางลูกค้า", permissions: ["dashboard:read"] },
  { href: "/analytics/exports/", label: "ส่งออกข้อมูล", permissions: ["dashboard:read", "settings:read"] },
  { href: "/settings/", label: "ภาพรวมการตั้งค่า", permissions: ["settings:read"] },
  { href: "/settings/integrations/", label: "การเชื่อมต่อ", permissions: ["settings:read"] },
  { href: "/settings/access/", label: "บัญชีและสิทธิ์", permissions: ["settings:read"] },
  { href: "/settings/system/", label: "ข้อมูลระบบ", permissions: ["settings:read"] },
  { href: "/operations/", label: "ภาพรวมสถานะระบบ", permissions: ["settings:read"] },
  { href: "/operations/health/", label: "สถานะการเชื่อมต่อ", permissions: ["settings:read"] },
  { href: "/operations/deployments/", label: "เวอร์ชันที่ใช้งาน", permissions: ["settings:read"] },
  { href: "/operations/jobs/", label: "งานเบื้องหลัง", permissions: ["settings:read"] },
  { href: "/operations/local-ai/", label: "AI ภายใน", permissions: ["settings:read"] },
  { href: "/operations/privacy/", label: "ข้อมูลและความเป็นส่วนตัว", permissions: ["settings:read"] },
  { href: "/operations/audit-log/", label: "ประวัติการทำงาน", permissions: ["settings:read"] },
];

// Explicit effective route templates: longest matching ownership wins, never a parent prefix.
export const ADMIN_NAVIGATION_ROUTES: readonly (readonly [string, AdminNavigationGroupId])[] = [
  ["/dashboard/", "today"], ["/dashboard/reviews/", "today"],
  ...["/dashboard/inbox/", "/dashboard/inbox/[leadId]/", "/dashboard/inbox/[leadId]/evidence/", "/dashboard/campaigns/"].map((path) => [path, "customers"] as const),
  ...["/content/", "/content/articles/", "/content/articles/[id]/", "/content/calendar/", "/content/research/", "/seo/", "/seo/audits/", "/seo/audits/[id]/", "/seo/opportunities/", "/seo/keywords/", "/seo/competitors/", "/seo/internal-links/", "/seo/reports/", "/social/", "/social/posts/", "/social/posts/[id]/", "/social/calendar/", "/social/queue/", "/social/campaigns/", "/seo/pages/"].map((path) => [path, "content"] as const),
  ...["/analytics/", "/analytics/search/", "/analytics/social/", "/analytics/social/post-live/", "/analytics/conversions/", "/analytics/exports/", "/analytics/performance/", "/analytics/website/"].map((path) => [path, "results"] as const),
  ...["/social/accounts/", "/social/accounts/meta/", "/social/accounts/youtube/", "/social/accounts/tiktok/", "/operations/", "/operations/health/", "/operations/deployments/", "/operations/jobs/", "/operations/jobs/[jobId]/", "/operations/local-ai/", "/operations/privacy/", "/operations/audit-log/", "/settings/", "/settings/integrations/", "/settings/access/", "/settings/system/"].map((path) => [path, "settings"] as const),
];

function normalizedPath(pathname: string): string | null {
  if (!pathname.startsWith("/") || /[?#\\\u0000-\u001f\u007f]/.test(pathname) || /%2f|%5c/i.test(pathname)) return null;
  try {
    const path = decodeURIComponent(pathname);
    if (/[?#\\\u0000-\u001f\u007f]/.test(path) || path.includes("//") || path.split("/").some((part) => part === "." || part === "..")) return null;
    return path.length > 1 ? `${path.replace(/\/$/, "")}/` : path;
  } catch { return null; }
}

const ROUTE_MATCHERS = [...ADMIN_NAVIGATION_ROUTES]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([template, owner]) => ({ template, owner, pattern: new RegExp(`^${template.replace(/\[[^\]]+\]/g, "[a-zA-Z0-9_.-]+")}$`) }));

export function adminNavigationRouteOwner(pathname: string, profile: AdminCapabilityProfile = "full"): AdminNavigationGroupId | null {
  if (profile === "disabled") return null;
  const path = normalizedPath(pathname);
  if (!path) return null;
  const match = ROUTE_MATCHERS.find(({ pattern }) => pattern.test(path));
  if (!match) return null;
  return profile === "editorial" && match.template === "/dashboard/reviews/" ? "content" : match.owner;
}

export function buildAdminNavigation({ profile, hasPermission, isPathAllowed, extraDestinations = [] }: {
  profile: AdminCapabilityProfile;
  hasPermission: (permission: AdminPermission) => boolean;
  isPathAllowed: (path: string) => boolean;
  extraDestinations?: readonly Destination[];
}): AdminNavigationItem[] {
  if (profile === "disabled") return [];
  const allowed = [...ADMIN_NAVIGATION_DESTINATIONS, ...extraDestinations].filter((leaf) => leaf.permissions.every(hasPermission) && isPathAllowed(leaf.href));
  const groups: readonly [AdminNavigationGroupId, string][] = [["today", "วันนี้"], ["customers", "ลูกค้า"], ["content", "คอนเทนต์"], ["results", "ผลลัพธ์"], ["settings", "ตั้งค่า"]];
  return groups.flatMap(([id, label]) => {
    const children = allowed.filter((leaf) => adminNavigationRouteOwner(leaf.href, profile) === id).map(({ href, label }) => ({ href, label }));
    return children.length ? [{ id, label, href: children[0].href, children }] : [];
  });
}

export function activeAdminNavigationItem(items: readonly AdminNavigationItem[], pathname: string): AdminNavigationItem | null {
  const owner = adminNavigationRouteOwner(pathname);
  // Reviews moves into Content only for the editorial menu that has no Today group.
  const effectiveOwner = pathname.replace(/\/$/, "") === "/dashboard/reviews" && !items.some((item) => item.id === "today") ? "content" : owner;
  return items.find((item) => item.id === effectiveOwner) ?? null;
}

export function activeAdminNavigationChild(item: AdminNavigationItem, pathname: string): AdminNavigationChild | null {
  const path = normalizedPath(pathname);
  if (!path) return null;
  return [...item.children].sort((a, b) => b.href.length - a.href.length).find((child) => {
    const href = normalizedPath(child.href);
    return href && (path === href || (href !== "/dashboard/" && path.startsWith(href)));
  }) ?? null;
}

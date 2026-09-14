export const ADMIN_PAGE_PREFIXES = [
  "/dashboard",
  "/content",
  "/seo",
  "/social",
  "/analytics",
  "/operations",
  "/settings",
] as const;

export const ADMIN_API_PREFIX = "/api/admin";
export const LEGACY_ADMIN_PAGE_PREFIX = "/snt-admin";
export const LEGACY_ADMIN_API_PREFIX = "/api/snt-admin";
export const ADMIN_NOT_FOUND_PATH = "/admin-not-found";

function isPathOrChild(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isCanonicalAdminPagePath(pathname: string): boolean {
  return isPathOrChild(pathname, "/login")
    || ADMIN_PAGE_PREFIXES.some((prefix) => isPathOrChild(pathname, prefix));
}

export function isAdminPagePath(pathname: string): boolean {
  return isCanonicalAdminPagePath(pathname)
    || isPathOrChild(pathname, LEGACY_ADMIN_PAGE_PREFIX)
    || isPathOrChild(pathname, ADMIN_NOT_FOUND_PATH);
}

export function isAdminApiPath(pathname: string): boolean {
  return isPathOrChild(pathname, ADMIN_API_PREFIX)
    || isPathOrChild(pathname, LEGACY_ADMIN_API_PREFIX);
}

export function safeAdminReturnPath(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const base = new URL("https://admin.ccpun.invalid");
    const url = new URL(value, base);
    const allowed = isCanonicalAdminPagePath(url.pathname) || isPathOrChild(url.pathname, "/studio");
    if (url.origin !== base.origin || url.hash || !allowed) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

const LEGACY_PAGE_ROUTES = new Map<string, string>([
  ["/snt-admin", "/dashboard/"],
  ["/snt-admin/login", "/login/"],
  ["/snt-admin/dashboard", "/dashboard/"],
  ["/snt-admin/content", "/content/articles/"],
  ["/snt-admin/reviews", "/dashboard/inbox/"],
  ["/snt-admin/research", "/content/research/"],
  ["/snt-admin/ubersuggest", "/content/research/"],
  ["/snt-admin/growth", "/analytics/search/"],
  ["/snt-admin/seo", "/seo/"],
  ["/snt-admin/seo/opportunities", "/seo/opportunities/"],
  ["/snt-admin/distribution", "/social/"],
  ["/snt-admin/distribution/overview", "/social/"],
  ["/snt-admin/distribution/operations", "/social/posts/"],
  ["/snt-admin/distribution/calendar", "/social/calendar/"],
  ["/snt-admin/distribution/analytics", "/analytics/social/"],
  ["/snt-admin/distribution/analytics/post-live", "/analytics/social/post-live/"],
  ["/snt-admin/distribution/connections", "/social/accounts/"],
  ["/snt-admin/distribution/connections/meta", "/social/accounts/meta/"],
  ["/snt-admin/distribution/connections/tiktok", "/social/accounts/tiktok/"],
  ["/snt-admin/distribution/connections/youtube", "/social/accounts/youtube/"],
  ["/snt-admin/audit", "/operations/audit-log/"],
  ["/snt-admin/health", "/operations/health/"],
]);

export function legacyAdminPageDestination(pathname: string): string | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const exact = LEGACY_PAGE_ROUTES.get(normalized);
  if (exact) return exact;

  const seoDetailPrefix = "/snt-admin/seo/";
  if (normalized.startsWith(seoDetailPrefix)) {
    const id = normalized.slice(seoDetailPrefix.length);
    return id && !id.includes("/") ? `/seo/audits/${id}/` : null;
  }

  return null;
}

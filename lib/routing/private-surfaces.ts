export const CONTROL_PLANE_PAGE_PREFIXES = [
  "/dashboard",
  "/content",
  "/seo",
  "/social",
  "/analytics",
  "/operations",
  "/settings",
] as const;

export const LEGACY_CONTROL_PLANE_PAGE_PREFIX = "/snt-admin";
export const CONTROL_PLANE_NOT_FOUND_PATH = "/admin-not-found";

export function isPathOrChild(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAdminPagePath(pathname: string): boolean {
  return isPathOrChild(pathname, "/login")
    || CONTROL_PLANE_PAGE_PREFIXES.some((prefix) => isPathOrChild(pathname, prefix))
    || isPathOrChild(pathname, LEGACY_CONTROL_PLANE_PAGE_PREFIX)
    || isPathOrChild(pathname, CONTROL_PLANE_NOT_FOUND_PATH);
}

export function isPrivateSurfacePath(pathname: string): boolean {
  return isAdminPagePath(pathname) || isPathOrChild(pathname, "/studio");
}

import {
  CONTROL_PLANE_NOT_FOUND_PATH,
  CONTROL_PLANE_PAGE_PREFIXES,
  isPathOrChild,
} from "../routing/private-surfaces";

export const ADMIN_PAGE_PREFIXES = CONTROL_PLANE_PAGE_PREFIXES;
export const ADMIN_API_PREFIX = "/api/admin";
export const ADMIN_NOT_FOUND_PATH = CONTROL_PLANE_NOT_FOUND_PATH;

export function isCanonicalAdminPagePath(pathname: string): boolean {
  return isPathOrChild(pathname, "/login")
    || ADMIN_PAGE_PREFIXES.some((prefix) => isPathOrChild(pathname, prefix));
}

export function isAdminPagePath(pathname: string): boolean {
  return isCanonicalAdminPagePath(pathname)
    || isPathOrChild(pathname, ADMIN_NOT_FOUND_PATH);
}

export function isAdminApiPath(pathname: string): boolean {
  return isPathOrChild(pathname, ADMIN_API_PREFIX);
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

import { isAdminApiPath, isAdminPagePath } from "./routes";

export type ProductionAdminPathDisposition = "entry" | "allow" | "reject";

function isPathOrChild(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function classifyProductionAdminPath(pathname: string): ProductionAdminPathDisposition {
  const path = pathname || "/";

  if (path === "/") return "entry";

  if (
    isAdminPagePath(path) ||
    isAdminApiPath(path) ||
    isPathOrChild(path, "/studio") ||
    isPathOrChild(path, "/api/preview") ||
    isPathOrChild(path, "/api/auth") ||
    isPathOrChild(path, "/_next") ||
    path.startsWith("/favicon.") ||
    path === "/robots.txt"
  ) {
    return "allow";
  }

  return "reject";
}

import {
  CCPUN_VERCEL_PROJECT_IDS,
  type AdminEnvironment,
} from "./environment";
import { isAdminApiPath, isAdminPagePath } from "./routes";

export type ProductionAdminPathDisposition = "entry" | "allow" | "reject";

const DEDICATED_ADMIN_ENVIRONMENTS = new Set<AdminEnvironment>([
  "local-uat",
  "local-production",
  "admin-uat",
  "production-admin",
]);

export function isKnownAdminDeploymentHost(host: string | null): boolean {
  const hostname = host?.trim().toLowerCase().split(":", 1)[0];
  return Boolean(
    hostname === "admin.ccpun.com" ||
    (hostname && /^ccpun-admin(?:-.+)?\.vercel\.app$/.test(hostname)),
  );
}

export function isAdminRequestBoundary(input: {
  environment: AdminEnvironment;
  vercelEnvironment: string | undefined;
  deploymentProjectId: string | undefined;
  host: string | null;
}): boolean {
  if (DEDICATED_ADMIN_ENVIRONMENTS.has(input.environment)) return true;

  const isExactAdminVercelDeployment =
    ["preview", "production"].includes(input.vercelEnvironment?.trim().toLowerCase() ?? "") &&
    input.deploymentProjectId?.trim() === CCPUN_VERCEL_PROJECT_IDS.adminProduction;

  return isExactAdminVercelDeployment || isKnownAdminDeploymentHost(input.host);
}

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

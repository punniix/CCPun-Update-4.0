import {
  type AdminEnvironment,
} from "./environment";
import { isAdminApiPath, isAdminPagePath } from "./routes";

export type ProductionAdminPathDisposition = "entry" | "allow" | "reject";

const DEDICATED_ADMIN_ENVIRONMENTS = new Set<AdminEnvironment>([
  "local-uat",
  "admin-uat",
  "production-admin",
]);

export function isKnownAdminDeploymentHost(host: string | null): boolean {
  const hostname = host?.trim().toLowerCase().split(":", 1)[0];
  return Boolean(
    hostname === "admin.ccpun.com",
  );
}

export function isAdminRequestBoundary(input: {
  environment: AdminEnvironment;
  host: string | null;
}): boolean {
  if (DEDICATED_ADMIN_ENVIRONMENTS.has(input.environment)) return true;

  return isKnownAdminDeploymentHost(input.host);
}

export function isExactAdminPreviewOrigin(_input: {
  environment: AdminEnvironment;
  host: string | null;
}): boolean {
  // Native deployments must use the explicitly configured AUTH_URL origin.
  return false;
}

function isPathOrChild(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAuthenticatedAdminPreviewPath(pathname: string): boolean {
  const path = pathname || "/";
  return (
    isPathOrChild(path, "/blog") ||
    isPathOrChild(path, "/assets") ||
    isPathOrChild(path, "/images")
  );
}

export function isInternalServiceApiPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return path === "/api/admin/social/worker"
    || path === "/api/internal/line/rich-menu/reconcile"
    || path === "/api/internal/line/system-delivery/dispatch"
    || path === "/api/internal/line/ingest"
    || path === "/api/internal/line/ingest-event"
    || path === "/api/internal/line/bridge-health"
    || path === "/api/internal/line/public-event"
    || path === "/api/internal/analytics/daily"
    || path === "/api/internal/analytics/assessment"
    || path === "/api/internal/marketing/refresh"
    || path === "/api/internal/marketing/analysis"
    || path === "/api/internal/marketing/workspace"
    || path === "/api/internal/marketing/actions/import"
    || isPathOrChild(path, "/api/internal/agent-os/jobs")
    || path === "/api/internal/agent-os/exports"
    || isPathOrChild(path, "/api/internal/local-ai/jobs")
    || isPathOrChild(path, "/api/internal/local-ai/line-descriptions")
    || isPathOrChild(path, "/api/internal/local-ai/reviews")
    || isPathOrChild(path, "/api/internal/local-ai/operations")
    // n8n social worker: HMAC + one-time nonce inside the handlers, 404 unless the send flag is on.
    || isPathOrChild(path, "/api/internal/social/jobs");
}

export function classifyProductionAdminPath(pathname: string): ProductionAdminPathDisposition {
  const path = pathname || "/";

  if (path === "/") return "entry";

  if (
    isAdminPagePath(path) ||
    isAdminApiPath(path) ||
    isInternalServiceApiPath(path) ||
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

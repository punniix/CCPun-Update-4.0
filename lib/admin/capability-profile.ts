import { safeAdminReturnPath } from "./routes";
import { resolveDeploymentIdentity } from "../runtime/deployment-identity";

export type AdminCapabilityProfile = "full" | "editorial" | "disabled";

export function getAdminCapabilityProfile(variables?: Record<string, string | undefined>): AdminCapabilityProfile {
  const server = (variables ? variables.CCPUN_ADMIN_CAPABILITY_PROFILE : process.env.CCPUN_ADMIN_CAPABILITY_PROFILE)?.trim().toLowerCase();
  const artifact = (variables ? variables.NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE : process.env.NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE)?.trim().toLowerCase();
  const values = [server, artifact].filter(Boolean);
  if (values.some((value) => value !== "full" && value !== "editorial")) return "disabled";
  if (server && artifact && server !== artifact) return "disabled";
  return values.includes("editorial") ? "editorial" : "full";
}

function normalizedPath(pathname: string): string | null {
  if (!pathname.startsWith("/") || /%2f|%5c/i.test(pathname)) return null;
  try {
    const path = decodeURIComponent(pathname);
    if (/[\\\u0000-\u001f\u007f?#]/.test(path) || path.includes("//") || path.split("/").some((part) => part === "." || part === "..")) return null;
    return path.length > 1 ? path.replace(/\/$/, "") : path;
  } catch { return null; }
}

export function isAdminCapabilityPathAllowed(pathname: string, profile = getAdminCapabilityProfile()): boolean {
  if (profile === "full") return true;
  if (profile !== "editorial") return false;
  const path = normalizedPath(pathname);
  if (!path) return false;
  if (path === "/api/internal/line/system-delivery/dispatch") return isAdminLineSystemDeliveryAllowed(profile);
  if (["/", "/login", "/admin-not-found", "/robots.txt", "/favicon.ico", "/favicon.png", "/_next/image"].includes(path)) return true;
  if (["/_next/static/", "/studio/", "/blog/", "/assets/", "/images/"].some((prefix) => path.startsWith(prefix))) return true;
  if (["/studio", "/blog", "/assets", "/images"].includes(path)) return true;
  if (/^\/api\/auth(?:\/(?:signin|signout|session|callback|providers|csrf|error|verify-request)(?:\/[a-zA-Z0-9_-]+)?)?$/.test(path)) return true;
  if (/^\/api\/preview\/(?:enable|disable)$/.test(path)) return true;
  if (["/content", "/content/articles", "/content/research", "/seo", "/seo/audits", "/seo/opportunities", "/dashboard/reviews"].includes(path)) return true;
  if (/^\/seo\/(?:keywords|internal-links|competitors|reports)$/.test(path)) return true;
  const id = "[a-zA-Z0-9_.-]+";
  if (new RegExp(`^/(?:content/articles|seo/audits)/${id}$`).test(path)) return true;
  if (["/api/admin/content", "/api/admin/seo/suggestions", "/api/admin/seo/providers/readiness", "/api/admin/seo/opportunities", "/api/admin/research", "/api/admin/research/ubersuggest", "/api/admin/research/ubersuggest/import", "/api/admin/reviews"].includes(path)) return true;
  return new RegExp(`^/api/admin/(?:content/${id}/preview|seo/audit/${id}(?:/proposals)?|reviews/${id}/(?:approve|edit|reject|apply))$`).test(path);
}

export function isAdminLineSystemDeliveryAllowed(profile = getAdminCapabilityProfile(), variables: Record<string, string | undefined> = process.env): boolean {
  if (profile === "full") return true;
  if (profile !== "editorial" || variables.CCPUN_LINE_SYSTEM_DELIVERY_ENABLED !== "true") return false;
  const identity = resolveDeploymentIdentity(variables, "admin");
  return identity.valid && identity.provider === "hostinger" && identity.role === "admin"
    && (identity.environment === "admin-uat"
      || (identity.environment === "production-admin" && identity.gitRef === "v4-production"));
}

export function adminCapabilityLandingPath(profile = getAdminCapabilityProfile()): string {
  return profile === "editorial" ? "/content/articles/" : "/dashboard/";
}

export function safeAdminCapabilityReturnPath(value: string | null | undefined, profile = getAdminCapabilityProfile()): string | null {
  const path = safeAdminReturnPath(value);
  return path && isAdminCapabilityPathAllowed(new URL(path, "https://admin.ccpun.invalid").pathname, profile) ? path : null;
}

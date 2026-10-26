import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "../auth-config";
import type { AdminEnvironment } from "../environment";

/**
 * Hostinger's Next.js route handler can receive a rewritten internal URL after
 * the Admin proxy has validated the real ingress host. Do not trust a forwarded
 * host alone: require Host and every supplied forwarding host to match AUTH_URL,
 * along with an exact deployed Admin lane and authenticated Owner at the caller.
 */
export function isPostPublishAdminOriginAllowed(
  request: Request,
  env: Record<string, string | undefined>,
  environment: AdminEnvironment,
): boolean {
  const configured = env.AUTH_URL?.trim();
  if (!configured) return false;

  const deployedHostinger = env.CCPUN_DEPLOYMENT_PROVIDER === "hostinger"
    && env.CCPUN_DEPLOYMENT_ROLE === "admin"
    && (environment === "admin-uat" || environment === "production-admin");

  if (deployedHostinger) {
    const expected = environment === "admin-uat"
      ? "https://admin-test.ccpun.com"
      : "https://admin.ccpun.com";
    if (configured !== expected) return false;
    try {
      const requestUrl = new URL(request.url);
      const publicUrl = new URL(configured);
      if ((requestUrl.protocol !== "https:" && requestUrl.protocol !== "http:")
        || requestUrl.username || requestUrl.password) return false;
      const host = request.headers.get("host")?.trim().toLowerCase();
      const forwardedHost = request.headers.get("x-forwarded-host")?.trim().toLowerCase();
      const forwardedProto = request.headers.get("x-forwarded-proto")?.trim().toLowerCase();
      if (host !== publicUrl.host || (forwardedHost && forwardedHost !== publicUrl.host)
        || (forwardedProto && forwardedProto !== "https")) return false;
      if (request.method === "GET") return true;
      const origin = request.headers.get("origin");
      return Boolean(origin && new URL(origin).origin === publicUrl.origin);
    } catch {
      return false;
    }
  }

  return isConfiguredAdminOrigin(request.url, configured)
    && (request.method === "GET" || isSameOriginAdminMutation(request.url, request.headers.get("origin")));
}

export const SANITY_PUBLISH_PATH = "/api/integrations/sanity/article-published/";
export function isSanityPublishIngress(request: Request, env: Record<string, string | undefined> = {}) {
  const url = new URL(request.url);
  const host = request.headers.get("host")?.trim().toLowerCase();
  const forwarded = request.headers.get("x-forwarded-host")?.trim().toLowerCase();
  const proto = request.headers.get("x-forwarded-proto")?.trim().toLowerCase();
  const deployed = env.CCPUN_APP_ENV === "production-admin" && env.CCPUN_DEPLOYMENT_PROVIDER === "hostinger"
    && env.CCPUN_DEPLOYMENT_ROLE === "admin" && env.AUTH_URL === "https://admin.ccpun.com"
    && !Object.keys(env).some(key => key.startsWith("VERCEL_") && Boolean(env[key]));
  if (!deployed) return false;
  // Match the trusted Hostinger ingress contract used by the Owner route above:
  // Next may rewrite to any internal HTTP(S) URL, but Host and every supplied
  // forwarding value must still identify the configured public Admin origin.
  // This is only the host fence; the producer must authenticate the raw body.
  return request.method === "POST" && ["http:", "https:"].includes(url.protocol)
    && !url.username && !url.password
    && url.pathname === SANITY_PUBLISH_PATH && host === "admin.ccpun.com"
    && !url.search && (!forwarded || forwarded === host) && (!proto || proto === "https");
}

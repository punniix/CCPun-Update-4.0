import { createHash, timingSafeEqual } from "node:crypto";

import { getAdminDeploymentIdentity } from "../environment";

export function isN8nLocalAiRequestAuthorized(
  request: Request,
  variables: Record<string, string | undefined> = process.env,
) {
  if (variables.CCPUN_LOCAL_AI_N8N_ENABLED?.trim() !== "true") return false;
  const expected = variables.CCPUN_LOCAL_AI_N8N_TOKEN?.trim();
  const authorization = request.headers.get("authorization")?.trim();
  if (!expected || expected.length < 43 || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice(7).trim();
  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

// URL validation cannot attest the remote workflow's lane or token scope.
export function resolveLineCopyN8nBridge(variables: Record<string, string | undefined>) {
  const identity = getAdminDeploymentIdentity(variables);
  if (!identity.valid || identity.role !== "admin") return null;
  if (identity.environment === "production-admin") return { lane: "production-admin" } as const;
  if (identity.environment !== "admin-uat"
    || (variables.NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER !== undefined
      && variables.NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER.trim() !== identity.provider)
    || (variables.NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE !== undefined
      && variables.NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE.trim() !== "admin")
    || variables.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim() !== "ccb9lnw5"
    || variables.NEXT_PUBLIC_SANITY_DATASET?.trim() !== "uat"
    || (variables.NEXT_PUBLIC_CCPUN_APP_ENV !== undefined
      && variables.NEXT_PUBLIC_CCPUN_APP_ENV.trim() !== "admin-uat")) return null;

  const token = variables.CCPUN_LOCAL_AI_N8N_TOKEN?.trim();
  const configuredUrl = variables.CCPUN_LOCAL_AI_N8N_WEBHOOK_URL?.trim();
  if (!token || token.length < 43 || !configuredUrl || configuredUrl.length > 2048
    || configuredUrl.includes("?") || configuredUrl.includes("#")) return null;
  try {
    const webhookUrl = new URL(configuredUrl);
    // Restrict paths to canonical, unencoded webhook segments: no dot/encoded
    // separators, nested encoding, trailing slash or legacy Production endpoint.
    if (webhookUrl.protocol !== "https:" || webhookUrl.username || webhookUrl.password
      || webhookUrl.search || webhookUrl.hash || webhookUrl.href !== configuredUrl
      || !/^\/webhook\/[A-Za-z0-9_-]+$/.test(webhookUrl.pathname)
      || webhookUrl.pathname.toLowerCase() === "/webhook/ccpun-line-card-generate") return null;
    return { lane: "admin-uat", token, webhookUrl } as const;
  } catch {
    return null;
  }
}

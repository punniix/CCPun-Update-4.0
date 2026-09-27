import { createRemoteJWKSet, jwtVerify } from "jose";
import { CCPUN_VERCEL_PROJECT_IDS } from "./deployment-identity";

export const CCPUN_VERCEL_TEAM_SLUG = "punniixs-projects";
export const CCPUN_VERCEL_TEAM_ID = "team_GbcO71LS2dLHwiBV6Cs39Kax";
export const CCPUN_WEB_PROJECT_ID = CCPUN_VERCEL_PROJECT_IDS.web;
export const CCPUN_WEB_PROJECT_NAME = "ccpun-web";
export const CCPUN_WEB_OIDC_AUDIENCE = `https://vercel.com/${CCPUN_VERCEL_TEAM_SLUG}`;
export const CCPUN_WEB_PRODUCTION_OIDC_SUBJECT =
  `owner:${CCPUN_VERCEL_TEAM_SLUG}:project:${CCPUN_WEB_PROJECT_NAME}:environment:production`;

// The gateway remains Web-only; the separate Admin policy is for the read-only probe.
export const PRODUCTION_VERCEL_SERVICE_POLICIES = {
  web: { projectId: CCPUN_WEB_PROJECT_ID, project: CCPUN_WEB_PROJECT_NAME, subject: CCPUN_WEB_PRODUCTION_OIDC_SUBJECT },
  admin: { projectId: CCPUN_VERCEL_PROJECT_IDS.admin, project: "ccpun-admin", subject: `owner:${CCPUN_VERCEL_TEAM_SLUG}:project:ccpun-admin:environment:production` },
} as const;
export type VercelServiceRole = keyof typeof PRODUCTION_VERCEL_SERVICE_POLICIES;

export function isProductionVercelServiceClaims(payload: Record<string, unknown>, role: VercelServiceRole) {
  const policy = PRODUCTION_VERCEL_SERVICE_POLICIES[role];
  return payload.aud === CCPUN_WEB_OIDC_AUDIENCE
    && payload.project_id === policy.projectId && payload.project === policy.project
    && payload.owner_id === CCPUN_VERCEL_TEAM_ID && payload.owner === CCPUN_VERCEL_TEAM_SLUG
    && payload.environment === "production" && payload.sub === policy.subject;
}

export function isProductionWebOidcClaims(payload: Record<string, unknown>) {
  return isProductionVercelServiceClaims(payload, "web");
}

const OIDC_ISSUERS = [
  `https://oidc.vercel.com/${CCPUN_VERCEL_TEAM_SLUG}`,
  "https://oidc.vercel.com",
].map((issuer) => ({ issuer, jwks: createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`), { timeoutDuration: 3000 }) }));

export async function isProductionVercelServiceTokenAuthorized(
  token: string | null,
  role: VercelServiceRole,
  verify: typeof jwtVerify = jwtVerify,
) {
  if (!token || token.length < 100 || token.length > 16_384) return false;
  for (const source of OIDC_ISSUERS) {
    try {
      const { payload } = await verify(token, source.jwks, {
        algorithms: ["RS256"], issuer: source.issuer, audience: CCPUN_WEB_OIDC_AUDIENCE,
        subject: PRODUCTION_VERCEL_SERVICE_POLICIES[role].subject, clockTolerance: 5,
      });
      if (isProductionVercelServiceClaims(payload, role)) return true;
    } catch { /* Try only the other Vercel issuer and its matching JWKS. */ }
  }
  return false;
}

export function bearerToken(authorization: string | null) {
  const value = authorization?.trim();
  return value?.startsWith("Bearer ") ? value.slice(7).trim() : null;
}

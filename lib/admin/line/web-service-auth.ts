import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  CCPUN_VERCEL_TEAM_SLUG,
  CCPUN_WEB_OIDC_AUDIENCE,
  CCPUN_WEB_PRODUCTION_OIDC_SUBJECT,
  isProductionWebOidcClaims,
} from "./web-service-identity";

const OIDC_ISSUERS = [
  {
    issuer: `https://oidc.vercel.com/${CCPUN_VERCEL_TEAM_SLUG}`,
    jwks: createRemoteJWKSet(new URL(`https://oidc.vercel.com/${CCPUN_VERCEL_TEAM_SLUG}/.well-known/jwks`)),
  },
  {
    issuer: "https://oidc.vercel.com",
    jwks: createRemoteJWKSet(new URL("https://oidc.vercel.com/.well-known/jwks")),
  },
] as const;

export async function isProductionWebServiceRequestAuthorized(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.startsWith("Bearer ")) return false;
  const token = authorization.slice(7).trim();
  if (token.length < 100 || token.length > 16_384) return false;

  for (const source of OIDC_ISSUERS) {
    try {
      const { payload } = await jwtVerify(token, source.jwks, {
        algorithms: ["RS256"],
        issuer: source.issuer,
        audience: CCPUN_WEB_OIDC_AUDIENCE,
        subject: CCPUN_WEB_PRODUCTION_OIDC_SUBJECT,
        clockTolerance: 5,
      });
      if (isProductionWebOidcClaims(payload)) return true;
    } catch {
      // Try only the other Vercel issuer and its matching JWKS.
    }
  }
  return false;
}

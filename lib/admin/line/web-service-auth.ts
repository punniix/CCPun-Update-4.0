import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  CCPUN_VERCEL_TEAM_SLUG,
  CCPUN_WEB_PRODUCTION_OIDC_SUBJECT,
  isProductionWebOidcClaims,
} from "./web-service-identity";

const OIDC_JWKS = createRemoteJWKSet(new URL("https://oidc.vercel.com/.well-known/jwks"));
const EXPECTED_ISSUERS = [
  `https://oidc.vercel.com/${CCPUN_VERCEL_TEAM_SLUG}`,
  "https://oidc.vercel.com",
] as const;
const EXPECTED_AUDIENCES = [
  `https://vercel.com/${CCPUN_VERCEL_TEAM_SLUG}`,
  "https://vercel.com",
] as const;

export async function isProductionWebServiceRequestAuthorized(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.startsWith("Bearer ")) return false;
  const token = authorization.slice(7).trim();
  if (token.length < 100 || token.length > 16_384) return false;

  try {
    const { payload } = await jwtVerify(token, OIDC_JWKS, {
      algorithms: ["RS256"],
      issuer: [...EXPECTED_ISSUERS],
      audience: [...EXPECTED_AUDIENCES],
      subject: CCPUN_WEB_PRODUCTION_OIDC_SUBJECT,
      clockTolerance: 5,
    });
    return isProductionWebOidcClaims(payload);
  } catch {
    return false;
  }
}

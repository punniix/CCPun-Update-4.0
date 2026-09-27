export const CCPUN_VERCEL_TEAM_SLUG = "punniixs-projects";
export const CCPUN_VERCEL_TEAM_ID = "team_GbcO71LS2dLHwiBV6Cs39Kax";
import { CCPUN_VERCEL_PROJECT_IDS } from "../../runtime/deployment-identity";
export const CCPUN_WEB_PROJECT_ID = CCPUN_VERCEL_PROJECT_IDS.web;
export const CCPUN_WEB_PROJECT_NAME = "ccpun-web";
export const CCPUN_WEB_PRODUCTION_OIDC_SUBJECT =
  `owner:${CCPUN_VERCEL_TEAM_SLUG}:project:${CCPUN_WEB_PROJECT_NAME}:environment:production`;
export const CCPUN_WEB_OIDC_AUDIENCE = `https://vercel.com/${CCPUN_VERCEL_TEAM_SLUG}`;

export function isProductionWebOidcClaims(payload: Record<string, unknown>) {
  return (
    payload.aud === CCPUN_WEB_OIDC_AUDIENCE &&
    payload.project_id === CCPUN_WEB_PROJECT_ID &&
    payload.project === CCPUN_WEB_PROJECT_NAME &&
    payload.owner_id === CCPUN_VERCEL_TEAM_ID &&
    payload.owner === CCPUN_VERCEL_TEAM_SLUG &&
    payload.environment === "production" &&
    payload.sub === CCPUN_WEB_PRODUCTION_OIDC_SUBJECT
  );
}

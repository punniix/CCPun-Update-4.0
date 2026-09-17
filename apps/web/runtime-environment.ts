import {
  CONTENT_VERCEL_PROJECT_IDS,
  isContentSanityLaneAllowed,
  resolveContentEnvironment,
  type ContentEnvironment,
} from "../../lib/content/sanity-lane";

export type WebEnvironment = "development" | "web-uat" | "production" | "unknown";

export function resolveWebEnvironment(): WebEnvironment {
  const environment = resolveContentEnvironment();
  return environment === "development" || environment === "web-uat" || environment === "production"
    ? environment
    : "unknown";
}

export const WEB_ENVIRONMENT = resolveWebEnvironment();

export const IS_WEB_REVIEW_ENVIRONMENT =
  process.env.VERCEL_ENV === "preview" ||
  process.env.CCPUN_UAT_MODE === "1" ||
  WEB_ENVIRONMENT === "web-uat";

export const PRODUCTION_WEB_ANALYTICS_ENABLED =
  process.env.VERCEL_ENV === "production" &&
  WEB_ENVIRONMENT === "production" &&
  process.env.CCPUN_ENABLE_PRODUCTION_ANALYTICS === "1";

export function isWebSanityLaneAllowed(
  projectId: string | undefined,
  dataset: string | undefined,
  environment: ContentEnvironment = WEB_ENVIRONMENT,
): boolean {
  if (environment !== "development" && environment !== "web-uat" && environment !== "production") return false;
  return isContentSanityLaneAllowed(projectId, dataset, environment);
}

export function isWebDeploymentProject(): boolean {
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  return !projectId || projectId === CONTENT_VERCEL_PROJECT_IDS.web;
}

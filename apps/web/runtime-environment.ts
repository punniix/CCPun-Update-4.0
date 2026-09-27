import {
  isContentSanityLaneAllowed,
  resolveContentEnvironment,
  type ContentEnvironment,
} from "../../lib/content/sanity-lane";
import {
  resolveDeploymentIdentity,
  type DeploymentIdentity,
} from "../../lib/runtime/deployment-identity";

export type WebEnvironment = "development" | "web-uat" | "production" | "unknown";

export function resolveWebEnvironment(): WebEnvironment {
  const environment = resolveContentEnvironment();
  return environment === "development" || environment === "web-uat" || environment === "production"
    ? environment
    : "unknown";
}

export const WEB_ENVIRONMENT = resolveWebEnvironment();
export const WEB_DEPLOYMENT_IDENTITY = resolveDeploymentIdentity(process.env, "web");

export const IS_WEB_REVIEW_ENVIRONMENT =
  process.env.CCPUN_UAT_MODE === "1" ||
  WEB_ENVIRONMENT === "web-uat";

export const PRODUCTION_WEB_ANALYTICS_ENABLED =
  WEB_DEPLOYMENT_IDENTITY.valid &&
  WEB_DEPLOYMENT_IDENTITY.role === "web" &&
  WEB_DEPLOYMENT_IDENTITY.environment === "production" &&
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
  return WEB_DEPLOYMENT_IDENTITY.valid && WEB_DEPLOYMENT_IDENTITY.role === "web";
}

export function shouldBlockWebIndexing(input: {
  environment?: WebEnvironment;
  deployment?: DeploymentIdentity;
  uatMode?: string;
} = {}): boolean {
  const environment = input.environment ?? WEB_ENVIRONMENT;
  const deployment = input.deployment ?? WEB_DEPLOYMENT_IDENTITY;
  const uatMode = input.uatMode ?? process.env.CCPUN_UAT_MODE;
  return (
    uatMode === "1"
    || environment !== "production"
    || !deployment.valid
    || deployment.role !== "web"
    || deployment.environment !== "production"
  );
}

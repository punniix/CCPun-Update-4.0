import {
  resolveDeploymentIdentity,
} from "../runtime/deployment-identity";
import { getDeploymentLaneByEnvironment } from "../runtime/deployment-contract";

// Temporary test/consumer bridge, removed when the paired Admin graph retires its imports.
export { CCPUN_VERCEL_PROJECT_IDS as CONTENT_VERCEL_PROJECT_IDS } from "../runtime/deployment-identity";

export const CONTENT_ENVIRONMENTS = [
  "development",
  "web-uat",
  "local-uat",
  "local-production",
  "lab",
  "uat",
  "admin-uat",
  "production-admin",
  "production",
  "unknown",
] as const;

export type ContentEnvironment = (typeof CONTENT_ENVIRONMENTS)[number];

const CONTENT_ENVIRONMENT_SET = new Set<ContentEnvironment>(CONTENT_ENVIRONMENTS);
const SANITY_LANE_BY_ENVIRONMENT: Partial<Record<ContentEnvironment, { projectId: string; dataset: "uat" | "production" }>> = {
  development: { projectId: "ccb9lnw5", dataset: "uat" },
  "web-uat": { projectId: "ccb9lnw5", dataset: "uat" },
  "local-uat": { projectId: "ccb9lnw5", dataset: "uat" },
  "local-production": { projectId: "kyfxgjnq", dataset: "production" },
  "admin-uat": { projectId: "ccb9lnw5", dataset: "uat" },
  "production-admin": { projectId: "kyfxgjnq", dataset: "production" },
  production: { projectId: "kyfxgjnq", dataset: "production" },
};

export function parseContentEnvironment(value: string | undefined): ContentEnvironment {
  const normalized = value?.trim().toLowerCase();
  return normalized && CONTENT_ENVIRONMENT_SET.has(normalized as ContentEnvironment)
    ? normalized as ContentEnvironment
    : "unknown";
}

export function resolveContentEnvironment(
  explicitValue = process.env.CCPUN_APP_ENV,
  vercelEnvironment = process.env.VERCEL_ENV,
  deploymentProjectId = process.env.VERCEL_PROJECT_ID,
): ContentEnvironment {
  if (explicitValue?.trim()) return parseContentEnvironment(explicitValue);

  // Retired platform values never infer a current content lane.
  if (vercelEnvironment?.trim() || deploymentProjectId?.trim()) return "unknown";
  return "development";
}

export function isContentDeploymentAllowed(
  environment: ContentEnvironment,
  deploymentProjectId = process.env.VERCEL_PROJECT_ID?.trim(),
  variables: Record<string, string | undefined> = process.env,
): boolean {
  const provider = variables.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase();

  if (provider === "hostinger") {
    const role = environment === "web-uat" || environment === "production"
      ? "web"
      : environment === "admin-uat" || environment === "production-admin"
        ? "admin"
        : null;
    if (!role || deploymentProjectId) return false;
    const identity = resolveDeploymentIdentity({
      ...variables,
      CCPUN_APP_ENV: environment,
      VERCEL_PROJECT_ID: undefined,
    }, role);
    return identity.valid
      && identity.provider === "hostinger"
      && identity.role === role
      && identity.environment === environment;
  }

  if (provider === "local") {
    return !deploymentProjectId
      && (environment === "development" || environment === "local-uat" || environment === "local-production");
  }

  if (provider) return false;
  return !deploymentProjectId
    && (environment === "development" || environment === "local-uat" || environment === "local-production");
}

export function isContentSanityLaneAllowed(
  projectId: string | undefined,
  dataset: string | undefined,
  environment = resolveContentEnvironment(),
  deploymentProjectId = process.env.VERCEL_PROJECT_ID?.trim(),
  variables: Record<string, string | undefined> = process.env,
): boolean {
  const deployedLane = getDeploymentLaneByEnvironment(environment);
  const expected = deployedLane
    ? { projectId: deployedLane.sanityProjectId, dataset: deployedLane.sanityDataset }
    : SANITY_LANE_BY_ENVIRONMENT[environment];
  return Boolean(
    expected &&
    projectId?.trim() === expected.projectId &&
    dataset?.trim() === expected.dataset &&
    isContentDeploymentAllowed(environment, deploymentProjectId, variables),
  );
}

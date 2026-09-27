import {
  CCPUN_VERCEL_PROJECT_IDS,
  resolveDeploymentIdentity,
} from "../runtime/deployment-identity";

export const CONTENT_VERCEL_PROJECT_IDS = CCPUN_VERCEL_PROJECT_IDS;

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

  const vercel = vercelEnvironment?.trim().toLowerCase();
  const projectId = deploymentProjectId?.trim();
  if (vercel === "production" && projectId === CONTENT_VERCEL_PROJECT_IDS.web) return "production";
  if (vercel === "production" && projectId === CONTENT_VERCEL_PROJECT_IDS.admin) return "production-admin";
  if (vercel === "preview" && projectId === CONTENT_VERCEL_PROJECT_IDS.web) return "web-uat";
  if (vercel === "preview" && projectId === CONTENT_VERCEL_PROJECT_IDS.admin) return "admin-uat";
  if (!projectId) return "development";
  return "unknown";
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

  if (provider && provider !== "vercel") return false;
  if (provider === "vercel" && !deploymentProjectId) return false;

  switch (environment) {
    case "development":
      return !deploymentProjectId || deploymentProjectId === CONTENT_VERCEL_PROJECT_IDS.web;
    case "web-uat":
    case "production":
      return deploymentProjectId === CONTENT_VERCEL_PROJECT_IDS.web;
    case "local-uat":
    case "local-production":
      return !deploymentProjectId;
    case "admin-uat":
    case "production-admin":
      return deploymentProjectId === CONTENT_VERCEL_PROJECT_IDS.admin;
    default:
      return false;
  }
}

export function isContentSanityLaneAllowed(
  projectId: string | undefined,
  dataset: string | undefined,
  environment = resolveContentEnvironment(),
  deploymentProjectId = process.env.VERCEL_PROJECT_ID?.trim(),
  variables: Record<string, string | undefined> = process.env,
): boolean {
  const expected = SANITY_LANE_BY_ENVIRONMENT[environment];
  return Boolean(
    expected &&
    projectId?.trim() === expected.projectId &&
    dataset?.trim() === expected.dataset &&
    isContentDeploymentAllowed(environment, deploymentProjectId, variables),
  );
}

import deploymentContract from "@/lib/runtime/deployment-lanes.json";

export type DeploymentLaneId = keyof typeof deploymentContract.lanes;
export type DeploymentLane = (typeof deploymentContract.lanes)[DeploymentLaneId];

export const DEPLOYMENT_CONTRACT = deploymentContract;
export const DEPLOYMENT_LANES = deploymentContract.lanes;

const DEPLOYED_ENVIRONMENTS = new Set(
  Object.values(DEPLOYMENT_LANES).map((lane) => lane.environment),
);

export function getDeploymentLaneByEnvironment(environment: string | undefined): DeploymentLane | null {
  if (!environment) return null;
  return Object.values(DEPLOYMENT_LANES).find((lane) => lane.environment === environment) ?? null;
}

export function getDeploymentLaneByDomain(domain: string | undefined): DeploymentLane | null {
  const normalized = domain?.trim().toLowerCase().replace(/:\d+$/, "");
  if (!normalized) return null;
  return Object.values(DEPLOYMENT_LANES).find((lane) => lane.domain === normalized) ?? null;
}

export function isDeployedEnvironment(environment: string | undefined): boolean {
  return Boolean(environment && DEPLOYED_ENVIRONMENTS.has(environment));
}

type Variables = Record<string, string | undefined>;

function value(variables: Variables, key: string) {
  return variables[key]?.trim() || "";
}

export function deploymentContractFailures(
  lane: DeploymentLane,
  variables: Variables = process.env,
): string[] {
  const failures: string[] = [];
  const provider = value(variables, "CCPUN_DEPLOYMENT_PROVIDER");
  const appEnv = value(variables, "CCPUN_APP_ENV");
  const publicEnv = value(variables, "NEXT_PUBLIC_CCPUN_APP_ENV");
  const sanityProject = value(variables, "NEXT_PUBLIC_SANITY_PROJECT_ID");
  const sanityDataset = value(variables, "NEXT_PUBLIC_SANITY_DATASET");

  if (appEnv !== lane.environment) failures.push("CCPUN_APP_ENV must be " + lane.environment);
  if (publicEnv !== lane.publicEnvironment) failures.push("NEXT_PUBLIC_CCPUN_APP_ENV must be " + lane.publicEnvironment);
  if (sanityProject !== lane.sanityProjectId) failures.push("NEXT_PUBLIC_SANITY_PROJECT_ID must be " + lane.sanityProjectId);
  if (sanityDataset !== lane.sanityDataset) failures.push("NEXT_PUBLIC_SANITY_DATASET must be " + lane.sanityDataset);
  if (value(variables, "CCPUN_UAT_MODE") !== lane.uatMode) failures.push("CCPUN_UAT_MODE must be " + lane.uatMode);
  if (value(variables, "CCPUN_ENABLE_PRODUCTION_ANALYTICS") !== lane.productionAnalytics) {
    failures.push("CCPUN_ENABLE_PRODUCTION_ANALYTICS must be " + lane.productionAnalytics);
  }

  if (lane.provider === "hostinger") {
    if (provider !== "hostinger") failures.push("CCPUN_DEPLOYMENT_PROVIDER must be hostinger");
    if (value(variables, "CCPUN_DEPLOYMENT_ROLE") !== lane.role) failures.push("CCPUN_DEPLOYMENT_ROLE must be " + lane.role);
    if (value(variables, "VERCEL_PROJECT_ID")) failures.push("VERCEL_PROJECT_ID must be unset on Hostinger");
  } else if (lane.provider === "vercel") {
    if (provider && provider !== "vercel") failures.push("CCPUN_DEPLOYMENT_PROVIDER must be vercel when explicitly set");
    if ("vercelProjectId" in lane && value(variables, "VERCEL_PROJECT_ID") !== lane.vercelProjectId) {
      failures.push("VERCEL_PROJECT_ID must be " + lane.vercelProjectId);
    }
    const expectedVercelEnv = lane.environment === "production-admin" ? "production" : "preview";
    if (value(variables, "VERCEL_ENV") !== expectedVercelEnv) failures.push("VERCEL_ENV must be " + expectedVercelEnv);
  }

  return failures;
}

export function assertDeploymentContract(
  lane: DeploymentLane,
  variables: Variables = process.env,
): void {
  const failures = deploymentContractFailures(lane, variables);
  if (failures.length) {
    throw new Error("Deployment contract violation for " + lane.domain + ": " + failures.join("; "));
  }
}

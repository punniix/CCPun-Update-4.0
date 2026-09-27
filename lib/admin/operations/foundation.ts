import { CCPUN_VERCEL_PROJECT_IDS } from "../environment";
import { resolveDeploymentIdentity } from "../../runtime/deployment-identity";

export const ADMIN_OPERATIONS_UAT_MIGRATION_VERSION = "20260830_website_42_admin_operations_v1";
export const ADMIN_OPERATIONS_UAT_MIGRATION_CHECKSUM = "sha256:51f16b563368488362408f323f95863ecf8f277b6b725b96189fedddf1300e4f";
export const ADMIN_OPERATIONS_PRODUCTION_MIGRATION_VERSION = "20260913_admin_operations_production_v1";
export const ADMIN_OPERATIONS_PRODUCTION_MIGRATION_CHECKSUM = "sha256:2bb2d5ad44e492b56d91bd604a49830f0fd615d90b0767d8b8ef9807ee4fcd4d";

export const ADMIN_OPERATIONS_LANES = {
  uat: {
    projectId: "young-term-47483330",
    branchId: "br-crimson-mouse-az7ajkv8",
    endpointId: "ep-mute-frost-aztvz394",
    hostSuffix: "c-3.ap-southeast-1.aws.neon.tech",
    database: "neondb",
    runtimeRole: "ccpun_admin_runtime",
    migrationVersion: ADMIN_OPERATIONS_UAT_MIGRATION_VERSION,
    migrationChecksum: ADMIN_OPERATIONS_UAT_MIGRATION_CHECKSUM,
  },
  production: {
    projectId: "lively-bar-43618798",
    branchId: "br-long-resonance-b3ys5xrv",
    endpointId: "ep-broad-butterfly-b3ro7u8w",
    hostSuffix: "c-4.ap-southeast-1.aws.neon.tech",
    database: "neondb",
    runtimeRole: "ccpun_admin_runtime",
    migrationVersion: ADMIN_OPERATIONS_PRODUCTION_MIGRATION_VERSION,
    migrationChecksum: ADMIN_OPERATIONS_PRODUCTION_MIGRATION_CHECKSUM,
  },
} as const;

export type AdminOperationsLane = keyof typeof ADMIN_OPERATIONS_LANES;
export type AdminOperationsIdentity = (typeof ADMIN_OPERATIONS_LANES)[AdminOperationsLane];

function defaultLane(variables: Record<string, string | undefined> = process.env): AdminOperationsLane {
  return variables.CCPUN_APP_ENV?.trim() === "production-admin" ? "production" : "uat";
}

// Backwards-compatible exports used by the database client and UAT-only migration tooling.
// In Production Admin these resolve to the production lane at module load; elsewhere they stay UAT-pinned.
export const ADMIN_OPERATIONS_IDENTITY = ADMIN_OPERATIONS_LANES[defaultLane()];
export const ADMIN_OPERATIONS_MIGRATION_VERSION = ADMIN_OPERATIONS_IDENTITY.migrationVersion;
export const ADMIN_OPERATIONS_MIGRATION_CHECKSUM = ADMIN_OPERATIONS_IDENTITY.migrationChecksum;

export type AdminOperationsRuntimeIdentity = {
  environment: string | undefined;
  projectId: string | undefined;
  branchId: string | undefined;
  database: string | undefined;
  connectionString: string | undefined;
  deploymentProvider?: string | undefined;
  deploymentRole?: string | undefined;
  releaseId?: string | undefined;
  gitSha?: string | undefined;
  vercelEnvironment?: string | undefined;
  gitBranch?: string | undefined;
  vercelProjectId?: string | undefined;
  productionAdminProjectId?: string | undefined;
};

export type ResolvedAdminOperationsRuntime = {
  lane: AdminOperationsLane;
  environment: "admin-uat" | "local-uat" | "production-admin";
  identity: AdminOperationsIdentity;
};

export function resolveAdminOperationsRuntimeIdentity(input: AdminOperationsRuntimeIdentity): ResolvedAdminOperationsRuntime | null {
  const environment = input.environment?.trim();
  const lane: AdminOperationsLane | null = environment === "production-admin"
    ? "production"
    : environment === "admin-uat" || environment === "local-uat"
      ? "uat"
      : null;
  if (!lane || !input.connectionString) return null;

  const vercelEnvironment = input.vercelEnvironment ?? process.env.VERCEL_ENV?.trim();
  const gitBranch = input.gitBranch ?? process.env.CCPUN_GIT_REF?.trim() ?? process.env.VERCEL_GIT_COMMIT_REF?.trim();
  const vercelProjectId = input.vercelProjectId ?? process.env.VERCEL_PROJECT_ID?.trim();
  const productionAdminProjectId = input.productionAdminProjectId ?? process.env.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID?.trim();
  const deployment = resolveDeploymentIdentity({
    CCPUN_APP_ENV: environment,
    CCPUN_DEPLOYMENT_PROVIDER: input.deploymentProvider ?? process.env.CCPUN_DEPLOYMENT_PROVIDER,
    CCPUN_DEPLOYMENT_ROLE: input.deploymentRole ?? process.env.CCPUN_DEPLOYMENT_ROLE,
    CCPUN_GIT_REF: gitBranch,
    CCPUN_GIT_SHA: input.gitSha ?? process.env.CCPUN_GIT_SHA,
    CCPUN_RELEASE_ID: input.releaseId ?? process.env.CCPUN_RELEASE_ID,
    VERCEL_ENV: vercelEnvironment,
    VERCEL_PROJECT_ID: vercelProjectId,
    VERCEL_GIT_COMMIT_REF: input.gitBranch ?? process.env.VERCEL_GIT_COMMIT_REF,
    VERCEL_GIT_COMMIT_SHA: input.gitSha ?? process.env.VERCEL_GIT_COMMIT_SHA,
  }, "admin");
  if (!deployment.valid || deployment.environment !== environment) return null;

  if (lane === "production") {
    if (deployment.provider === "local" || deployment.gitRef !== "v4-production") return null;
    if (deployment.provider === "vercel") {
      if (vercelEnvironment !== "production") return null;
      if (vercelProjectId !== CCPUN_VERCEL_PROJECT_IDS.adminProduction) return null;
      if (productionAdminProjectId && productionAdminProjectId !== vercelProjectId) return null;
    }
  } else if (environment === "admin-uat" && deployment.provider === "vercel") {
    if (vercelEnvironment !== "preview" || vercelProjectId !== CCPUN_VERCEL_PROJECT_IDS.adminProduction) return null;
  } else if (environment === "local-uat" && deployment.provider !== "local") {
    return null;
  }

  const identity = ADMIN_OPERATIONS_LANES[lane];
  if (input.projectId !== identity.projectId || input.branchId !== identity.branchId || input.database !== identity.database) return null;

  try {
    const url = new URL(input.connectionString);
    const allowedHosts = new Set([
      `${identity.endpointId}.${identity.hostSuffix}`,
      `${identity.endpointId}-pooler.${identity.hostSuffix}`,
    ]);
    if (url.protocol !== "postgresql:" || !allowedHosts.has(url.hostname) || url.port || url.hash) return null;
    if (decodeURIComponent(url.username) !== identity.runtimeRole || !url.password) return null;
    if (decodeURIComponent(url.pathname.slice(1)) !== identity.database || url.searchParams.get("sslmode") !== "require") return null;
    return { lane, environment: environment as ResolvedAdminOperationsRuntime["environment"], identity };
  } catch {
    return null;
  }
}

export function isAdminOperationsRuntimeIdentityValid(input: AdminOperationsRuntimeIdentity) {
  return resolveAdminOperationsRuntimeIdentity(input) !== null;
}

export function adminOperationsRuntimeInputFromEnvironment(
  variables: Record<string, string | undefined> = process.env,
): AdminOperationsRuntimeIdentity {
  return {
    environment: variables.CCPUN_APP_ENV?.trim(),
    projectId: variables.CCPUN_NEON_PROJECT_ID?.trim(),
    branchId: variables.CCPUN_NEON_BRANCH_ID?.trim(),
    database: variables.CCPUN_NEON_DATABASE?.trim(),
    connectionString: variables.CCPUN_ADMIN_DATABASE_URL?.trim(),
    deploymentProvider: variables.CCPUN_DEPLOYMENT_PROVIDER?.trim(),
    deploymentRole: variables.CCPUN_DEPLOYMENT_ROLE?.trim(),
    releaseId: variables.CCPUN_RELEASE_ID?.trim(),
    gitSha: variables.CCPUN_GIT_SHA?.trim() || variables.VERCEL_GIT_COMMIT_SHA?.trim(),
    vercelEnvironment: variables.VERCEL_ENV?.trim(),
    gitBranch: variables.CCPUN_GIT_REF?.trim() || variables.VERCEL_GIT_COMMIT_REF?.trim(),
    vercelProjectId: variables.VERCEL_PROJECT_ID?.trim(),
    productionAdminProjectId: variables.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID?.trim(),
  };
}

export function getAdminOperationsRuntimeStatus(
  variables: Record<string, string | undefined> = process.env,
) {
  const input = adminOperationsRuntimeInputFromEnvironment(variables);
  const resolved = resolveAdminOperationsRuntimeIdentity(input);
  const deployment = resolveDeploymentIdentity(variables, "admin");
  return {
    environment: input.environment ?? null,
    provider: deployment.provider,
    deploymentRole: deployment.role,
    releaseId: deployment.releaseId,
    configured: Boolean(input.connectionString),
    identityValid: Boolean(resolved),
    lane: resolved?.lane ?? null,
    projectId: input.projectId ?? null,
    branchId: input.branchId ?? null,
    database: input.database ?? null,
    migrationVersion: resolved?.identity.migrationVersion ?? null,
  };
}

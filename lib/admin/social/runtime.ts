import {
  CCPUN_VERCEL_PROJECT_IDS,
  parseAdminEnvironment,
  type AdminEnvironment,
} from "../environment";
import {
  resolveDeploymentIdentity,
  type DeploymentProvider,
} from "../../runtime/deployment-identity";

export const SOCIAL_UAT_SANITY_PROJECT_ID = "ccb9lnw5";
export const SOCIAL_UAT_SANITY_DATASET = "uat";
export const SOCIAL_PRODUCTION_SANITY_PROJECT_ID = "kyfxgjnq";
export const SOCIAL_PRODUCTION_SANITY_DATASET = "production";
export const SOCIAL_PRODUCTION_BRANCH = "v4-production";
export const SOCIAL_RUNTIME_DATABASE_ROLE = "ccpun_social_runtime";
export const SOCIAL_ANALYTICS_MIGRATION_VERSION = "20260831_website_42_social_analytics_ingestion";
export const SOCIAL_ANALYTICS_MIGRATION_CHECKSUM = "sha256:ea2ba4d0a028569cbc53cc2fe7cdcdb0ecfa1df3ae777ef7baadf9aa08b9950c";
export const SOCIAL_PRODUCTION_ANALYTICS_MIGRATION_VERSION = "20260901_website_42_social_analytics_ingestion_production";
export const SOCIAL_PRODUCTION_ANALYTICS_MIGRATION_CHECKSUM = "sha256:ef14d2a6c6c86ce16610fb63d73e46e647fc60f3233e1c20b0489b422899e76e";
export const SOCIAL_PROVIDER_HISTORY_MIGRATION_VERSION = "20260901_website_42_social_provider_native_history";
export const SOCIAL_PROVIDER_HISTORY_MIGRATION_CHECKSUM = "sha256:cc4c2516ad261983d3d3997796711fb9b0290afe8625ab82fc002f4536bc549c";

// Historical feature branches remain accepted only for backwards compatibility.
// New Control Plane work uses the `admin/` prefix so UAT does not require a new
// allowlist entry for every feature while unrelated/Web branches stay denied.
export const SOCIAL_UAT_FOUNDATION_BRANCH = "codex/website-42-social-media-integration-20260829";
export const SOCIAL_UAT_OPERATIONS_BRANCH = SOCIAL_UAT_FOUNDATION_BRANCH;
export const SOCIAL_UAT_PROVIDER_BRANCH = "codex/website-42-social-provider-readonly-20260831";
export const SOCIAL_UAT_ANALYTICS_BRANCH = "codex/website-42-social-analytics-ingestion-20260831";
export const SOCIAL_UAT_RUNTIME_BRANCHES = [
  SOCIAL_UAT_FOUNDATION_BRANCH,
  SOCIAL_UAT_PROVIDER_BRANCH,
  SOCIAL_UAT_ANALYTICS_BRANCH,
] as const;

export const SOCIAL_UAT_NEON_IDENTITY = {
  projectId: "young-term-47483330",
  branchId: "br-crimson-mouse-az7ajkv8",
  endpointId: "ep-mute-frost-aztvz394",
  database: "neondb",
  role: SOCIAL_RUNTIME_DATABASE_ROLE,
} as const;

export type SocialNeonIdentity = {
  projectId: string;
  branchId: string;
  endpointId: string;
  database: string;
  role: string;
};

export type SocialRuntimeDescriptor = {
  lane: "uat" | "production";
  environment: "admin-uat" | "production-admin";
  provider: DeploymentProvider;
  deploymentRole: "admin";
  vercelEnvironment?: "preview" | "production";
  projectId: string | null;
  gitBranch: string;
  sanityProjectId: string;
  sanityDataset: "uat" | "production";
  neonIdentity: SocialNeonIdentity;
};

export type SocialRuntimeInput = {
  environment: AdminEnvironment;
  deploymentProvider?: string;
  deploymentRole?: string;
  releaseId?: string;
  gitSha?: string;
  vercelEnvironment?: string;
  projectId?: string;
  productionAdminProjectId?: string;
  gitBranch?: string;
  sanityProjectId?: string;
  sanityDataset?: string;
  connectionString?: string;
  neonProjectId?: string;
  neonBranchId?: string;
  neonEndpointId?: string;
  neonDatabase?: string;
};

export type SocialRuntimeRequirements = {
  /** Historical branches accepted for a legacy module. New feature work should use `admin/*`. */
  uatBranches?: readonly string[];
  requireUatNeon?: boolean;
};

export function socialAnalyticsMigrationForLane(lane: "uat" | "production") {
  return lane === "production"
    ? { version: SOCIAL_PRODUCTION_ANALYTICS_MIGRATION_VERSION, checksum: SOCIAL_PRODUCTION_ANALYTICS_MIGRATION_CHECKSUM }
    : { version: SOCIAL_ANALYTICS_MIGRATION_VERSION, checksum: SOCIAL_ANALYTICS_MIGRATION_CHECKSUM };
}

function trimmed(value: string | undefined) {
  const result = value?.trim();
  return result || undefined;
}

function isBoundedIdentity(value: string | undefined, prefix?: string) {
  return Boolean(
    value
    && value.length <= 120
    && /^[A-Za-z0-9_-]+$/.test(value)
    && (!prefix || value.startsWith(prefix)),
  );
}

function isSafeUatGitBranch(branch: string | undefined, compatibilityBranches: readonly string[] = []) {
  return Boolean(
    branch
    && branch !== SOCIAL_PRODUCTION_BRANCH
    && (branch.startsWith("admin/") || compatibilityBranches.includes(branch)),
  );
}

export function getConfiguredProductionSocialNeonIdentity(
  input: Pick<SocialRuntimeInput, "neonProjectId" | "neonBranchId" | "neonEndpointId" | "neonDatabase">,
): SocialNeonIdentity | null {
  const projectId = trimmed(input.neonProjectId);
  const branchId = trimmed(input.neonBranchId);
  const endpointId = trimmed(input.neonEndpointId);
  const database = trimmed(input.neonDatabase);
  if (!isBoundedIdentity(projectId)
    || !isBoundedIdentity(branchId, "br-")
    || !isBoundedIdentity(endpointId, "ep-")
    || !isBoundedIdentity(database)) {
    return null;
  }
  return {
    projectId: projectId!,
    branchId: branchId!,
    endpointId: endpointId!,
    database: database!,
    role: SOCIAL_RUNTIME_DATABASE_ROLE,
  };
}

export function isExactSocialNeonConnectionString(
  value: string | undefined,
  identity: SocialNeonIdentity,
) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const endpointHost = `${identity.endpointId}.`;
    const poolerHost = `${identity.endpointId}-pooler.`;
    return url.protocol === "postgresql:"
      && decodeURIComponent(url.username) === identity.role
      && Boolean(url.password)
      && decodeURIComponent(url.pathname.slice(1)) === identity.database
      && url.hostname.endsWith(".neon.tech")
      && (url.hostname.startsWith(endpointHost) || url.hostname.startsWith(poolerHost));
  } catch {
    return false;
  }
}

export function resolveSocialRuntimeDescriptor(
  input: SocialRuntimeInput,
  requirements: SocialRuntimeRequirements = {},
): SocialRuntimeDescriptor | null {
  const projectId = trimmed(input.projectId);
  const productionAdminProjectId = trimmed(input.productionAdminProjectId);
  const gitBranch = trimmed(input.gitBranch);
  const sanityProjectId = trimmed(input.sanityProjectId);
  const sanityDataset = trimmed(input.sanityDataset);
  const vercelEnvironment = trimmed(input.vercelEnvironment);
  const deployment = resolveDeploymentIdentity({
    CCPUN_APP_ENV: input.environment,
    CCPUN_DEPLOYMENT_PROVIDER: trimmed(input.deploymentProvider),
    CCPUN_DEPLOYMENT_ROLE: trimmed(input.deploymentRole),
    CCPUN_GIT_REF: gitBranch,
    CCPUN_GIT_SHA: trimmed(input.gitSha),
    CCPUN_RELEASE_ID: trimmed(input.releaseId),
    VERCEL_ENV: vercelEnvironment,
    VERCEL_PROJECT_ID: projectId,
    VERCEL_GIT_COMMIT_REF: gitBranch,
    VERCEL_GIT_COMMIT_SHA: trimmed(input.gitSha),
  }, "admin");
  if (!deployment.valid || deployment.environment !== input.environment) return null;

  if (input.environment === "admin-uat") {
    if ((deployment.provider === "vercel" && (
        projectId !== CCPUN_VERCEL_PROJECT_IDS.adminProduction
        || (productionAdminProjectId && productionAdminProjectId !== CCPUN_VERCEL_PROJECT_IDS.adminProduction)
        || (vercelEnvironment && vercelEnvironment !== "preview")
      ))
      || !isSafeUatGitBranch(gitBranch, requirements.uatBranches)
      || sanityProjectId !== SOCIAL_UAT_SANITY_PROJECT_ID
      || sanityDataset !== SOCIAL_UAT_SANITY_DATASET
      || (requirements.requireUatNeon
        && !isExactSocialNeonConnectionString(trimmed(input.connectionString), SOCIAL_UAT_NEON_IDENTITY))) {
      return null;
    }
    return {
      lane: "uat",
      environment: "admin-uat",
      provider: deployment.provider,
      deploymentRole: "admin",
      ...(deployment.provider === "vercel" ? { vercelEnvironment: "preview" as const } : {}),
      projectId: deployment.projectId,
      gitBranch: gitBranch!,
      sanityProjectId: SOCIAL_UAT_SANITY_PROJECT_ID,
      sanityDataset: SOCIAL_UAT_SANITY_DATASET,
      neonIdentity: SOCIAL_UAT_NEON_IDENTITY,
    };
  }

  if (input.environment !== "production-admin"
    || deployment.provider === "local"
    || gitBranch !== SOCIAL_PRODUCTION_BRANCH
    || (deployment.provider === "vercel" && (
      vercelEnvironment !== "production"
      || projectId !== CCPUN_VERCEL_PROJECT_IDS.adminProduction
      || productionAdminProjectId !== CCPUN_VERCEL_PROJECT_IDS.adminProduction
    ))
    || sanityProjectId !== SOCIAL_PRODUCTION_SANITY_PROJECT_ID
    || sanityDataset !== SOCIAL_PRODUCTION_SANITY_DATASET) {
    return null;
  }

  const neonIdentity = getConfiguredProductionSocialNeonIdentity(input);
  if (!neonIdentity || !isExactSocialNeonConnectionString(trimmed(input.connectionString), neonIdentity)) return null;
  return {
    lane: "production",
    environment: "production-admin",
    provider: deployment.provider,
    deploymentRole: "admin",
    ...(deployment.provider === "vercel" ? { vercelEnvironment: "production" as const } : {}),
    projectId: deployment.projectId,
    gitBranch,
    sanityProjectId: SOCIAL_PRODUCTION_SANITY_PROJECT_ID,
    sanityDataset: SOCIAL_PRODUCTION_SANITY_DATASET,
    neonIdentity,
  };
}

export function socialRuntimeInputFromEnvironment(
  env: Record<string, string | undefined> = process.env,
): SocialRuntimeInput {
  return {
    environment: parseAdminEnvironment(env.CCPUN_APP_ENV),
    deploymentProvider: trimmed(env.CCPUN_DEPLOYMENT_PROVIDER),
    deploymentRole: trimmed(env.CCPUN_DEPLOYMENT_ROLE),
    releaseId: trimmed(env.CCPUN_RELEASE_ID),
    gitSha: trimmed(env.CCPUN_GIT_SHA) || trimmed(env.VERCEL_GIT_COMMIT_SHA),
    vercelEnvironment: trimmed(env.VERCEL_ENV),
    projectId: trimmed(env.VERCEL_PROJECT_ID) || trimmed(env.NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID),
    productionAdminProjectId: trimmed(env.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID)
      || trimmed(env.NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID),
    gitBranch: trimmed(env.CCPUN_GIT_REF) || trimmed(env.VERCEL_GIT_COMMIT_REF),
    sanityProjectId: trimmed(env.NEXT_PUBLIC_SANITY_PROJECT_ID),
    sanityDataset: trimmed(env.NEXT_PUBLIC_SANITY_DATASET),
    connectionString: trimmed(env.CCPUN_SOCIAL_DATABASE_URL),
    neonProjectId: trimmed(env.CCPUN_NEON_PROJECT_ID),
    neonBranchId: trimmed(env.CCPUN_NEON_BRANCH_ID),
    neonEndpointId: trimmed(env.CCPUN_NEON_ENDPOINT_ID),
    neonDatabase: trimmed(env.CCPUN_NEON_DATABASE),
  };
}

export function resolveSocialRuntime(
  env: Record<string, string | undefined> = process.env,
  requirements: SocialRuntimeRequirements = {},
) {
  return resolveSocialRuntimeDescriptor(socialRuntimeInputFromEnvironment(env), requirements);
}

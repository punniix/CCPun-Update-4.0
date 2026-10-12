export const CCPUN_VERCEL_PROJECT_IDS = {
  web: "prj_dxwjITkd0av5QiJQv2snUlIASUWu",
  admin: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
} as const;

export const DEPLOYMENT_PROVIDERS = ["hostinger", "local", "unknown"] as const;
export const DEPLOYMENT_ROLES = ["web", "admin", "unknown"] as const;
export const DEPLOYMENT_ENVIRONMENTS = [
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

export type DeploymentProvider = (typeof DEPLOYMENT_PROVIDERS)[number];
export type DeploymentRole = (typeof DEPLOYMENT_ROLES)[number];
export type DeploymentEnvironment = (typeof DEPLOYMENT_ENVIRONMENTS)[number];

export type DeploymentIdentity = {
  provider: DeploymentProvider;
  role: DeploymentRole;
  environment: DeploymentEnvironment;
  valid: boolean;
  reason: string | null;
  projectId: string | null;
  gitRef: string | null;
  gitSha: string | null;
  releaseId: string | null;
};

type Variables = Record<string, string | undefined>;

const ENVIRONMENTS = new Set<DeploymentEnvironment>(DEPLOYMENT_ENVIRONMENTS);

function trimmed(value: string | undefined) {
  return value?.trim() || undefined;
}

export function parseDeploymentEnvironment(value: string | undefined): DeploymentEnvironment {
  const normalized = trimmed(value)?.toLowerCase();
  return normalized && ENVIRONMENTS.has(normalized as DeploymentEnvironment)
    ? normalized as DeploymentEnvironment
    : "unknown";
}

function parseProvider(value: string | undefined): DeploymentProvider | undefined {
  const normalized = trimmed(value)?.toLowerCase();
  if (normalized === "hostinger" || normalized === "local") return normalized;
  return normalized ? "unknown" : undefined;
}

function parseRole(value: string | undefined): DeploymentRole | undefined {
  const normalized = trimmed(value)?.toLowerCase();
  if (normalized === "web" || normalized === "admin") return normalized;
  return normalized ? "unknown" : undefined;
}

function roleMatchesEnvironment(role: DeploymentRole, environment: DeploymentEnvironment) {
  if (role === "web") {
    return environment === "development"
      || environment === "web-uat"
      || environment === "local-uat"
      || environment === "local-production"
      || environment === "production";
  }
  if (role === "admin") {
    return environment === "development"
      || environment === "local-uat"
      || environment === "local-production"
      || environment === "admin-uat"
      || environment === "production-admin";
  }
  return false;
}

export function resolveDeploymentIdentity(
  variables: Variables = process.env,
  expectedRole?: Exclude<DeploymentRole, "unknown">,
): DeploymentIdentity {
  const explicitProvider = parseProvider(variables.CCPUN_DEPLOYMENT_PROVIDER);
  const explicitRole = parseRole(variables.CCPUN_DEPLOYMENT_ROLE);
  const projectId = trimmed(variables.VERCEL_PROJECT_ID);
  // Legacy platform metadata is rejection-only; it cannot supply trust or provenance.
  const retiredProviderMetadata = Object.entries(variables).some(([key, value]) => key.startsWith("VERCEL_") && trimmed(value));
  const retiredWorldTarget = ["vercel", "@workflow/world-vercel"].includes(trimmed(variables.WORKFLOW_TARGET_WORLD) ?? "");
  const provider: DeploymentProvider = retiredProviderMetadata || retiredWorldTarget ? "unknown" : explicitProvider ?? "local";

  let role: DeploymentRole = "unknown";
  if (provider === "hostinger") {
    role = explicitRole ?? "unknown";
  } else if (provider === "local") {
    role = explicitRole ?? expectedRole ?? "unknown";
  }

  if (explicitRole && role !== "unknown" && explicitRole !== role) {
    role = "unknown";
  }

  const explicitEnvironment = trimmed(variables.CCPUN_APP_ENV);
  const environment = explicitEnvironment
    ? parseDeploymentEnvironment(explicitEnvironment)
    : provider === "local"
      ? "development"
      : "unknown";

  const gitRef = trimmed(variables.CCPUN_GIT_REF) ?? null;
  const gitSha = trimmed(variables.CCPUN_GIT_SHA) ?? null;
  const releaseId = trimmed(variables.CCPUN_RELEASE_ID)
    ?? gitSha
    ?? null;

  let reason: string | null = null;

  if (provider === "unknown") reason = "provider-conflict";
  else if (role === "unknown") reason = "role-unknown";
  else if (expectedRole && role !== expectedRole) reason = "role-mismatch";
  else if (environment === "unknown") reason = "environment-unknown";
  else if (!roleMatchesEnvironment(role, environment)) reason = "environment-role-mismatch";

  if (!reason && provider === "hostinger") {
    if (!explicitProvider || explicitProvider !== "hostinger") reason = "hostinger-provider-not-explicit";
    else if (!explicitRole || explicitRole !== role) reason = "hostinger-role-not-explicit";
    else if (projectId) reason = "hostinger-vercel-project-conflict";
    else if (!explicitEnvironment) reason = "hostinger-environment-not-explicit";
    else if (!["web-uat", "admin-uat", "production", "production-admin"].includes(environment)) {
      reason = "hostinger-environment-unsupported";
    }
  }

  if (!reason && provider === "local" && projectId) reason = "local-vercel-project-conflict";

  return {
    provider,
    role,
    environment,
    valid: reason === null,
    reason,
    projectId: projectId ?? null,
    gitRef,
    gitSha,
    releaseId,
  };
}

export function isDeploymentIdentityAllowed(
  identity: DeploymentIdentity,
  role: Exclude<DeploymentRole, "unknown">,
  environment?: DeploymentEnvironment,
) {
  return identity.valid
    && identity.role === role
    && (!environment || identity.environment === environment);
}

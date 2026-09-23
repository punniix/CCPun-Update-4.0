export const ADMIN_ENVIRONMENTS = [
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

export type AdminEnvironment = (typeof ADMIN_ENVIRONMENTS)[number];

export const CCPUN_VERCEL_PROJECT_IDS = {
  web: "prj_dxwjITkd0av5QiJQv2snUlIASUWu",
  adminProduction: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
} as const;

const EXPLICIT_ENVIRONMENTS = new Set<AdminEnvironment>([
  "development",
  "web-uat",
  "local-uat",
  "local-production",
  "lab",
  "uat",
  "admin-uat",
  "production-admin",
  "production",
]);

const SANITY_DATASET_BY_ENVIRONMENT: Partial<Record<AdminEnvironment, "uat" | "production">> = {
  development: "uat",
  "web-uat": "uat",
  "local-uat": "uat",
  "local-production": "production",
  lab: "uat",
  uat: "uat",
  "admin-uat": "uat",
  "production-admin": "production",
  production: "production",
};

const SANITY_PROJECT_BY_ENVIRONMENT: Partial<Record<AdminEnvironment, string>> = {
  development: "ccb9lnw5",
  "web-uat": "ccb9lnw5",
  "local-uat": "ccb9lnw5",
  "local-production": "kyfxgjnq",
  lab: "ccb9lnw5",
  uat: "ccb9lnw5",
  "admin-uat": "ccb9lnw5",
  "production-admin": "kyfxgjnq",
  production: "kyfxgjnq",
};

function getDeploymentProjectId() {
  return (
    process.env.VERCEL_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID?.trim()
  );
}

function getProductionAdminProjectId() {
  return (
    process.env.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID?.trim()
  );
}

function getSanityProjectId() {
  return process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
}

export function isSanityProjectAllowed(
  projectId: string | undefined,
  environment = getAdminEnvironment(),
): boolean {
  const expectedProjectId = SANITY_PROJECT_BY_ENVIRONMENT[environment];
  return Boolean(projectId && expectedProjectId && projectId === expectedProjectId);
}

export function parseAdminEnvironment(value: string | undefined): AdminEnvironment {
  const explicit = value?.trim().toLowerCase();

  if (explicit && EXPLICIT_ENVIRONMENTS.has(explicit as AdminEnvironment)) {
    return explicit as AdminEnvironment;
  }

  return "unknown";
}

export function resolveAdminEnvironment(
  explicitValue: string | undefined,
  vercelEnvironment: string | undefined,
  deploymentProjectId: string | undefined,
): AdminEnvironment {
  const explicitEnvironment = parseAdminEnvironment(explicitValue);
  if (explicitValue?.trim()) return explicitEnvironment;

  const isAdminPreview =
    vercelEnvironment?.trim().toLowerCase() === "preview" &&
    deploymentProjectId?.trim() === CCPUN_VERCEL_PROJECT_IDS.adminProduction;

  return isAdminPreview ? "admin-uat" : "unknown";
}

export function getAdminEnvironment(): AdminEnvironment {
  return resolveAdminEnvironment(
    process.env.CCPUN_APP_ENV,
    process.env.VERCEL_ENV,
    process.env.VERCEL_PROJECT_ID,
  );
}

export function resolveSanityConfigEnvironment(
  publicValue: string | undefined,
  serverValue: string | undefined,
  serverRuntime: boolean,
): AdminEnvironment {
  const publicEnvironment = parseAdminEnvironment(publicValue);
  if (!serverRuntime) return publicEnvironment;

  const serverEnvironment = parseAdminEnvironment(serverValue);
  if (serverEnvironment === "unknown") return "unknown";
  if (publicEnvironment !== "unknown" && publicEnvironment !== serverEnvironment) return "unknown";
  return serverEnvironment;
}

export function isDeploymentProjectAllowed(
  environment: AdminEnvironment,
  deploymentProjectId = getDeploymentProjectId(),
  productionAdminProjectId = getProductionAdminProjectId(),
): boolean {
  switch (environment) {
    case "development":
      return !deploymentProjectId;
    case "web-uat":
      return deploymentProjectId === CCPUN_VERCEL_PROJECT_IDS.web;
    case "local-uat":
    case "local-production":
      return !deploymentProjectId;
    case "lab":
    case "uat":
      return false;
    case "admin-uat":
      return deploymentProjectId === CCPUN_VERCEL_PROJECT_IDS.adminProduction;
    case "production-admin":
      return Boolean(
        deploymentProjectId === CCPUN_VERCEL_PROJECT_IDS.adminProduction &&
        productionAdminProjectId === CCPUN_VERCEL_PROJECT_IDS.adminProduction,
      );
    case "production":
      return deploymentProjectId === CCPUN_VERCEL_PROJECT_IDS.web;
    default:
      return false;
  }
}

export function isAdminSurfaceAllowed(
  environment = getAdminEnvironment(),
  deploymentProjectId = getDeploymentProjectId(),
  productionAdminProjectId = getProductionAdminProjectId(),
): boolean {
  switch (environment) {
    case "development":
      return !deploymentProjectId;
    case "local-uat":
    case "local-production":
    case "admin-uat":
    case "production-admin":
      return isDeploymentProjectAllowed(environment, deploymentProjectId, productionAdminProjectId);
    case "lab":
    case "uat":
      return false;
    default:
      return false;
  }
}

export function isSanityLaneAllowed(
  dataset: string | undefined,
  environment = getAdminEnvironment(),
  deploymentProjectId = getDeploymentProjectId(),
  productionAdminProjectId = getProductionAdminProjectId(),
  sanityProjectId = getSanityProjectId(),
): boolean {
  const expectedDataset = SANITY_DATASET_BY_ENVIRONMENT[environment];
  return Boolean(
    dataset &&
    expectedDataset &&
    expectedDataset === dataset &&
    isSanityProjectAllowed(sanityProjectId, environment) &&
    isDeploymentProjectAllowed(environment, deploymentProjectId, productionAdminProjectId),
  );
}

export function isAdminMutationEnvironment(
  environment = getAdminEnvironment(),
  deploymentProjectId = getDeploymentProjectId(),
  productionAdminProjectId = getProductionAdminProjectId(),
): boolean {
  if (!isAdminSurfaceAllowed(environment, deploymentProjectId, productionAdminProjectId)) return false;

  return (
    environment === "development" ||
    environment === "local-uat" ||
    environment === "admin-uat" ||
    (environment === "local-production" && isLocalProductionDraftWriteEnabled(environment)) ||
    environment === "production-admin"
  );
}

export function isLocalProductionDraftWriteEnabled(
  environment = getAdminEnvironment(),
  value = typeof window === "undefined"
    ? process.env.CCPUN_LOCAL_PRODUCTION_DRAFT_WRITES
    : process.env.NEXT_PUBLIC_CCPUN_LOCAL_PRODUCTION_DRAFT_WRITES,
): boolean {
  return environment === "local-production" && value === "1";
}

export function isAdminReadDataPlaneAllowed(
  dataset: string | undefined,
  environment = getAdminEnvironment(),
  deploymentProjectId = getDeploymentProjectId(),
  productionAdminProjectId = getProductionAdminProjectId(),
  sanityProjectId = getSanityProjectId(),
): boolean {
  return (
    isAdminSurfaceAllowed(environment, deploymentProjectId, productionAdminProjectId) &&
    isSanityLaneAllowed(dataset, environment, deploymentProjectId, productionAdminProjectId, sanityProjectId)
  );
}

export function isAdminDataPlaneAllowed(
  dataset: string | undefined,
  environment = getAdminEnvironment(),
  deploymentProjectId = getDeploymentProjectId(),
  productionAdminProjectId = getProductionAdminProjectId(),
  sanityProjectId = getSanityProjectId(),
): boolean {
  return (
    isAdminMutationEnvironment(environment, deploymentProjectId, productionAdminProjectId) &&
    isSanityLaneAllowed(dataset, environment, deploymentProjectId, productionAdminProjectId, sanityProjectId)
  );
}

export function isStudioDataPlaneAllowed(
  dataset: string | undefined,
  environment = getAdminEnvironment(),
  deploymentProjectId = getDeploymentProjectId(),
  productionAdminProjectId = getProductionAdminProjectId(),
  sanityProjectId = getSanityProjectId(),
): boolean {
  if (environment === "local-production" && !isLocalProductionDraftWriteEnabled(environment)) return false;
  return (
    isAdminSurfaceAllowed(environment, deploymentProjectId, productionAdminProjectId) &&
    isSanityLaneAllowed(dataset, environment, deploymentProjectId, productionAdminProjectId, sanityProjectId)
  );
}

export function isProductionEnvironment(environment = getAdminEnvironment()): boolean {
  return environment === "production";
}

export function getEnvironmentLabel(environment = getAdminEnvironment()): string {
  switch (environment) {
    case "development":
      return "เครื่องนี้ · สำหรับพัฒนา";
    case "web-uat":
      return "เว็บไซต์ทดสอบ";
    case "local-uat":
      return "เครื่องนี้ · พื้นที่ทดสอบ";
    case "local-production":
      return "เครื่องนี้ · ฉบับร่างระบบจริง";
    case "lab":
      return "พื้นที่เดิม · ปิดใช้งาน";
    case "uat":
      return "พื้นที่ทดสอบเดิม · ปิดใช้งาน";
    case "admin-uat":
      return "ศูนย์จัดการ · พื้นที่ทดสอบ";
    case "production-admin":
      return "ศูนย์จัดการ · ระบบจริง";
    case "production":
      return "ระบบจริง";
    default:
      return "ยังระบุพื้นที่ไม่ได้";
  }
}

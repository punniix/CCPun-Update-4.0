// Build-time Web policy: runtime deployment identity retains its stricter sealed checks.
const WEB_VERCEL_PROJECT_ID = "prj_dxwjITkd0av5QiJQv2snUlIASUWu";

function parseWebEnvironment(value) {
    const normalized = value?.trim().toLowerCase();
    return normalized === "development" || normalized === "web-uat" || normalized === "production"
        ? normalized
        : "unknown";
}

/** @returns {"development" | "web-uat" | "production" | "unknown"} */
export function resolveWebEnvironment() {
    const explicit = process.env.CCPUN_APP_ENV?.trim();
    if (explicit)
        return parseWebEnvironment(explicit);
    const vercelEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();
    const deploymentProjectId = process.env.VERCEL_PROJECT_ID?.trim();
    if (vercelEnvironment === "production" && deploymentProjectId === WEB_VERCEL_PROJECT_ID)
        return "production";
    if (vercelEnvironment === "preview" && deploymentProjectId === WEB_VERCEL_PROJECT_ID)
        return "web-uat";
    if (!deploymentProjectId)
        return "development";
    return "unknown";
}

export function isWebSanityLaneAllowed(projectId, dataset, environment = resolveWebEnvironment()) {
    const expected = environment === "production"
        ? { projectId: "kyfxgjnq", dataset: "production" }
        : environment === "development" || environment === "web-uat"
            ? { projectId: "ccb9lnw5", dataset: "uat" }
            : null;
    if (!expected || projectId?.trim() !== expected.projectId || dataset?.trim() !== expected.dataset)
        return false;
    const provider = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase();
    const role = process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase();
    const deploymentProjectId = process.env.VERCEL_PROJECT_ID?.trim();
    if (provider === "hostinger")
        return role === "web" && !deploymentProjectId;
    if (provider === "local")
        return environment === "development" && !deploymentProjectId;
    if (provider && provider !== "vercel")
        return false;
    if (deploymentProjectId)
        return deploymentProjectId === WEB_VERCEL_PROJECT_ID;
    return environment === "development";
}

export const TAX_SLUG_MIGRATION = "/blog/personal-finance/personal-income-tax-calculation-2569";
export const WEB_REDIRECTS = [
  { prefix: TAX_SLUG_MIGRATION, destination: "/blog/personal-finance/personal-income-tax-calculation/" },
  { prefix: "/living-benefits", destination: "/ci-planning/" },
  { prefix: "/tools/fhc", destination: "/tools/financial-health-check/" },
  { prefix: "/financial-advisor", destination: "/" },
];

import {
  CONTENT_VERCEL_PROJECT_IDS,
  isContentSanityLaneAllowed,
  resolveContentEnvironment,
} from "./content/sanity-lane";

const APP_ENVIRONMENT = resolveContentEnvironment();
const DEPLOYMENT_PROJECT_ID = process.env.VERCEL_PROJECT_ID?.trim();
const PRODUCTION_ADMIN_PROJECT_ID = process.env.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID?.trim()
  || process.env.NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID?.trim();

export const IS_ADMIN_APPLICATION = ["local-uat", "local-production", "lab", "uat", "admin-uat", "production-admin"].includes(APP_ENVIRONMENT);

export const IS_REVIEW_ENVIRONMENT =
  process.env.VERCEL_ENV === "preview" ||
  process.env.CCPUN_UAT_MODE === "1" ||
  ["development", "local-uat", "local-production", "admin-uat", "production-admin"].includes(APP_ENVIRONMENT);

const ADMIN_PROJECT_ALLOWED =
  (APP_ENVIRONMENT === "development" && !DEPLOYMENT_PROJECT_ID) ||
  ((APP_ENVIRONMENT === "local-uat" || APP_ENVIRONMENT === "local-production") && !DEPLOYMENT_PROJECT_ID) ||
  (APP_ENVIRONMENT === "admin-uat" && DEPLOYMENT_PROJECT_ID === CONTENT_VERCEL_PROJECT_IDS.admin) ||
  (APP_ENVIRONMENT === "production-admin"
    && DEPLOYMENT_PROJECT_ID === CONTENT_VERCEL_PROJECT_IDS.admin
    && PRODUCTION_ADMIN_PROJECT_ID === CONTENT_VERCEL_PROJECT_IDS.admin);

function isAdminReadDataPlaneAllowed(dataset = process.env.NEXT_PUBLIC_SANITY_DATASET): boolean {
  return Boolean(
    IS_ADMIN_APPLICATION &&
    ADMIN_PROJECT_ALLOWED &&
    isContentSanityLaneAllowed(
      process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
      dataset,
      APP_ENVIRONMENT,
      DEPLOYMENT_PROJECT_ID,
    ),
  );
}

export const IS_DRAFT_PREVIEW_ALLOWED = isAdminReadDataPlaneAllowed();

export const PRODUCTION_ANALYTICS_ENABLED =
  process.env.VERCEL_ENV === "production" &&
  APP_ENVIRONMENT === "production" &&
  process.env.CCPUN_ENABLE_PRODUCTION_ANALYTICS === "1";

import "server-only";

// UAT-only until the owner approves a Production release.
export const INVESTMENT_ALLOCATION_ENABLED = ["web-uat", "local-uat"].includes(process.env.CCPUN_APP_ENV ?? "");

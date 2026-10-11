import { IS_REVIEW_ENVIRONMENT } from "./deployment-environment";
import { buildNextSecurityHeaders } from "./runtime/security-headers.mjs";
export { shouldEnforceHttps } from "./runtime/security-headers.mjs";

export const SECURITY_HEADERS = buildNextSecurityHeaders({
  isReviewEnvironment: IS_REVIEW_ENVIRONMENT,
  sanityProjectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "",
});
export const SECURITY_POLICY = SECURITY_HEADERS[0].value;

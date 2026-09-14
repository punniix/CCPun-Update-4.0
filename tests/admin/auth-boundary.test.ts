import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  getAdminGoogleOAuthCredentials,
  hasStrongAuthSecret,
  getLocalAdminCookieNamespace,
  getLocalAdminOrigin,
  isConfiguredAdminOrigin,
  isLocalAdminHost,
  isSafeExternalAuthorizationUrl,
  isSameOriginAdminMutation,
  isSecureAdminAuthUrl,
} from "../../lib/admin/auth-config";
import { isPublicInternetAddress } from "../../lib/admin/provider-network";
import { isVercelSsoLabTrustMode } from "../../lib/admin/lab-sso";
import {
  getConfiguredAdminRole,
  getAdminRoleForEmail,
  getVerifiedGoogleAdminRole,
  hasConfiguredAdminUsers,
  hasAdminPermission,
} from "../../lib/admin/rbac";

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

test("Vercel Lab perimeter never grants an in-application Admin identity", () => {
  process.env.CCPUN_APP_ENV = "lab";
  process.env.VERCEL_ENV = "preview";

  assert.equal(isVercelSsoLabTrustMode(), false);
});

test("review actions require explicit role permissions", () => {
  assert.equal(hasAdminPermission("owner", "social:read"), true);
  assert.equal(hasAdminPermission("viewer", "social:read"), false);
  assert.equal(hasAdminPermission("owner", "reviews:approve"), true);
  assert.equal(hasAdminPermission("owner", "draft:apply"), true);
  assert.equal(hasAdminPermission("viewer", "reviews:approve"), false);
  assert.equal(hasAdminPermission("viewer", "draft:apply"), false);
  assert.equal(hasAdminPermission("owner", "research:provider-query"), true);
  assert.equal(hasAdminPermission("editor", "research:provider-query"), false);
});

test("Google sign-in requires a verified allowlisted identity", () => {
  process.env.CCPUN_ADMIN_OWNER_EMAILS = "owner@example.com";

  assert.equal(
    getVerifiedGoogleAdminRole({
      provider: "google",
      email: "OWNER@example.com",
      emailVerified: true,
    }),
    "owner",
  );
  assert.equal(
    getVerifiedGoogleAdminRole({
      provider: "google",
      email: "owner@example.com",
      emailVerified: false,
    }),
    null,
  );
  assert.equal(
    getVerifiedGoogleAdminRole({
      provider: "github",
      email: "owner@example.com",
      emailVerified: true,
    }),
    null,
  );
  assert.equal(
    getVerifiedGoogleAdminRole({
      provider: "google",
      email: "unknown@example.com",
      emailVerified: true,
    }),
    null,
  );
});

test("Admin UAT supports an owner-only operating model", () => {
  process.env.CCPUN_ADMIN_OWNER_EMAILS = "owner@example.com";
  for (const key of [
    "CCPUN_ADMIN_EDITOR_EMAILS",
    "CCPUN_ADMIN_SEO_MANAGER_EMAILS",
    "CCPUN_ADMIN_REVIEWER_EMAILS",
    "CCPUN_ADMIN_ANALYST_EMAILS",
    "CCPUN_ADMIN_VIEWER_EMAILS",
  ]) delete process.env[key];

  assert.equal(hasConfiguredAdminUsers("admin-uat"), true);
  assert.equal(getVerifiedGoogleAdminRole({ provider: "google", email: "owner@example.com", emailVerified: true, environment: "admin-uat" }), "owner");
  assert.equal(getVerifiedGoogleAdminRole({ provider: "google", email: "other@example.com", emailVerified: true, environment: "admin-uat" }), null);
});

test("an email assigned to multiple Admin roles fails closed", () => {
  process.env.CCPUN_ADMIN_OWNER_EMAILS = "ambiguous@example.com";
  process.env.CCPUN_ADMIN_VIEWER_EMAILS = "ambiguous@example.com";

  assert.equal(getAdminRoleForEmail("ambiguous@example.com"), null);
  assert.equal(
    getVerifiedGoogleAdminRole({
      provider: "google",
      email: "ambiguous@example.com",
      emailVerified: true,
    }),
    null,
  );
});

test("Local Production accepts only the verified owner allowlist", () => {
  process.env.CCPUN_ADMIN_OWNER_EMAILS = "owner@example.com";
  process.env.CCPUN_ADMIN_EDITOR_EMAILS = "editor@example.com";

  assert.equal(hasConfiguredAdminUsers("local-production"), true);
  assert.equal(getConfiguredAdminRole("owner@example.com", true, "local-production"), "owner");
  assert.equal(getConfiguredAdminRole("editor@example.com", true, "local-production"), null);
  assert.equal(getVerifiedGoogleAdminRole({ provider: "google", email: "owner@example.com", emailVerified: true, environment: "local-production" }), "owner");
  assert.equal(getVerifiedGoogleAdminRole({ provider: "google", email: "editor@example.com", emailVerified: true, environment: "local-production" }), null);
});

test("Auth.js uses an explicit secure origin outside local development", () => {
  assert.equal(isSecureAdminAuthUrl("https://lab.example.com", "production"), true);
  assert.equal(isSecureAdminAuthUrl("http://lab.example.com", "production"), false);
  assert.equal(isSecureAdminAuthUrl("https://lab.example.com/unexpected", "production"), false);
  assert.equal(isSecureAdminAuthUrl("https://user:pass@lab.example.com", "production"), false);
  assert.equal(isSecureAdminAuthUrl("http://localhost:3000", "development"), true);
});

test("external OAuth redirects require HTTPS and cannot embed credentials", () => {
  assert.equal(isSafeExternalAuthorizationUrl(new URL("https://auth.example/authorize")), true);
  assert.equal(isSafeExternalAuthorizationUrl(new URL("http://auth.example/authorize")), false);
  assert.equal(isSafeExternalAuthorizationUrl(new URL("javascript:alert(1)")), false);
  assert.equal(isSafeExternalAuthorizationUrl(new URL("https://user:pass@auth.example/authorize")), false);
  assert.equal(isSafeExternalAuthorizationUrl(new URL("https://auth.example/authorize"), "https://auth.example"), true);
  assert.equal(isSafeExternalAuthorizationUrl(new URL("https://phishing.example/authorize"), "https://auth.example"), false);
  assert.equal(isPublicInternetAddress("8.8.8.8"), true);
  assert.equal(isPublicInternetAddress("127.0.0.1"), false);
  assert.equal(isPublicInternetAddress("169.254.1.2"), false);
  assert.equal(isPublicInternetAddress("::1"), false);
});

test("Auth.js fails closed when the session secret is missing or too short", () => {
  assert.equal(hasStrongAuthSecret(undefined), false);
  assert.equal(hasStrongAuthSecret("short"), false);
  assert.equal(hasStrongAuthSecret("a".repeat(31)), false);
  assert.equal(hasStrongAuthSecret("a".repeat(32)), true);
});

test("Production Admin may reuse the complete Google data OAuth pair without changing UAT", () => {
  const dataOnly = {
    CCPUN_GOOGLE_DATA_CLIENT_ID: "data-client",
    CCPUN_GOOGLE_DATA_CLIENT_SECRET: "data-secret",
  };

  assert.deepEqual(getAdminGoogleOAuthCredentials("production-admin", dataOnly), {
    clientId: "data-client",
    clientSecret: "data-secret",
  });
  assert.equal(getAdminGoogleOAuthCredentials("admin-uat", dataOnly), null);
  assert.deepEqual(
    getAdminGoogleOAuthCredentials("admin-uat", {
      AUTH_GOOGLE_ID: "uat-client",
      AUTH_GOOGLE_SECRET: "uat-secret",
    }),
    { clientId: "uat-client", clientSecret: "uat-secret" },
  );
  assert.deepEqual(
    getAdminGoogleOAuthCredentials("production-admin", {
      ...dataOnly,
      AUTH_GOOGLE_ID: "incomplete-auth-client",
    }),
    { clientId: "data-client", clientSecret: "data-secret" },
  );
  assert.deepEqual(
    getAdminGoogleOAuthCredentials("production-admin", {
      ...dataOnly,
      AUTH_GOOGLE_ID: "auth-client",
      AUTH_GOOGLE_SECRET: "auth-secret",
    }),
    { clientId: "auth-client", clientSecret: "auth-secret" },
  );
});

test("Auth.js never assigns an Admin role while authentication is misconfigured", () => {
  process.env.CCPUN_ADMIN_OWNER_EMAILS = "owner@example.com";

  assert.equal(getConfiguredAdminRole("owner@example.com", false), null);
  assert.equal(getConfiguredAdminRole("owner@example.com", true), "owner");
});

test("Admin mutations require an exact browser origin", () => {
  const url = "https://admin-preview.example/api/admin/reviews/1/approve";

  assert.equal(isSameOriginAdminMutation(url, "https://admin-preview.example"), true);
  assert.equal(isSameOriginAdminMutation(url, "https://attacker.example"), false);
  assert.equal(isSameOriginAdminMutation(url, null), false);
  assert.equal(isSameOriginAdminMutation(url, "null"), false);
});

test("Production Admin accepts only the exact configured Auth.js origin", () => {
  const authUrl = "https://admin.ccpun.com/";

  assert.equal(isConfiguredAdminOrigin("https://admin.ccpun.com/snt-admin/", authUrl), true);
  assert.equal(isConfiguredAdminOrigin("https://admin.ccpun.com:443/studio/", authUrl), true);
  assert.equal(isConfiguredAdminOrigin("https://ccpun-admin-prod.vercel.app/", authUrl), false);
  assert.equal(isConfiguredAdminOrigin("http://admin.ccpun.com/", authUrl), false);
  assert.equal(isConfiguredAdminOrigin("not-a-url", authUrl), false);
  assert.equal(isConfiguredAdminOrigin("https://admin.ccpun.com/", undefined), false);
});

test("Local UAT and Production accept only their separate loopback ports", () => {
  assert.equal(getLocalAdminOrigin("local-uat"), "http://localhost:3100");
  assert.equal(getLocalAdminOrigin("local-production"), "http://localhost:3000");
  assert.equal(isLocalAdminHost("localhost:3100", "local-uat"), true);
  assert.equal(isLocalAdminHost("localhost:3000", "local-uat"), false);
  assert.equal(isLocalAdminHost("localhost:3000", "local-production"), true);
  assert.equal(isLocalAdminHost("localhost:3100", "local-production"), false);
  assert.equal(isLocalAdminHost("127.0.0.1:3100", "local-uat"), false);
  assert.equal(isLocalAdminHost(null, "local-production"), false);
  assert.notEqual(getLocalAdminCookieNamespace("local-uat"), getLocalAdminCookieNamespace("local-production"));
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CCPUN_VERCEL_PROJECT_IDS,
  isAdminSurfaceAllowed,
  resolveAdminEnvironment,
} from "../../lib/admin/environment";
import {
  classifyProductionAdminPath,
  isAdminRequestBoundary,
  isAuthenticatedAdminPreviewPath,
  isExactAdminPreviewOrigin,
  isInternalServiceApiPath,
  isKnownAdminDeploymentHost,
} from "../../lib/admin/host-routing";

test("Production Admin root is an explicit Control Plane entry route", () => {
  assert.equal(classifyProductionAdminPath("/"), "entry");
  assert.equal(classifyProductionAdminPath(""), "entry");
});

test("Production Admin allows only Control Plane, Auth, Studio and bootstrap routes", () => {
  for (const path of [
    "/snt-admin",
    "/dashboard/",
    "/api/admin/seo/audit/article-1",
    "/studio",
    "/studio/structure",
    "/api/preview/enable",
    "/api/auth/session",
    "/api/internal/line/rich-menu/reconcile",
    "/api/internal/line/system-delivery/dispatch/",
    "/api/internal/local-ai/jobs/00000000-0000-4000-8000-000000000000/",
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/favicon.ico",
    "/robots.txt",
  ]) {
    assert.equal(classifyProductionAdminPath(path), "allow", path);
  }
});

test("internal service allowlist is exact and handler-authenticated", () => {
  for (const path of [
    "/api/internal/line/rich-menu/reconcile",
    "/api/internal/line/rich-menu/reconcile/",
    "/api/internal/line/system-delivery/dispatch",
    "/api/internal/local-ai/jobs",
    "/api/internal/local-ai/jobs/00000000-0000-4000-8000-000000000000",
  ]) {
    assert.equal(isInternalServiceApiPath(path), true, path);
    assert.equal(classifyProductionAdminPath(path), "allow", path);
  }
  for (const path of [
    "/api/internal",
    "/api/internal/line",
    "/api/internal/line/rich-menu",
    "/api/internal/line/rich-menu/reconcile-now",
    "/api/internal/local-ai/config",
    "/api/internal/unknown",
  ]) {
    assert.equal(isInternalServiceApiPath(path), false, path);
    assert.equal(classifyProductionAdminPath(path), "reject", path);
  }
});

test("Production Admin classifier rejects public CCPun website routes by default", () => {
  for (const path of [
    "/blog",
    "/blog/insurance",
    "/tools/financial-health-check",
    "/ci-planning",
    "/privacy",
    "/cookie-policy",
    "/sitemap.xml",
    "/sitemaps/blog.xml",
    "/api/public-example",
  ]) {
    assert.equal(classifyProductionAdminPath(path), "reject", path);
  }
});

test("authenticated Admin draft preview whitelist is narrow and article-focused", () => {
  for (const path of ["/blog", "/blog/", "/blog/life-insurance/example/", "/assets/example.webp", "/images/example.png"]) {
    assert.equal(isAuthenticatedAdminPreviewPath(path), true, path);
  }
  for (const path of [
    "/",
    "/tools/financial-health-check/",
    "/ci-planning/",
    "/privacy/",
    "/cookie-policy/",
    "/sitemap.xml",
    "/api/auth/session/",
    "/api/admin/session/",
  ]) {
    assert.equal(isAuthenticatedAdminPreviewPath(path), false, path);
  }
});

test("Admin Preview uses the deployed Admin route policy while Web Preview cannot mount Admin", () => {
  const adminPreview = resolveAdminEnvironment(
    undefined,
    "preview",
    CCPUN_VERCEL_PROJECT_IDS.adminProduction,
  );
  assert.equal(adminPreview, "admin-uat");
  assert.equal(isAdminSurfaceAllowed(adminPreview, CCPUN_VERCEL_PROJECT_IDS.adminProduction), true);
  assert.equal(classifyProductionAdminPath("/"), "entry");
  assert.equal(classifyProductionAdminPath("/dashboard/"), "allow");
  assert.equal(classifyProductionAdminPath("/api/admin/session/"), "allow");
  assert.equal(classifyProductionAdminPath("/blog/"), "reject");

  const webPreview = resolveAdminEnvironment(undefined, "preview", CCPUN_VERCEL_PROJECT_IDS.web);
  assert.equal(webPreview, "unknown");
  assert.equal(isAdminSurfaceAllowed(webPreview, CCPUN_VERCEL_PROJECT_IDS.web), false);
});

test("exact Admin Preview aliases may use their generated same-project origin without weakening Production", () => {
  assert.equal(
    isExactAdminPreviewOrigin({
      environment: "admin-uat",
      vercelEnvironment: "preview",
      deploymentProjectId: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
      host: "ccpun-admin-13wutidr7-punniixs-projects.vercel.app",
    }),
    true,
  );
  assert.equal(
    isExactAdminPreviewOrigin({
      environment: "production-admin",
      vercelEnvironment: "production",
      deploymentProjectId: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
      host: "admin.ccpun.com",
    }),
    false,
  );
  assert.equal(
    isExactAdminPreviewOrigin({
      environment: "admin-uat",
      vercelEnvironment: "preview",
      deploymentProjectId: CCPUN_VERCEL_PROJECT_IDS.web,
      host: "ccpun-admin-attacker.vercel.app",
    }),
    false,
  );
  assert.equal(
    isExactAdminPreviewOrigin({
      environment: "admin-uat",
      vercelEnvironment: "preview",
      deploymentProjectId: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
      host: "ccpun-web-preview-punniixs-projects.vercel.app",
    }),
    false,
  );
});

test("local UAT remains a dedicated Admin boundary", () => {
  assert.equal(isAdminSurfaceAllowed("local-uat"), true);
  assert.equal(
    isAdminRequestBoundary({
      environment: "local-uat",
      vercelEnvironment: undefined,
      deploymentProjectId: undefined,
      host: "localhost:3000",
    }),
    true,
  );
  assert.equal(classifyProductionAdminPath("/"), "entry");
  assert.equal(classifyProductionAdminPath("/dashboard/"), "allow");
  assert.equal(classifyProductionAdminPath("/definitely-missing-admin-route/"), "reject");
});

test("local Production read lane keeps the public website root outside the dedicated Admin boundary", () => {
  assert.equal(isAdminSurfaceAllowed("local-production"), true);
  assert.equal(
    isAdminRequestBoundary({
      environment: "local-production",
      vercelEnvironment: undefined,
      deploymentProjectId: undefined,
      host: "127.0.0.1:3000",
    }),
    false,
  );
});

test("Admin deployment identity and known hosts enter a deny-only boundary even with the wrong lane", () => {
  for (const environment of ["production", "unknown"] as const) {
    assert.equal(
      isAdminRequestBoundary({
        environment,
        vercelEnvironment: "preview",
        deploymentProjectId: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
        host: "ccpun-admin-test-punniixs-projects.vercel.app",
      }),
      true,
    );
    assert.equal(isAdminSurfaceAllowed(environment, CCPUN_VERCEL_PROJECT_IDS.adminProduction), false);
  }

  assert.equal(isKnownAdminDeploymentHost("admin.ccpun.com"), true);
  assert.equal(isKnownAdminDeploymentHost("ccpun-admin.vercel.app"), true);
  assert.equal(isKnownAdminDeploymentHost("ccpun-admin-preview-team.vercel.app"), true);
  assert.equal(
    isAdminRequestBoundary({
      environment: "unknown",
      vercelEnvironment: undefined,
      deploymentProjectId: undefined,
      host: "admin.ccpun.com",
    }),
    true,
  );
  assert.equal(isAdminSurfaceAllowed("unknown"), false);
});

test("Web Preview and unknown public hosts do not become an Admin boundary", () => {
  assert.equal(
    isAdminRequestBoundary({
      environment: "unknown",
      vercelEnvironment: "preview",
      deploymentProjectId: CCPUN_VERCEL_PROJECT_IDS.web,
      host: "ccpun-web-preview-punniixs-projects.vercel.app",
    }),
    false,
  );
  assert.equal(isKnownAdminDeploymentHost("ccpun.com"), false);
  assert.equal(isKnownAdminDeploymentHost("localhost:3100"), false);
});

test("Production Admin robots policy stays noindex while CCPun web policy remains separate", () => {
  const robots = readFileSync(new URL("../../app/robots.ts", import.meta.url), "utf8");
  assert.match(robots, /getAdminEnvironment\(\) === "production-admin"/);
  assert.match(robots, /disallow: "\/"/);
  assert.match(robots, /sitemap: "https:\/\/ccpun\.com\/sitemap\.xml"/);
});

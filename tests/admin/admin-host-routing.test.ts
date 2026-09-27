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
    "/api/internal/agent-os/jobs/",
    "/api/internal/agent-os/jobs/00000000-0000-4000-8000-000000000000/",
    "/api/internal/agent-os/exports/",
    "/api/internal/local-ai/jobs/00000000-0000-4000-8000-000000000000/",
    "/api/internal/local-ai/line-descriptions/",
    "/api/internal/local-ai/reviews/",
    "/api/internal/local-ai/operations/health/",
    "/api/internal/local-ai/operations/incidents/",
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
    "/api/internal/agent-os/jobs",
    "/api/internal/agent-os/jobs/00000000-0000-4000-8000-000000000000",
    "/api/internal/agent-os/exports",
    "/api/internal/local-ai/jobs",
    "/api/internal/local-ai/jobs/00000000-0000-4000-8000-000000000000",
    "/api/internal/local-ai/line-descriptions",
    "/api/internal/local-ai/reviews",
    "/api/internal/local-ai/operations/health",
    "/api/internal/local-ai/operations/incidents",
  ]) {
    assert.equal(isInternalServiceApiPath(path), true, path);
    assert.equal(classifyProductionAdminPath(path), "allow", path);
  }
  for (const path of [
    "/api/internal",
    "/api/internal/line",
    "/api/internal/line/rich-menu",
    "/api/internal/line/rich-menu/reconcile-now",
    "/api/internal/agent-os",
    "/api/internal/agent-os/export",
    "/api/internal/agent-os/jobs-extra",
    "/api/internal/local-ai/config",
    "/api/internal/local-ai/review",
    "/api/internal/local-ai/operation",
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

test("Daily analytics reaches its authenticated handler through an exact private route only", () => {
  for (const path of ["/api/internal/analytics/daily", "/api/internal/analytics/daily/"]) {
    assert.equal(isInternalServiceApiPath(path), true, path);
    assert.equal(classifyProductionAdminPath(path), "allow", path);
  }
  for (const path of [
    "/api/internal/analytics",
    "/api/internal/analytics/",
    "/api/internal/analytics/daily-extra",
    "/api/internal/analytics/daily/child",
    "/api/internal/analytics/daily.json",
    "/api/internal/analytics/config",
    "/api/internal/Analytics/daily",
    "/api/internal/analytics/daily%2fchild",
  ]) {
    assert.equal(isInternalServiceApiPath(path), false, path);
    assert.equal(classifyProductionAdminPath(path), "reject", path);
  }
  const handler = readFileSync(new URL("../../apps/admin/app/api/internal/analytics/daily/route.ts", import.meta.url), "utf8");
  assert.match(handler, /if \(!isN8nExportRequestAuthorized\(request\)\) return NextResponse\.json\(\{ error: "unauthorized" \}, \{ status: 401, headers \}\)/);
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

test("analytics assessment permits only its exact service path", () => {
 for (const path of ["/api/internal/analytics/assessment", "/api/internal/analytics/assessment/"]) assert.equal(isInternalServiceApiPath(path), true, path);
 for (const path of ["/api/internal/analytics/assessments", "/api/internal/analytics/assessment/child", "/api/internal/analytics/assessment%2Fchild", "/api/internal/analytics/Assessment"]) assert.equal(isInternalServiceApiPath(path), false, path);
});


test("Marketing service routes reach bearer handlers only through four exact Admin paths", () => {
  const paths = ["refresh", "analysis", "workspace", "actions/import"];
  for (const suffix of paths) {
    const path = `/api/internal/marketing/${suffix}`;
    for (const value of [path, `${path}/`]) {
      assert.equal(isInternalServiceApiPath(value), true, value);
      assert.equal(classifyProductionAdminPath(value), "allow", value);
    }
    const handler = readFileSync(new URL(`../../apps/admin/app/api/internal/marketing/${suffix}/route.ts`, import.meta.url), "utf8");
    assert.match(handler, /if\s*\(!isN8nExportRequestAuthorized\(request\)\)\s*return NextResponse\.json\(\{\s*error:\s*"unauthorized"\s*\},\s*\{\s*status:\s*401/);
    assert.ok(handler.indexOf("isN8nExportRequestAuthorized(request)") < handler.indexOf("request.body"), suffix);
  }
  for (const path of [
    "/api/internal/marketing", "/api/internal/marketing/", "/api/internal/marketing/actions",
    "/api/internal/marketing/refresh/child", "/api/internal/marketing/refresh-extra",
    "/api/internal/marketing/analysis.json", "/api/internal/marketing/workspace%2fchild",
    "/api/internal/marketing/actions/import/child", "/api/internal/marketing/actions/import-extra",
    "/api/internal/Marketing/analysis", "/api/internal/marketing/config", "/api/internal/marketing/../config",
  ]) {
    assert.equal(isInternalServiceApiPath(path), false, path);
    assert.equal(classifyProductionAdminPath(path), "reject", path);
  }
  assert.equal(isAdminRequestBoundary({ environment: "production", vercelEnvironment: "production", deploymentProjectId: CCPUN_VERCEL_PROJECT_IDS.web, host: "ccpun.com" }), false);
  assert.equal(isAdminSurfaceAllowed("production", CCPUN_VERCEL_PROJECT_IDS.web), false);
  assert.equal(isAdminRequestBoundary({ environment: "production-admin", vercelEnvironment: "production", deploymentProjectId: CCPUN_VERCEL_PROJECT_IDS.adminProduction, host: "admin.ccpun.com" }), true);
});

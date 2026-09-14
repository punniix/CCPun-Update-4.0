import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CCPUN_VERCEL_PROJECT_IDS,
  isAdminSurfaceAllowed,
  resolveAdminEnvironment,
} from "../../lib/admin/environment";
import { classifyProductionAdminPath } from "../../lib/admin/host-routing";

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
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/favicon.ico",
    "/robots.txt",
  ]) {
    assert.equal(classifyProductionAdminPath(path), "allow", path);
  }
});

test("Production Admin rejects public CCPun website routes even for authenticated users", () => {
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

test("dedicated local Admin hosts share root entry and unknown-route rejection", () => {
  for (const environment of ["local-uat", "local-production"] as const) {
    assert.equal(isAdminSurfaceAllowed(environment), true, environment);
    assert.equal(classifyProductionAdminPath("/"), "entry", environment);
    assert.equal(classifyProductionAdminPath("/dashboard/"), "allow", environment);
    assert.equal(classifyProductionAdminPath("/definitely-missing-admin-route/"), "reject", environment);
  }
});

test("Production Admin robots policy stays noindex while CCPun web policy remains separate", () => {
  const robots = readFileSync(new URL("../../app/robots.ts", import.meta.url), "utf8");
  assert.match(robots, /getAdminEnvironment\(\) === "production-admin"/);
  assert.match(robots, /disallow: "\/"/);
  assert.match(robots, /sitemap: "https:\/\/ccpun\.com\/sitemap\.xml"/);
});

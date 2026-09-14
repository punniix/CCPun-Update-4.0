import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
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

test("Production Admin robots policy stays noindex while CCPun web policy remains separate", () => {
  const robots = readFileSync(new URL("../../app/robots.ts", import.meta.url), "utf8");
  assert.match(robots, /getAdminEnvironment\(\) === "production-admin"/);
  assert.match(robots, /disallow: "\/"/);
  assert.match(robots, /sitemap: "https:\/\/ccpun\.com\/sitemap\.xml"/);
});

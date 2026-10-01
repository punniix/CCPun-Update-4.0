import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("candidate robots evaluates runtime flags and denies every crawler while live intent stays unchanged", () => {
  for (const candidate of [true, false]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", "-e", "const {default:robots, dynamic}=require('./apps/web/app/robots.ts'); console.log(JSON.stringify({dynamic, robots:robots()}));"], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, NODE_ENV: "production", CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "web", CCPUN_APP_ENV: "production", CCPUN_GIT_REF: "v4-production", CCPUN_UAT_MODE: candidate ? "1" : "0" },
    });
    assert.equal(result.status, 0, result.stderr);
    const value = JSON.parse(result.stdout);
    assert.equal(value.dynamic, "force-dynamic");
    assert.deepEqual(value.robots.rules[0], candidate ? { userAgent: "*", disallow: "/" } : { userAgent: "*", allow: "/", disallow: ["/api/", "/login/", "/dashboard/", "/content/", "/seo/", "/social/", "/analytics/", "/operations/", "/settings/", "/admin-not-found/", "/snt-admin/", "/studio/"] });
    assert.equal(value.robots.sitemap, candidate ? undefined : "https://ccpun.com/sitemap.xml");
  }
});

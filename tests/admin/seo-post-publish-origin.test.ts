import assert from "node:assert/strict";
import test from "node:test";
import { isPostPublishAdminOriginAllowed } from "../../lib/admin/seo-intelligence/post-publish-origin";

const prod = { AUTH_URL: "https://admin.ccpun.com", CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin" };
const uat = { AUTH_URL: "https://admin-test.ccpun.com", CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin" };
const request = (url: string, method = "GET", headers: Record<string,string> = {}) => new Request(url, { method, headers });

test("Hostinger Admin UAT allows exact ingress host despite rewritten internal Next URL", () => {
  assert.equal(isPostPublishAdminOriginAllowed(request("http://127.0.0.1:3000/api/admin/seo/post-publish/?articleId=fixture", "GET", { host: "admin-test.ccpun.com", "x-forwarded-host": "admin-test.ccpun.com", "x-forwarded-proto": "https" }), uat, "admin-uat"), true);
  assert.equal(isPostPublishAdminOriginAllowed(request("https://admin-test.ccpun.com/api/admin/seo/post-publish/", "POST", { host: "admin-test.ccpun.com", origin: "https://admin-test.ccpun.com", "x-forwarded-proto": "https" }), uat, "admin-uat"), true);
});
test("Admin Production exact host/origin accept, no cross-environment privileges", () => {
  assert.equal(isPostPublishAdminOriginAllowed(request("http://localhost:3000/api/admin/seo/post-publish/", "POST", { host: "admin.ccpun.com", origin: "https://admin.ccpun.com", "x-forwarded-proto": "https" }), prod, "production-admin"), true);
  assert.equal(isPostPublishAdminOriginAllowed(request("https://admin-test.ccpun.com/api/admin/seo/post-publish/", "POST", { host: "admin-test.ccpun.com", origin: "https://admin-test.ccpun.com" }), prod, "production-admin"), false);
});
test("No forged Host, forwarded host/proto, cross-origin or missing Origin can bypass deployed Admin fence", () => {
  const badRequests: Record<string, string>[] = [
    { host: "attacker.example", origin: "https://admin.ccpun.com" },
    { host: "admin.ccpun.com", "x-forwarded-host":"attacker.example", origin:"https://admin.ccpun.com" },
    { host: "admin.ccpun.com", "x-forwarded-host":"admin.ccpun.com, attacker.example", origin:"https://admin.ccpun.com" },
    { host: "admin.ccpun.com", "x-forwarded-proto":"http", origin:"https://admin.ccpun.com" },
    { host: "admin.ccpun.com", origin:"https://attacker.example" },
    { host: "admin.ccpun.com" },
  ];
  for (const bad of badRequests) {
    assert.equal(isPostPublishAdminOriginAllowed(request("http://localhost:3000/api/admin/seo/post-publish/", "POST", bad), prod, "production-admin"), false);
  }
});
test("Incorrect AUTH_URL, Vercel and local flows remain strict fail-closed", () => {
  assert.equal(isPostPublishAdminOriginAllowed(request("http://127.0.0.1:3000/foo","GET",{host:"admin.ccpun.com"}), {...prod, AUTH_URL:"https://other.example"}, "production-admin"), false);
  assert.equal(isPostPublishAdminOriginAllowed(request("http://127.0.0.1:3000/foo","GET",{host:"admin.ccpun.com"}), {...prod, CCPUN_DEPLOYMENT_PROVIDER:"vercel"}, "production-admin"), false);
  assert.equal(isPostPublishAdminOriginAllowed(request("https://admin.ccpun.com/foo","GET"), {...prod, CCPUN_DEPLOYMENT_PROVIDER:"vercel"}, "production-admin"), true);
  assert.equal(isPostPublishAdminOriginAllowed(request("http://localhost:3100/foo","POST",{origin:"http://localhost:3100"}), {AUTH_URL:"http://localhost:3100"}, "local-uat"), true);
});

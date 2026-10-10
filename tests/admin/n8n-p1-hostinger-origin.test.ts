import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {isPostPublishAdminOriginAllowed} from "../../lib/admin/seo-intelligence/post-publish-origin";

const route=readFileSync(new URL("../../apps/admin/app/api/admin/n8n/p1/seo/route.ts",import.meta.url),"utf8");
const env={CCPUN_DEPLOYMENT_PROVIDER:"hostinger",CCPUN_DEPLOYMENT_ROLE:"admin",AUTH_URL:"https://admin-test.ccpun.com"};
const request=(origin:string,host="admin-test.ccpun.com",forwardedHost=host)=>new Request("http://127.0.0.1:3000/api/admin/n8n/p1/seo/",{method:"POST",headers:{host,origin,"x-forwarded-host":forwardedHost,"x-forwarded-proto":"https"}});

test("UAT SEO dispatch honors validated Hostinger ingress without weakening origin isolation",()=>{
 assert.match(route,/isPostPublishAdminOriginAllowed\(request,process\.env,getAdminEnvironment\(\)\)/);
 assert.equal(isPostPublishAdminOriginAllowed(request("https://admin-test.ccpun.com"),env,"admin-uat"),true);
 assert.equal(isPostPublishAdminOriginAllowed(request("https://external.example"),env,"admin-uat"),false);
 assert.equal(isPostPublishAdminOriginAllowed(request("https://admin.ccpun.com"),env,"admin-uat"),false);
 assert.equal(isPostPublishAdminOriginAllowed(request("https://admin-test.ccpun.com","evil.example"),env,"admin-uat"),false);
 assert.equal(isPostPublishAdminOriginAllowed(request("https://admin-test.ccpun.com","admin-test.ccpun.com","evil.example"),env,"admin-uat"),false);
 assert.equal(isPostPublishAdminOriginAllowed(request("https://admin-test.ccpun.com"),env,"production-admin"),false);
});

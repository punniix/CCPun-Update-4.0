import assert from "node:assert/strict";
import test from "node:test";
import { isUatPostPublishMockAllowed, UAT_POST_PUBLISH_MOCK_ID } from "../../lib/admin/seo-intelligence/post-publish-uat-policy";
import { readFileSync } from "node:fs";

const env={
 CCPUN_SEO_POST_PUBLISH_UAT_MOCK_ENABLED:"1",CCPUN_APP_ENV:"admin-uat",NEXT_PUBLIC_CCPUN_APP_ENV:"admin-uat",
 CCPUN_DEPLOYMENT_PROVIDER:"hostinger",CCPUN_DEPLOYMENT_ROLE:"admin",AUTH_URL:"https://admin-test.ccpun.com",
 CCPUN_NEON_PROJECT_ID:"young-term-47483330",CCPUN_NEON_BRANCH_ID:"br-crimson-mouse-az7ajkv8",CCPUN_NEON_DATABASE:"neondb",
 NEXT_PUBLIC_SANITY_PROJECT_ID:"ccb9lnw5",NEXT_PUBLIC_SANITY_DATASET:"uat",
 CCPUN_GIT_REF:"admin/hostinger-release-uat-0000000000000000000000000000000000000000",
 CCPUN_GIT_SHA:"0000000000000000000000000000000000000000",CCPUN_RELEASE_ID:"hostinger-admin-uat-000000000000",
 CCPUN_ADMIN_DATABASE_URL:"postgresql://ccpun_admin_runtime:test@ep-mute-frost-aztvz394.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
};
test("UAT-only mock contract enforces UAT Neon, UAT Sanity, exact Admin Hostinger lane and disabled by default",()=>{
 assert.equal(isUatPostPublishMockAllowed(env),true);
 for(const key of Object.keys(env)){
  assert.equal(isUatPostPublishMockAllowed({...env,[key]:key==="CCPUN_SEO_POST_PUBLISH_UAT_MOCK_ENABLED"?"0":"INVALID"}),false,key);
 }
 assert.equal(isUatPostPublishMockAllowed({...env,CCPUN_APP_ENV:"production-admin"}),false);
});
test("Mock fixture has no article publication, no external sitemap calls, and owner approval always false",()=>{
 const source=readFileSync(new URL("../../lib/admin/seo-intelligence/post-publish-uat-queue.ts",import.meta.url),"utf8");
 const route=readFileSync(new URL("../../apps/admin/app/api/admin/seo/post-publish/uat-mock/route.ts",import.meta.url),"utf8");
 assert.match(UAT_POST_PUBLISH_MOCK_ID,/^uat-seo-/);
 assert.match(source,/owner_approved, request_id/);
 assert.match(source,/false, \$3::uuid/);
 assert.match(source,/ON CONFLICT \(article_id, content_version\) DO NOTHING/);
 assert.doesNotMatch(source,/publishApprovedArticle|submitGscSitemap|sanity\.client\.create|sitemap.*PUT/);
 assert.match(route,/identity\.role !== "owner"/);
 assert.match(route,/isPostPublishAdminOriginAllowed/);
 assert.match(route,/getAdminEnvironment\(\) !== "admin-uat"/);
});

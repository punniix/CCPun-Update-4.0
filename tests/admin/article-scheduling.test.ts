import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { articleScheduleBlock, bangkokLocalDateTimeToIso, getScheduleDelaySeconds } from "../../cms/sanity/policy/article-scheduling";
import type { PublishableArticle } from "../../cms/sanity/policy/article-publication";
import { articleIdSchema, resolveArticleSchedulerLane, scheduleRequestSchema, SCHEDULER_LANES } from "../../lib/admin/operations/article-schedule-contract";
import { hasAdminPermission } from "../../lib/admin/rbac";

const draft: PublishableArticle = { _id: "drafts.article-1", _type: "article", _rev: "draft-rev-1", _createdAt: "2026-09-01T00:00:00Z", _updatedAt: "2026-09-01T00:00:00Z",
  title: "Title", excerpt: "Excerpt", body: [{ _type: "block", _key: "a", children: [] }], author: { _ref: "author-1" }, seo: {},
  review: { status: "approved" }, slug: { current: "article-1" }, category: { _ref: "category-1" } };
const published: PublishableArticle = { ...draft, _id: "article-1", _rev: "live-rev-1", publishedAt: "2026-08-01T00:00:00Z" };
const now = Date.parse("2026-09-11T12:00:00.000Z");

test("Bangkok input rejects rollover invalid leap days offsets and ambiguous formats", () => {
  assert.equal(bangkokLocalDateTimeToIso("2026-09-12T07:30"), "2026-09-12T00:30:00.000Z");
  assert.equal(bangkokLocalDateTimeToIso("2028-02-29T00:30"), "2028-02-28T17:30:00.000Z");
  for (const input of ["2026-02-31T07:30","2026-02-29T07:30","2026-09-12 07:30","2026-09-12T24:00","2026-09-12T07:30Z","2026-00-12T07:30"]) assert.equal(bangkokLocalDateTimeToIso(input),null,input);
});
test("scheduling retains approval URL reference indexing and essential-content guards", () => {
  const target="2026-09-12T00:30:00.000Z";
  assert.equal(articleScheduleBlock(draft,null,target,now),null);
  assert.equal(articleScheduleBlock(draft,published,target,now),null);
  for(const changed of [{...draft,review:{status:"drafting"}},{...draft,slug:{current:"changed"}},{...draft,author:{_type:"reference",_ref:"drafts.author"}},{...draft,title:""},{...draft,body:[]},{...draft,seo:{noindex:true}}]) assert.ok(articleScheduleBlock(changed,published,target,now));
  assert.match(String(articleScheduleBlock(draft,null,"2026-09-11T12:00:10Z",now)),/30 วินาที/);
  assert.match(String(articleScheduleBlock(draft,null,"2027-09-11T12:00:10Z",now)),/90 วัน/);
});
test("workflow delay preserves exact UTC differences and invalid values fail closed", () => {
  assert.equal(getScheduleDelaySeconds("2026-09-11T12:01:00Z",now),60);
  assert.equal(getScheduleDelaySeconds("2026-09-11T11:59:00Z",now),0);
  assert.equal(getScheduleDelaySeconds("not-a-date",now),null);
});
test("owner-only scheduling accepts only bounded logical article IDs and strict confirmations", () => {
  assert.equal(hasAdminPermission("owner","content:schedule"),true);
  for (const role of ["editor","seo-manager","reviewer","analyst","viewer"] as const) assert.equal(hasAdminPermission(role,"content:schedule"),false);
  for (const id of ["", "drafts.article", "versions.release.article", "article/1", "a".repeat(129)]) assert.equal(articleIdSchema.safeParse(id).success,false);
  const request={scheduledLocal:"2026-09-12T07:30",draftRevision:"rev-1",publishedRevision:null,expectedGeneration:null,expectedVersion:0,requestId:randomUUID()};
  assert.equal(scheduleRequestSchema.safeParse(request).success,true);
  assert.equal(scheduleRequestSchema.safeParse({...request,role:"owner"}).success,false);
  assert.equal(scheduleRequestSchema.safeParse({...request,expectedVersion:5}).success,false);
  assert.equal(scheduleRequestSchema.safeParse({...request,draftRevision:undefined}).success,false);
});
function variables(lane: "uat" | "production") {
  const p=SCHEDULER_LANES[lane];
  return { CCPUN_APP_ENV:lane==="uat"?"admin-uat":"production-admin",VERCEL_PROJECT_ID:"prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
    CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID:"prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",VERCEL_ENV:lane==="uat"?"preview":"production",VERCEL_GIT_COMMIT_REF:"v4-production",
    NEXT_PUBLIC_SANITY_PROJECT_ID:p.sanityProjectId,NEXT_PUBLIC_SANITY_DATASET:p.dataset,CCPUN_NEON_PROJECT_ID:p.projectId,CCPUN_NEON_BRANCH_ID:p.branchId,CCPUN_NEON_DATABASE:"neondb",
    CCPUN_ADMIN_DATABASE_URL:`postgresql://ccpun_admin_runtime:TEST_ONLY@${p.endpointId}.${p.hostSuffix}/neondb?sslmode=require` };
}
test("private scheduler accepts only the exact Admin project role Neon and Sanity lane", () => {
  for (const lane of ["uat","production"] as const) {
    const v=variables(lane); assert.equal(resolveArticleSchedulerLane(v),lane);
    for (const [key,value] of [["VERCEL_PROJECT_ID","prj_other"],["NEXT_PUBLIC_SANITY_PROJECT_ID","wrong"],["CCPUN_NEON_BRANCH_ID","wrong"],["CCPUN_NEON_DATABASE","postgres"],["CCPUN_APP_ENV","production"]]) assert.equal(resolveArticleSchedulerLane({...v,[key]:value}),null,key);
    assert.equal(resolveArticleSchedulerLane({...v,CCPUN_ADMIN_DATABASE_URL:v.CCPUN_ADMIN_DATABASE_URL.replace("ccpun_admin_runtime","ccpun_social_runtime")}),null);
    assert.equal(resolveArticleSchedulerLane({...v,CCPUN_ADMIN_DATABASE_URL:v.CCPUN_ADMIN_DATABASE_URL.replace("ccpun_admin_runtime","neondb_owner")}),null);
    assert.equal(resolveArticleSchedulerLane({...v,CCPUN_ADMIN_DATABASE_URL:v.CCPUN_ADMIN_DATABASE_URL.replace(".neon.tech/",".neon.tech.attacker.test/")}),null);
  }
  assert.equal(resolveArticleSchedulerLane({...variables("production"),VERCEL_ENV:"preview"}),null);
  assert.equal(resolveArticleSchedulerLane({...variables("production"),VERCEL_GIT_COMMIT_REF:"feature/test"}),null);
  assert.equal(resolveArticleSchedulerLane({...variables("production"),CCPUN_ADMIN_DATABASE_URL:variables("uat").CCPUN_ADMIN_DATABASE_URL}),null);
});
test("queue storage has no Sanity operational writes and Workflow wiring uses an absolute time", () => {
  const read=(file:string)=>readFileSync(new URL(`../../${file}`,import.meta.url),"utf8");
  assert.doesNotMatch(read("lib/admin/article-scheduling.ts"),/createOrReplace|publishSchedule|drafts\.publishSchedule/);
  assert.match(read("lib/admin/operations/article-schedule-store.ts"),/process\.env\.CCPUN_ADMIN_DATABASE_URL/);
  assert.doesNotMatch(read("lib/admin/operations/article-schedule-store.ts"),/process\.env\.(?:CCPUN_SOCIAL_DATABASE_URL|DATABASE_URL)/);
  assert.match(read("next.config.ts"),/withWorkflow\(nextConfig\)/);
  assert.match(read("lib/admin/article-publication-workflow.ts"),/sleep\(new Date\(input\.scheduledAt\)\)/);
  assert.match(read("lib/admin/article-publication-workflow.ts"),/maxRetries = 0/);
  assert.match(read("proxy.ts"),/well-known\/workflow\//);
  assert.match(read("app/api/snt-admin/content/[id]/schedule/route.ts"),/cancelScheduleRequestSchema\.safeParse/);
});

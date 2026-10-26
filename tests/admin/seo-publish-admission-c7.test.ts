import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import test from "node:test";
import {seoPublishTriggerSources,seoPublishTriggerPredecessorDigest,seoPublishTriggerDomPredecessor} from "../../qa/seo-publish-trigger-20261026-proof.mjs";
const sha=(source:string)=>createHash("sha256").update(source).digest("hex");
test("C7 exact successor map preserves every predecessor and rejects mutations",()=>{
 for(const [file,entry] of Object.entries(seoPublishTriggerSources) as [string,{before:string;after:string}][]){const source=readFileSync(file,"utf8");assert.equal(sha(source),entry.after);assert.equal(seoPublishTriggerPredecessorDigest(file,entry.after),entry.before);for(const mutation of [source+"\n",source.replace(/import /,"/* MUTATION */ import ")]){assert.notEqual(sha(mutation),entry.after);assert.equal(seoPublishTriggerPredecessorDigest(file,sha(mutation)),sha(mutation));}}
});

test("C7 DOM projection binds full owner action container and placement; moved, duplicated or changed existing links remain visible",async()=>{
 const {loadFixtureModule}=await import("../../qa/phase1-fixture-loader.mjs");
 const {renderToStaticMarkup}=await import("react-dom/server");
 const link='<a href="/seo/post-publish/" class="inline-flex min-h-11 items-center px-4 text-sm text-[#e0c985] underline">SEO หลังเผยแพร่</a>';
 for(const enabled of [false,true]){
  const page=loadFixtureModule("apps/admin/app/(control-plane)/seo/page.tsx",{mocks:new Map([
   ["@/lib/admin/require-permission",{requireAdminPermission:async()=>({role:"owner"})}],
   ["@/lib/admin/environment",{getAdminEnvironment:()=>"production-admin",isStudioDataPlaneAllowed:()=>true}],
   ["@/lib/admin/sanity-control",{listAdminArticles:async()=>({rows:[],status:{dataset:"production"}})}],
   ["@/lib/admin/seo-intelligence/foundation",{getSeoIntelligenceRuntimeStatus:()=>({enabled})}]
  ]),globals:{process:{env:{CCPUN_SEO_POST_PUBLISH_QUEUE_ENABLED:"1"}}}});
  const html=renderToStaticMarkup(await page.default());
  const projected=seoPublishTriggerDomPredecessor(html);
  assert.equal(projected,html.replace(link,'').replace('<div class="flex gap-2" style="flex-wrap:wrap">','<div class="flex gap-2">'));
  const action=html.slice(html.indexOf('<div class="flex gap-2" style="flex-wrap:wrap">'),html.indexOf('</div></div><section class="mt-7 grid gap-3 sm:grid-cols-4">'))+'</div>';
  for(const mutation of [html+link,html.replace('/content/research/','/content/other/'),html.replace('ดูข้อเสนอที่รอตรวจ','CHANGED-EXISTING'),html.replace(action,'<div class="flex gap-2"></div>')+'<main>'+action+'</main>',html.replace('flex-wrap:wrap','flex-wrap:nowrap')])assert.equal(seoPublishTriggerDomPredecessor(mutation),mutation);
 }
 const unrelated='<main><div class="flex gap-2" style="flex-wrap:wrap">UNRELATED</div><a href="/seo/post-publish/">arbitrary</a></main>';
 assert.equal(seoPublishTriggerDomPredecessor(unrelated),unrelated);
 const health='<div class="mt-7"><button data-fixture-component="PostPublishHealthCard" data-fixture-props="{}"></button></div>';
 assert.equal(seoPublishTriggerDomPredecessor(health),'');assert.equal(seoPublishTriggerDomPredecessor(health+health),health+health);
});

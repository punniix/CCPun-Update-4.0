import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  SAFE_KNOWLEDGE_FORBIDDEN_KEYS,
  parseSafeKnowledgeRequest,
  requiresHumanKnowledgeHandoff,
} from "../../lib/line/safe-knowledge";
import { campaignSegmentSchema } from "../../lib/line/campaign-safe";
import { hasAdminPermission } from "../../lib/admin/rbac";

const root=path.resolve(import.meta.dirname,"../..");
const read=(file:string)=>readFileSync(path.join(root,file),"utf8");
const checksum="099a8968a8ec6fbb1fee589b410f3f071e762dd86ef3b1906b903fed5029e68d";

function body(sql:string){return sql.split("-- checksum-source-begin\n",2)[1]?.split("-- checksum-source-end",1)[0]??"";}
function normalized(sql:string){return sql
  .replaceAll("20260918_line_private_inbox_reader_v1_uat","PREV")
  .replaceAll("20260918_line_private_inbox_reader_v1_production","PREV")
  .replaceAll("20260918_line_safe_knowledge_crm_campaign_v1_uat","THIS")
  .replaceAll("20260918_line_safe_knowledge_crm_campaign_v1_production","THIS")
  .replaceAll("young-term-47483330","PROJECT").replaceAll("lively-bar-43618798","PROJECT")
  .replaceAll("br-crimson-mouse-az7ajkv8","BRANCH").replaceAll("br-long-resonance-b3ys5xrv","BRANCH")
  .replaceAll("ep-mute-frost-aztvz394","ENDPOINT").replaceAll("ep-broad-butterfly-b3ro7u8w","ENDPOINT")
  .replaceAll("20260917_private_line_runtime_v1_uat","BASE").replaceAll("20260917_private_line_runtime_v1_production","BASE");
}

test("Safe Knowledge accepts predefined IDs only and rejects free text/private keys",()=>{
  const safe=parseSafeKnowledgeRequest({question_id:"motor_2plus_vs_3plus",journey:"motor_quote_review",stage:"entry",personalized:false});
  assert.ok(safe);
  assert.equal(parseSafeKnowledgeRequest({question_id:"motor_2plus_vs_3plus",journey:"motor_quote_review",stage:"entry",text:"ช่วยดู quote ของผม"}),null);
  for(const key of SAFE_KNOWLEDGE_FORBIDDEN_KEYS){
    const value={question_id:"motor_2plus_vs_3plus",journey:"motor_quote_review",stage:"entry",[key]:"secret"};
    assert.equal(parseSafeKnowledgeRequest(value),null,key);
  }
});

test("Safe Knowledge hard-handoffs personal advice boundaries",()=>{
  const base=parseSafeKnowledgeRequest({question_id:"critical_illness_basics",journey:"life_health_policy_review",stage:"entry"});
  assert.ok(base);
  for(const key of ["personalized","suitability_required","recommendation_required","quote_required","health_conclusion_required","explicit_human_request","needs_human"] as const){
    const value: Parameters<typeof requiresHumanKnowledgeHandoff>[0] = {...base,[key]:true};
    assert.equal(requiresHumanKnowledgeHandoff(value),true,key);
  }
});

test("published Sanity FAQ is the only answer source and runtime has no LLM dependency",()=>{
  const runtime=read("apps/web/lib/line/safe-knowledge-runtime.ts");
  assert.match(runtime,/includeDrafts: false/);
  assert.match(runtime,/article\.faq/);
  assert.match(runtime,/article\.status !== "published"/);
  assert.doesNotMatch(runtime,/openai|anthropic|claude|chatgpt|generateText|streamText/i);
  const route=read("apps/web/app/api/line/knowledge/route.ts");
  assert.match(route,/payload_too_large/);
  assert.match(route,/noindex/);
  assert.doesNotMatch(route,/request\.headers.*authorization|LINE_CHANNEL_ACCESS_TOKEN/);
});

test("Phase 8-10 migrations keep UAT/Production parity and checksum",()=>{
  const u=read("db/migrations/20260918_line_safe_knowledge_crm_campaign_v1_uat.sql");
  const p=read("db/migrations/20260918_line_safe_knowledge_crm_campaign_v1_production.sql");
  assert.equal(normalized(u),normalized(p));
  assert.equal(body(u),body(p));
  assert.equal(createHash("sha256").update(body(u)).digest("hex"),checksum);
  assert.match(u,new RegExp(`sha256:${checksum}`));
  assert.match(p,new RegExp(`sha256:${checksum}`));
  assert.doesNotMatch(body(u),/system_identity/);
});

test("Admin CRM/campaign remains least privilege and PUBLIC/ingress denied",()=>{
  const sql=read("db/migrations/20260918_line_safe_knowledge_crm_campaign_v1_production.sql");
  assert.match(sql,/REVOKE ALL PRIVILEGES ON TABLE[\s\S]*line_campaign_delivery_attempt[\s\S]*FROM ccpun_admin_runtime/);
  assert.doesNotMatch(sql,/GRANT (?:SELECT|INSERT|UPDATE|DELETE) ON (?:TABLE )?private_line\.(?:advisor_private_note|line_campaign|line_campaign_delivery|advisor_case_event)(?:\s|;|,)/);
  for(const fn of ["admin_add_private_note","admin_update_case_operations","admin_enqueue_line_campaign","admin_claim_line_campaign_delivery","admin_checkpoint_line_campaign_delivery"]){
    assert.match(sql,new RegExp(`REVOKE ALL ON FUNCTION private_line\\.${fn}`));
    assert.match(sql,new RegExp(`FROM ccpun_line_ingress`));
  }
});

test("campaign segment is exact structured safe criteria only",()=>{
  assert.ok(campaignSegmentSchema.safeParse({journey:"motor_quote_review",stage:"Qualified",material_received:true,priority:"high",tag:"renewal_soon",recency_bucket:"week"}).success);
  for(const value of [
    {name:"Alice"},
    {phone:"0812345678"},
    {message:"raw chat"},
    {income:90000},
    {health:"cancer"},
    {recipients:["u1"]},
    {stage:"Anything"},
    {recency_bucket:"forever"},
  ]) assert.equal(campaignSegmentSchema.safeParse(value).success,false,JSON.stringify(value));
});

test("campaign enqueue requires human approval and queue has idempotency lease/checkpoint/reconciliation",()=>{
  const sql=read("db/migrations/20260918_line_safe_knowledge_crm_campaign_v1_production.sql");
  assert.match(sql,/status='approved' FOR UPDATE/);
  assert.match(sql,/UNIQUE \(campaign_id, lead_id\)/);
  assert.match(sql,/idempotency_digest text NOT NULL UNIQUE/);
  assert.match(sql,/FOR UPDATE OF d SKIP LOCKED/);
  assert.match(sql,/lease_expires_at/);
  assert.match(sql,/attempt_count/);
  assert.match(sql,/reconciliation_required/);
  assert.match(sql,/line_campaign_delivery_attempt/);
});

test("campaign client never receives provider identity or recipient rows",()=>{
  const server=read("lib/admin/line/campaigns.ts");
  const api=read("apps/admin/app/api/admin/line/campaigns/route.ts");
  const ui=read("features/admin/line/LineCampaignManager.tsx");
  for(const src of [server,api,ui]){
    assert.doesNotMatch(src,/external_ref_|line_user_id|recipient_ciphertext|provider_identity/);
  }
  assert.match(ui,/recipient list เข้า client\/AI/);
  assert.match(ui,/Human Approve/);
  assert.match(ui,/Provider send:/);
});

test("internal notes are encrypted private-only and absent from Safe Knowledge",()=>{
  const workflow=read("lib/admin/line/advisor-workflow.ts");
  assert.match(workflow,/advisor-private-note/);
  assert.match(workflow,/CCPUN_LINE_PRIVATE_NOTES_ENABLED/);
  assert.match(workflow,/createLineContentCrypto/);
  const safe=read("lib/line/safe-knowledge.ts");
  assert.match(safe,/internal_note/);
  assert.doesNotMatch(safeKnowledgeObjectExample(),/noteText|note_id|lead_id/);
});

function safeKnowledgeObjectExample(){
  const parsed=parseSafeKnowledgeRequest({question_id:"financial_pyramid_basics",journey:"investment_before_you_act",stage:"entry"});
  return JSON.stringify(parsed);
}

test("Advisor and campaign mutations are owner-only and exact-origin",()=>{
  assert.equal(hasAdminPermission("owner","advisor:note"),true);
  assert.equal(hasAdminPermission("owner","campaign:write"),true);
  assert.equal(hasAdminPermission("editor","advisor:note"),false);
  assert.equal(hasAdminPermission("viewer","campaign:read"),false);
  for(const file of [
    "apps/admin/app/api/admin/line/inbox/[leadId]/operations/route.ts",
    "apps/admin/app/api/admin/line/inbox/[leadId]/notes/route.ts",
    "apps/admin/app/api/admin/line/campaigns/route.ts",
    "apps/admin/app/api/admin/line/campaigns/[campaignId]/approve/route.ts",
    "apps/admin/app/api/admin/line/campaigns/[campaignId]/enqueue/route.ts",
  ]){
    const src=read(file);
    assert.match(src,/isSameOriginAdminMutation|export async function GET/);
    if(src.includes("export async function POST")) assert.match(src,/isSameOriginAdminMutation/);
  }
});

test("campaign provider write remains disabled by an explicit future gate",()=>{
  const source=read("lib/admin/line/campaigns.ts");
  assert.match(source,/CCPUN_LINE_CAMPAIGN_SEND_ENABLED/);
  assert.match(source,/CCPUN_LINE_CHANNEL_ACCESS_TOKEN/);
  assert.doesNotMatch(source,/fetch\(|api\.line\.me/);
});

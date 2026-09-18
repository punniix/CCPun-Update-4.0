import "server-only";

import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { adminOperationsRuntimeInputFromEnvironment, resolveAdminOperationsRuntimeIdentity } from "../operations/foundation";
import { campaignSegmentSchema, lineSafeIdSchema } from "../../line/campaign-safe";

const campaignInputSchema = z.object({
  campaignId: z.string().uuid().optional(),
  campaignCode: lineSafeIdSchema,
  title: z.string().trim().min(1).max(160),
  journey: lineSafeIdSchema.optional(),
  contentId: lineSafeIdSchema.optional(),
  toolId: lineSafeIdSchema.optional(),
  copyText: z.string().trim().min(1).max(2000),
  segment: campaignSegmentSchema,
  scheduledStartAt: z.string().datetime().optional(),
  scheduledEndAt: z.string().datetime().optional(),
}).strict();

const campaignRowSchema = z.object({
  campaign_id: z.string().uuid(), campaign_code: z.string(), title: z.string(),
  status: z.enum(["draft","approved","active","paused","completed","cancelled"]),
  journey: z.string().nullable(), content_id: z.string().nullable(), tool_id: z.string().nullable(),
  copy_text: z.string(), copy_version: z.coerce.number().int().positive(), segment: campaignSegmentSchema,
  scheduled_start_at: z.union([z.string(),z.date()]).nullable(), scheduled_end_at: z.union([z.string(),z.date()]).nullable(),
  approved_at: z.union([z.string(),z.date()]).nullable(), created_at: z.union([z.string(),z.date()]), updated_at: z.union([z.string(),z.date()]),
  recipient_count: z.coerce.number().int().nonnegative(), queued_count: z.coerce.number().int().nonnegative(),
  sent_count: z.coerce.number().int().nonnegative(), failed_count: z.coerce.number().int().nonnegative(), reconciliation_count: z.coerce.number().int().nonnegative(),
});

function iso(v: string|Date|null){ return v instanceof Date ? v.toISOString() : v; }
function actorDigest(actor:string){ return createHash("sha256").update("ccpun-admin-actor-v1\0").update(actor).digest("hex"); }
async function adminSql(vars:Record<string,string|undefined>=process.env){
  const runtime=resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(vars));
  const cs=vars.CCPUN_ADMIN_DATABASE_URL?.trim(); if(!runtime||!cs) return null;
  return neon(cs,{fetchOptions:{signal:AbortSignal.timeout(5000)}});
}

export function lineCampaignProviderEnabled(vars:Record<string,string|undefined>=process.env){
  return vars.CCPUN_LINE_CAMPAIGN_SEND_ENABLED?.trim()==="true" && Boolean(vars.CCPUN_LINE_CHANNEL_ACCESS_TOKEN?.trim()) && Boolean(vars.CCPUN_LINE_ENCRYPTION_KEY_V1?.trim());
}

export async function listLineCampaigns(vars:Record<string,string|undefined>=process.env){
  const sql=await adminSql(vars); if(!sql) throw new Error("CAMPAIGN_RUNTIME_NOT_READY");
  const rows=z.array(campaignRowSchema).parse(await sql.query(`SELECT campaign_id::text,campaign_code,title,status,journey,content_id,tool_id,copy_text,copy_version,segment,scheduled_start_at,scheduled_end_at,approved_at,created_at,updated_at,recipient_count,queued_count,sent_count,failed_count,reconciliation_count FROM private_line.admin_read_line_campaigns($1::integer)`,[100]));
  return rows.map(r=>({campaignId:r.campaign_id,campaignCode:r.campaign_code,title:r.title,status:r.status,journey:r.journey,contentId:r.content_id,toolId:r.tool_id,copyText:r.copy_text,copyVersion:r.copy_version,segment:r.segment,scheduledStartAt:iso(r.scheduled_start_at),scheduledEndAt:iso(r.scheduled_end_at),approvedAt:iso(r.approved_at),createdAt:iso(r.created_at)??"",updatedAt:iso(r.updated_at)??"",recipientCount:r.recipient_count,queuedCount:r.queued_count,sentCount:r.sent_count,failedCount:r.failed_count,reconciliationCount:r.reconciliation_count}));
}

export async function saveLineCampaign(input:unknown,actor:string,vars:Record<string,string|undefined>=process.env){
  const parsed=campaignInputSchema.safeParse(input); if(!parsed.success) throw new Error("CAMPAIGN_INVALID");
  const sql=await adminSql(vars); if(!sql) throw new Error("CAMPAIGN_RUNTIME_NOT_READY");
  const p=parsed.data; const rows=await sql.query(`SELECT outcome,campaign_id::text FROM private_line.admin_upsert_line_campaign($1::jsonb)`,[JSON.stringify({campaign_id:p.campaignId??null,campaign_code:p.campaignCode,title:p.title,journey:p.journey??null,content_id:p.contentId??null,tool_id:p.toolId??null,copy_text:p.copyText,segment:p.segment,scheduled_start_at:p.scheduledStartAt??null,scheduled_end_at:p.scheduledEndAt??null,actor_digest:actorDigest(actor)})]) as Array<{outcome?:unknown;campaign_id?:unknown}>;
  if(rows[0]?.outcome!=="saved"||typeof rows[0]?.campaign_id!=="string") throw new Error("CAMPAIGN_SAVE_FAILED");
  return {outcome:"saved" as const,campaignId:rows[0].campaign_id};
}

async function campaignMutation(fn:string,campaignId:string,actor:string,vars:Record<string,string|undefined>){
  if(!z.string().uuid().safeParse(campaignId).success) throw new Error("CAMPAIGN_INVALID");
  const sql=await adminSql(vars); if(!sql) throw new Error("CAMPAIGN_RUNTIME_NOT_READY");
  return sql.query(`SELECT * FROM private_line.${fn}($1::jsonb)`,[JSON.stringify({campaign_id:campaignId,actor_digest:actorDigest(actor)})]);
}
export async function approveLineCampaign(id:string,actor:string,vars:Record<string,string|undefined>=process.env){ const rows=await campaignMutation("admin_approve_line_campaign",id,actor,vars) as Array<{outcome?:unknown}>; if(rows[0]?.outcome!=="approved") throw new Error("CAMPAIGN_APPROVE_FAILED"); return {outcome:"approved" as const}; }
export async function enqueueLineCampaign(id:string,actor:string,vars:Record<string,string|undefined>=process.env){ const rows=await campaignMutation("admin_enqueue_line_campaign",id,actor,vars) as Array<{outcome?:unknown;queued_count?:unknown}>; if(rows[0]?.outcome!=="queued") throw new Error("CAMPAIGN_ENQUEUE_FAILED"); return {outcome:"queued" as const,queuedCount:Number(rows[0]?.queued_count??0),providerSendEnabled:lineCampaignProviderEnabled(vars)}; }
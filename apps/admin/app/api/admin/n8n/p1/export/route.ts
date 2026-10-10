import {createHash, randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {z} from "zod";
import {getAdminIdentity} from "@/lib/admin/identity";
import {getAdminEnvironment} from "@/lib/admin/environment";
import {isPostPublishAdminOriginAllowed} from "@/lib/admin/seo-intelligence/post-publish-origin";
import {resolveUatFabricConfig} from "@/lib/admin/n8n/uat-fabric-policy";
import {createAgentRuntimeJob,updateAgentRuntimeJob} from "@/lib/admin/operations/agent-os-runtime";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow, noarchive","X-Content-Type-Options":"nosniff"};
const input=z.object({action:z.literal("uat-synthetic-export")}).strict();
const UAT_SHEET_ID="1OO0nTbrq1J2vPUQtsPaZ6bTzWCpHC9sOtMR9yFKq2Rw";
const receipt=z.object({
 status:z.literal("completed"), environment:z.literal("admin-uat"),
 jobId:z.string().uuid(),correlationId:z.string().uuid(),
 n8nExecutionId:z.string().regex(/^[1-9][0-9]{0,159}$/),
 receiptVerified:z.literal(true),providerWrites:z.literal(1),
 updatedRows:z.literal(3),spreadsheetId:z.literal(UAT_SHEET_ID),synthetic:z.literal(true),
}).strict();

export async function POST(request:Request){
 const identity=await getAdminIdentity();
 if(!identity)return NextResponse.json({error:"unauthorized"},{status:401,headers});
 if(identity.role!=="owner")return NextResponse.json({error:"forbidden"},{status:403,headers});
 if(!isPostPublishAdminOriginAllowed(request,process.env,getAdminEnvironment()))return NextResponse.json({error:"invalid-origin"},{status:403,headers});
 const config=resolveUatFabricConfig(process.env);
 if(!config.ready||config.endpoint.pathname!=="/webhook/ccpun-p1-uat-seo-clustering")return NextResponse.json({error:"uat-export-disabled"},{status:503,headers});
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return NextResponse.json({error:"unsupported-media-type"},{status:415,headers});
 const raw=await request.text();
 if(Buffer.byteLength(raw,"utf8")>512)return NextResponse.json({error:"payload-too-large"},{status:413,headers});
 let body:unknown;
 try{body=JSON.parse(raw);}catch{return NextResponse.json({error:"invalid-json"},{status:400,headers});}
 if(!input.safeParse(body).success)return NextResponse.json({error:"invalid-export-input"},{status:400,headers});
 const key=request.headers.get("idempotency-key")?.trim();
 if(!key||!z.string().uuid().safeParse(key).success)return NextResponse.json({error:"idempotency-key-required"},{status:400,headers});
 const correlationId=randomUUID(),requestId=randomUUID();
 const digest=createHash("sha256").update("ccpun-p1-uat-synthetic-export-v1").digest("hex");
 let job;
 try{
  job=await createAgentRuntimeJob({correlationId,requestId,idempotencyKey:"exports.uat."+key,payloadDigestSha256:digest,source:"admin",action:"export.google_sheet.uat",workflowKey:"exports.google_sheet.uat",stage:"accepted",queueClass:"normal",maxAttempts:2});
 }catch{return NextResponse.json({error:"job-unavailable"},{status:503,headers});}
 if(job.outcome==="idempotency_conflict")return NextResponse.json({error:"idempotency-conflict"},{status:409,headers});
 if(job.outcome==="duplicate")return NextResponse.json({status:"duplicate",jobId:job.jobId,jobPath:`/operations/jobs/${job.jobId}/`},{status:200,headers});
 const webhook=new URL(config.endpoint);
 webhook.pathname="/webhook/ccpun-p1-uat-owner-export";
 let response:Response;
 try{
  response=await fetch(webhook,{method:"POST",headers:{"Authorization":`Bearer ${config.token}`,"Content-Type":"application/json"},body:JSON.stringify({environment:"admin-uat",action:"uat-synthetic-export",jobId:job.jobId,correlationId}),redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)});
 }catch{
  await updateAgentRuntimeJob({jobId:job.jobId,expectedVersion:job.rowVersion,status:"reconciliation_required",stage:"uat-export-uncertain",errorCategory:"n8n-trigger-unknown"}).catch(()=>null);
  return NextResponse.json({error:"uat-export-uncertain",jobId:job.jobId},{status:503,headers});
 }
 if(!response.ok){
  await updateAgentRuntimeJob({jobId:job.jobId,expectedVersion:job.rowVersion,status:"failed",stage:"uat-export-rejected",errorCategory:`n8n-http-${response.status}`}).catch(()=>null);
  return NextResponse.json({error:"uat-export-rejected",jobId:job.jobId},{status:503,headers});
 }
 const parsed=receipt.safeParse(await response.json().catch(()=>null));
 if(!parsed.success||parsed.data.jobId!==job.jobId||parsed.data.correlationId!==correlationId){
  await updateAgentRuntimeJob({jobId:job.jobId,expectedVersion:job.rowVersion,status:"reconciliation_required",stage:"uat-export-receipt-unverified",errorCategory:"n8n-export-receipt-invalid"}).catch(()=>null);
  return NextResponse.json({error:"uat-export-receipt-unverified",jobId:job.jobId},{status:503,headers});
 }
 try{
  const updated=await updateAgentRuntimeJob({jobId:job.jobId,expectedVersion:job.rowVersion,status:"completed",stage:"uat-synthetic-sheet-written",n8nExecutionId:parsed.data.n8nExecutionId,providerReference:"uat-sheet:"+UAT_SHEET_ID,completedAt:new Date().toISOString()});
  if(updated.outcome!=="updated")return NextResponse.json({error:"job-update-unverified",jobId:job.jobId},{status:503,headers});
 }catch{return NextResponse.json({error:"job-update-unverified",jobId:job.jobId},{status:503,headers});}
 return NextResponse.json({status:"completed",jobId:job.jobId,jobPath:`/operations/jobs/${job.jobId}/`,synthetic:true,updatedRows:3},{status:200,headers});
}
export function GET(){return new NextResponse(null,{status:404,headers});}

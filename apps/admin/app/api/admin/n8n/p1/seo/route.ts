import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentity } from "@/lib/admin/identity";
import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { resolveUatFabricConfig } from "@/lib/admin/n8n/uat-fabric-policy";
import { readScopedUatAck } from "@/lib/admin/n8n/uat-receipt";
import { createAgentRuntimeJob, updateAgentRuntimeJob } from "@/lib/admin/operations/agent-os-runtime";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow, noarchive"};
const input=z.object({keywords:z.array(z.string().trim().min(2).max(90).regex(/^[\p{L}\p{N} ._-]+$/u)).min(1).max(8)}).strict();
export async function POST(request:Request){
 const identity=await getAdminIdentity();
 if(!identity)return NextResponse.json({error:"unauthorized"},{status:401,headers});
 if(identity.role!=="owner")return NextResponse.json({error:"forbidden"},{status:403,headers});
 if(!isSameOriginAdminMutation(request.url,request.headers.get("origin")))return NextResponse.json({error:"invalid-origin"},{status:403,headers});
 const config=resolveUatFabricConfig(process.env);
 if(!config.ready || !config.endpoint.pathname.includes("seo-clustering"))return NextResponse.json({error:"uat-fabric-unavailable"},{status:503,headers});
 if(!request.headers.get("content-type")?.startsWith("application/json"))return NextResponse.json({error:"unsupported-media-type"},{status:415,headers});
 const raw=await request.text();
 if(Buffer.byteLength(raw)>2048)return NextResponse.json({error:"payload-too-large"},{status:413,headers});
 let data:unknown;try{data=JSON.parse(raw)}catch{return NextResponse.json({error:"invalid-json"},{status:400,headers})}
 const parsed=input.safeParse(data);if(!parsed.success)return NextResponse.json({error:"invalid-input"},{status:400,headers});
 const key=request.headers.get("idempotency-key")?.trim();
 if(!key || !z.string().uuid().safeParse(key).success)return NextResponse.json({error:"idempotency-key-required"},{status:400,headers});
 const correlationId=randomUUID(),requestId=randomUUID();
 const digest=createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
 let job;
 try{job=await createAgentRuntimeJob({correlationId,requestId,idempotencyKey:`seo.uat.${key}`,payloadDigestSha256:digest,source:"admin",action:"seo.cluster.uat",workflowKey:"seo.cluster.uat",stage:"accepted",queueClass:"normal",maxAttempts:2})}
 catch{return NextResponse.json({error:"job-unavailable"},{status:503,headers})}
 if(job.outcome==="idempotency_conflict")return NextResponse.json({error:"idempotency-conflict"},{status:409,headers});
 if(job.outcome==="duplicate")return NextResponse.json({status:"duplicate",jobId:job.jobId,jobPath:`/operations/jobs/${job.jobId}/`},{status:200,headers});
 try{
  const response=await fetch(config.endpoint,{method:"POST",headers:{Authorization:`Bearer ${config.token}`,"Content-Type":"application/json"},body:JSON.stringify({jobId:job.jobId,correlationId,environment:"admin-uat",keywords:parsed.data.keywords}),redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!response.ok){await updateAgentRuntimeJob({jobId:job.jobId,expectedVersion:job.rowVersion,status:"failed",stage:"trigger-rejected",errorCategory:`n8n-http-${response.status}`}).catch(()=>null);return NextResponse.json({error:"trigger-rejected",jobId:job.jobId},{status:503,headers})}
  const ack=readScopedUatAck(await response.json().catch(()=>null),{jobId:job.jobId,correlationId});
  if(!ack){await updateAgentRuntimeJob({jobId:job.jobId,expectedVersion:job.rowVersion,status:"reconciliation_required",stage:"receipt-unverified",errorCategory:"n8n-ack-invalid"}).catch(()=>null);return NextResponse.json({error:"receipt-unverified",jobId:job.jobId},{status:503,headers})}
  // A webhook receipt only confirms n8n received the job. It is not proof
  // that SEO analysis or a provider operation has finished.
  const persisted=await updateAgentRuntimeJob({jobId:job.jobId,expectedVersion:job.rowVersion,status:"waiting_external",stage:"n8n-received",n8nExecutionId:ack.n8nExecutionId,startedAt:new Date().toISOString()}).catch(()=>null);
  if(persisted?.outcome!=="updated")return NextResponse.json({error:"job-status-unverified",jobId:job.jobId},{status:503,headers});
  return NextResponse.json({status:"accepted",jobId:job.jobId,jobPath:`/operations/jobs/${job.jobId}/`},{status:202,headers});
 }catch{await updateAgentRuntimeJob({jobId:job.jobId,expectedVersion:job.rowVersion,status:"reconciliation_required",stage:"trigger-uncertain",errorCategory:"n8n-trigger-unknown"}).catch(()=>null);return NextResponse.json({error:"trigger-uncertain",jobId:job.jobId},{status:503,headers})}
}

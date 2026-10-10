import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyScopedUatCapability } from "@/lib/admin/n8n/uat-callback-capability";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { readAgentRuntimeJobById, updateAgentRuntimeJob } from "@/lib/admin/operations/agent-os-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};
const inputSchema = z.object({
  environment: z.literal("admin-uat"),
  workflowKey: z.literal("seo.cluster.uat"),
  jobId: z.string().uuid(),
  correlationId: z.string().uuid(),
  n8nExecutionId: z.string().regex(/^[1-9][0-9]{0,159}$/),
  result: z.literal("synthetic-public-safe-validated"),
  keywordCount: z.number().int().min(1).max(8),
  clusterCount: z.number().int().min(1).max(8),
  providerWrites: z.literal(false),
}).strict();

/** A narrow UAT-only callback. It cannot mutate content, CRM or unrelated jobs. */
export async function POST(request: Request) {
  if (getAdminEnvironment() !== "admin-uat" || process.env.CCPUN_N8N_P1_UAT_ENABLED !== "true") {
    return NextResponse.json({error:"not-found"}, {status:404,headers});
  }
  // This narrow UAT callback accepts only per-job signed capabilities.
  // It never enables the general Agent OS n8n service token gateway.
  if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.json({error:"unauthorized"}, {status:401,headers});
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({error:"unsupported-media-type"}, {status:415,headers});
  }
  const raw=await request.text();
  if (Buffer.byteLength(raw,"utf8")>2048) return NextResponse.json({error:"payload-too-large"},{status:413,headers});
  let value:unknown;
  try {value=JSON.parse(raw);} catch {return NextResponse.json({error:"invalid-json"},{status:400,headers});}
  const parsed=inputSchema.safeParse(value);
  if (!parsed.success) return NextResponse.json({error:"invalid-callback"},{status:400,headers});
  const authorized=verifyScopedUatCapability({
    authorization:request.headers.get("authorization"),jobId:parsed.data.jobId,
    correlationId:parsed.data.correlationId,secret:process.env.CCPUN_N8N_P1_UAT_TOKEN?.trim()??"",
  });
  if(!authorized)return NextResponse.json({error:"unauthorized"},{status:401,headers});
  try {
    const result=await readAgentRuntimeJobById(parsed.data.jobId);
    if (result.state !== "ready") return NextResponse.json({error:"job-unavailable"},{status:503,headers:{...headers,"Retry-After":"10"}});
    const job=result.job;
    if (!job || job.workflowKey !== parsed.data.workflowKey || job.source !== "admin"
      || job.correlationId !== parsed.data.correlationId || job.n8nExecutionId !== parsed.data.n8nExecutionId) {
      return NextResponse.json({error:"unmatched-job"},{status:403,headers});
    }
    if (job.status === "completed" && job.stage === "seo.uat.synthetic-verified") {
      return NextResponse.json({status:"duplicate",jobId:job.jobId},{status:200,headers});
    }
    if (job.status !== "waiting_external" || job.stage !== "n8n-received") {
      return NextResponse.json({error:"state-conflict"},{status:409,headers});
    }
    const done=await updateAgentRuntimeJob({
      jobId:job.jobId,
      expectedVersion:job.rowVersion,
      status:"completed",stage:"seo.uat.synthetic-verified",
      n8nExecutionId:parsed.data.n8nExecutionId,
      providerReference:`uat-seo-clusters-${parsed.data.clusterCount}-keywords-${parsed.data.keywordCount}`,
      completedAt:new Date().toISOString(),
    });
    if(done.outcome!=="updated")return NextResponse.json({error:"stale-callback"},{status:409,headers});
    return NextResponse.json({status:"completed",jobId:job.jobId,rowVersion:done.rowVersion},{status:200,headers});
  } catch {
    return NextResponse.json({error:"job-unavailable"},{status:503,headers:{...headers,"Retry-After":"10"}});
  }
}
export function GET(){return new NextResponse(null,{status:404,headers});}

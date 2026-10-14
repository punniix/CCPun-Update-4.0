import { NextResponse } from "next/server";
import { z } from "zod";

import { readLocalAiJob } from "@/lib/admin/local-ai/database";
import { isN8nLocalAiRequestAuthorized } from "@/lib/admin/local-ai/service-auth";
import { localAiJobStatusSchema, localAiReviewStatusSchema, parseLocalAiTaskOutput } from "@/lib/local-ai/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isN8nLocalAiRequestAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: responseHeaders });
  try {
    const jobId = z.string().uuid().transform((value) => value.toLowerCase()).safeParse((await params).jobId);
    if (!jobId.success) return NextResponse.json({ error: "not-found" }, { status: 404, headers: responseHeaders });
    const job = await readLocalAiJob(jobId.data);
    if (!job || job.id !== jobId.data || job.dataClass !== "public-safe"
      || (job.taskType !== "content-operations" && job.taskType !== "seo-preprocessing")) {
      return NextResponse.json({ error: "not-found" }, { status: 404, headers: responseHeaders });
    }
    const status = localAiJobStatusSchema.parse(job.status);
    const reviewStatus = localAiReviewStatusSchema.nullable().parse(job.reviewStatus);
    let output: unknown = null;
    if (status === "succeeded" && reviewStatus === "approved") {
      const validated = parseLocalAiTaskOutput(job.taskType, job.output);
      if (!validated.success) throw new Error("LOCAL_AI_STORED_OUTPUT_INVALID");
      output = validated.data;
    }
    return NextResponse.json({
      jobId: job.id, taskType: job.taskType, dataClass: job.dataClass, status,
      output,
      errorCategory: ["failed", "reconciliation-required"].includes(job.status) ? job.errorCategory : null,
      updatedAt: job.updatedAt,
    }, { headers: { ...responseHeaders, ...(job.status === "queued" || job.status === "leased" ? { "Retry-After": "3" } : {}) } });
  } catch {
    return NextResponse.json({ error: "local-ai-unavailable" }, { status: 503, headers: responseHeaders });
  }
}

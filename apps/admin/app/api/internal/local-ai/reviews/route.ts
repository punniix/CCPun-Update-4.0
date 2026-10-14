import { NextResponse } from "next/server";
import { z } from "zod";

import { readLocalAiJob } from "@/lib/admin/local-ai/database";
import { isN8nLocalAiRequestAuthorized } from "@/lib/admin/local-ai/service-auth";
import { localAiJobStatusSchema, localAiReviewStatusSchema, parseLocalAiTaskOutput } from "@/lib/local-ai/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-cache, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
const jobIdSchema = z.string().uuid().transform((id) => id.toLowerCase());

export async function GET(request: Request) {
  if (!isN8nLocalAiRequestAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    const requestedId = jobIdSchema.safeParse(new URL(request.url).searchParams.get("jobId") ?? "");
    if (!requestedId.success) return NextResponse.json({ error: "not-found" }, { status: 404, headers });
    const job = await readLocalAiJob(requestedId.data);
    if (!job || job.dataClass !== "public-safe" || (job.taskType !== "content-operations" && job.taskType !== "seo-preprocessing")) {
      return NextResponse.json({ error: "not-found" }, { status: 404, headers });
    }
    if (jobIdSchema.parse(job.id) !== requestedId.data) throw new Error("LOCAL_AI_JOB_ID_MISMATCH");
    localAiJobStatusSchema.parse(job.status);
    localAiReviewStatusSchema.nullable().parse(job.reviewStatus);
    let output: unknown = null;
    if (job.status === "succeeded" && job.reviewStatus === "approved") {
      const parsed = parseLocalAiTaskOutput(job.taskType, job.output);
      if (!parsed.success) throw new Error("LOCAL_AI_OUTPUT_INVALID");
      output = parsed.data;
    }
    const waiting = job.status === "succeeded" && job.reviewStatus === "pending";
    return NextResponse.json({
      jobId: requestedId.data, taskType: job.taskType, status: waiting ? "awaiting-review" : job.status,
      reviewStatus: job.reviewStatus, output,
      errorCategory: ["failed", "reconciliation-required"].includes(job.status) ? "local-ai-job-failed" : null,
      updatedAt: job.updatedAt,
    }, { headers: { ...headers, ...(job.status === "queued" || job.status === "leased" || waiting ? { "Retry-After": "3" } : {}) } });
  } catch {
    return NextResponse.json({ error: "local-ai-unavailable", retryable: true }, { status: 503, headers: { ...headers, "Retry-After": "30" } });
  }
}

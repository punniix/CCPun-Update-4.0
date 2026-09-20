import { NextResponse } from "next/server";

import { readLocalAiJob } from "@/lib/admin/local-ai/database";
import { isN8nLocalAiRequestAuthorized } from "@/lib/admin/local-ai/service-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-cache, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };

export async function GET(request: Request) {
  if (!isN8nLocalAiRequestAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    const job = await readLocalAiJob(new URL(request.url).searchParams.get("jobId") ?? "");
    if (!job || job.dataClass !== "public-safe") return NextResponse.json({ error: "not-found" }, { status: 404, headers });
    const waiting = job.status === "succeeded" && job.reviewStatus === "pending";
    return NextResponse.json({
      jobId: job.id, taskType: job.taskType, status: waiting ? "awaiting-review" : job.status,
      reviewStatus: job.reviewStatus, output: job.reviewStatus === "approved" ? job.output : null,
      errorCategory: ["failed", "reconciliation-required"].includes(job.status) ? job.errorCategory : null,
      updatedAt: job.updatedAt,
    }, { headers: { ...headers, ...(job.status === "queued" || job.status === "leased" || waiting ? { "Retry-After": "3" } : {}) } });
  } catch {
    return NextResponse.json({ error: "local-ai-unavailable", retryable: true }, { status: 503, headers: { ...headers, "Retry-After": "30" } });
  }
}

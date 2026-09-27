import { NextResponse } from "next/server";

import { readLocalAiJob } from "@/lib/admin/local-ai/database";
import { isN8nLocalAiRequestAuthorized } from "@/lib/admin/local-ai/service-auth";

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
    const job = await readLocalAiJob((await params).jobId);
    if (!job) return NextResponse.json({ error: "not-found" }, { status: 404, headers: responseHeaders });
    return NextResponse.json({
      jobId: job.id, taskType: job.taskType, dataClass: job.dataClass, status: job.status,
      output: job.status === "succeeded" ? job.output : null,
      errorCategory: ["failed", "reconciliation-required"].includes(job.status) ? job.errorCategory : null,
      updatedAt: job.updatedAt,
    }, { headers: { ...responseHeaders, ...(job.status === "queued" || job.status === "leased" ? { "Retry-After": "3" } : {}) } });
  } catch {
    return NextResponse.json({ error: "local-ai-unavailable" }, { status: 503, headers: responseHeaders });
  }
}

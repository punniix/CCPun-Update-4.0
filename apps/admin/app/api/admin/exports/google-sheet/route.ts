import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { exportSelectionSchema } from "@/lib/admin/agent-os/export-contract";
import { resolveGoogleSheetExportRuntime } from "@/lib/admin/agent-os/export-runtime";
import { getAdminIdentity } from "@/lib/admin/identity";
import { createAgentRuntimeJob, updateAgentRuntimeJob } from "@/lib/admin/operations/agent-os-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

const bodySchema = exportSelectionSchema;

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }
  const exportRuntime = resolveGoogleSheetExportRuntime(process.env);
  if (!exportRuntime.ready) {
    const error = exportRuntime.reason === "uat-disabled" || exportRuntime.reason === "uat-webhook-not-isolated"
      ? "google-sheet-export-uat-isolated"
      : exportRuntime.reason === "not-configured"
        ? "google-sheet-export-not-configured"
        : "google-sheet-export-disabled";
    return NextResponse.json({ error }, { status: 503, headers });
  }

  let value: unknown;
  try { value = await request.json(); }
  catch { return NextResponse.json({ error: "invalid-json" }, { status: 400, headers }); }
  const parsed = bodySchema.safeParse(value);
  if (!parsed.success) return NextResponse.json({ error: "invalid-export-request" }, { status: 400, headers });

  const { webhook, token } = exportRuntime;

  const generatedAt = new Date().toISOString();
  const correlationId = randomUUID();
  const requestId = randomUUID();
  const idempotencyKey = "export.google-sheet." + randomUUID();
  const payloadDigestSha256 = createHash("sha256")
    .update(JSON.stringify({ ...parsed.data, generatedAt }))
    .digest("hex");

  let job;
  try {
    job = await createAgentRuntimeJob({
      correlationId,
      requestId,
      idempotencyKey,
      payloadDigestSha256,
      source: "admin",
      action: "export.google_sheet",
      workflowKey: "exports.google_sheet",
      stage: "accepted",
      queueClass: "normal",
      maxAttempts: 2,
    });
  } catch {
    return NextResponse.json({ error: "agent-os-runtime-not-ready" }, { status: 503, headers });
  }

  let response: Response;
  try {
    response = await fetch(webhook, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId: job.jobId,
        rowVersion: job.rowVersion,
        correlationId: job.correlationId,
        requestId: job.requestId,
        dataset: parsed.data.dataset,
        ...(parsed.data.view ? { view: parsed.data.view } : {}),
        generatedAt,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    await updateAgentRuntimeJob({
      jobId: job.jobId,
      expectedVersion: job.rowVersion,
      status: "reconciliation_required",
      stage: "trigger-uncertain",
      errorCategory: "n8n-trigger-outcome-unknown",
    }).catch(() => null);
    return NextResponse.json({ error: "google-sheet-export-trigger-uncertain", jobId: job.jobId }, { status: 503, headers });
  }

  if (!response.ok) {
    await updateAgentRuntimeJob({
      jobId: job.jobId,
      expectedVersion: job.rowVersion,
      status: "failed",
      stage: "trigger-rejected",
      errorCategory: `n8n-trigger-rejected-${response.status}`,
      completedAt: new Date().toISOString(),
    }).catch(() => null);
    return NextResponse.json({ error: "google-sheet-export-trigger-failed", jobId: job.jobId }, { status: 503, headers });
  }

  return NextResponse.json({
    status: "accepted",
    jobId: job.jobId,
    runtimePath: `/operations/jobs/${job.jobId}/`,
  }, { status: 202, headers });
}

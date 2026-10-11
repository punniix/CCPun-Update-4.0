import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { readAgentRuntimeJobDetail } from "@/lib/admin/operations/agent-os-runtime-detail";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { isPostPublishAdminOriginAllowed } from "@/lib/admin/seo-intelligence/post-publish-origin";
import { readAgentRuntimeJobById, updateAgentRuntimeJob } from "@/lib/admin/operations/agent-os-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (!hasAdminPermission(identity.role, "settings:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }

  const jobId = (await params).jobId;
  if (!z.string().uuid().safeParse(jobId).success) {
    return NextResponse.json({ error: "invalid-job-id" }, { status: 400, headers });
  }

  const result = await readAgentRuntimeJobDetail(jobId);
  if (result.state === "not_found") {
    return NextResponse.json({ error: "not-found" }, { status: 404, headers });
  }
  if (result.state !== "ready" || !result.detail) {
    return NextResponse.json(
      { error: "runtime-unavailable", retryable: true },
      { status: 503, headers: { ...headers, "Retry-After": "5" } },
    );
  }

  return NextResponse.json(result.detail, { headers });
}


const timeoutSchema = z.object({
  action: z.literal("reconcile-seo-callback-timeout"),
  expectedVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict();

/** Owner reconciliation changes only expired UAT job metadata; it never redispatches. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const environment = getAdminEnvironment();
  if (environment !== "admin-uat" || process.env.CCPUN_N8N_P1_UAT_ENABLED !== "true") {
    return NextResponse.json({ error: "not-found" }, { status: 404, headers });
  }
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (!isPostPublishAdminOriginAllowed(request, process.env, environment)) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }
  const jobId = (await params).jobId;
  if (!z.string().uuid().safeParse(jobId).success) {
    return NextResponse.json({ error: "invalid-job-id" }, { status: 400, headers });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported-media-type" }, { status: 415, headers });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 1024) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  }
  let value: unknown;
  try { value = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400, headers });
  }
  const parsed = timeoutSchema.safeParse(value);
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });
  try {
    const result = await readAgentRuntimeJobById(jobId);
    if (result.state !== "ready") throw new Error("runtime-unavailable");
    const job = result.job;
    if (!job) return NextResponse.json({ error: "not-found" }, { status: 404, headers });
    if (job.rowVersion !== parsed.data.expectedVersion) {
      return NextResponse.json({ error: "stale-version" }, { status: 409, headers });
    }
    const startedAt = job.startedAt ? Date.parse(job.startedAt) : NaN;
    // ponytail: explicit owner reconciliation; no second executor or automatic effect retry.
    if (job.source !== "admin" || job.action !== "seo.cluster.uat" || job.workflowKey !== "seo.cluster.uat"
      || job.status !== "waiting_external" || !["n8n-dispatching", "n8n-received"].includes(job.stage)
      || !Number.isFinite(startedAt) || Date.now() - startedAt <= 601_000) {
      return NextResponse.json({ error: "not-reconcilable" }, { status: 409, headers });
    }
    const updated = await updateAgentRuntimeJob({
      jobId, expectedVersion: parsed.data.expectedVersion,
      status: "reconciliation_required", stage: "seo.uat.callback-timeout", errorCategory: "n8n-callback-timeout",
    });
    if (updated.outcome !== "updated") {
      return NextResponse.json({ error: "stale-version" }, { status: 409, headers });
    }
    return NextResponse.json({ status: "reconciliation_required", jobId, rowVersion: updated.rowVersion }, { headers });
  } catch {
    return NextResponse.json({ error: "runtime-unavailable", retryable: true },
      { status: 503, headers: { ...headers, "Retry-After": "5" } });
  }
}

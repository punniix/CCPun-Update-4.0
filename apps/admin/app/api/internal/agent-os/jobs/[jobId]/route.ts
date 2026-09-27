import { NextResponse } from "next/server";
import { z } from "zod";

import { agentOsJobStatusSchema } from "@/lib/admin/operations/agent-os-job-contract";
import { updateAgentRuntimeJob } from "@/lib/admin/operations/agent-os-runtime";
import { isN8nAgentOsRequestAuthorized } from "@/lib/admin/agent-os/service-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

const bodySchema = z.object({
  expectedVersion: z.number().int().positive(),
  status: agentOsJobStatusSchema.optional(),
  stage: z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,159}$/).optional(),
  attempt: z.number().int().min(0).max(20).optional(),
  heartbeatAt: z.string().datetime().nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  n8nExecutionId: z.string().trim().min(1).max(160).nullable().optional(),
  providerReference: z.string().trim().min(1).max(200).nullable().optional(),
  errorCategory: z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,159}$/).nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  queueWaitMs: z.number().int().nonnegative().nullable().optional(),
}).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!isN8nAgentOsRequestAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }

  const jobId = (await params).jobId;
  if (!z.string().uuid().safeParse(jobId).success) {
    return NextResponse.json({ error: "invalid-job-id" }, { status: 400, headers });
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported-media-type" }, { status: 415, headers });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 4_096) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400, headers });
  }

  const parsed = bodySchema.safeParse(value);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-job-metadata" }, { status: 400, headers });
  }

  try {
    const result = await updateAgentRuntimeJob({ jobId, ...parsed.data });
    if (result.outcome === "not_found") {
      return NextResponse.json({ error: "not-found" }, { status: 404, headers });
    }
    if (result.outcome === "conflict") {
      return NextResponse.json(
        { error: "stale-version", rowVersion: result.rowVersion },
        { status: 409, headers },
      );
    }
    if (result.outcome === "terminal") {
      return NextResponse.json(
        { error: "terminal-job", rowVersion: result.rowVersion },
        { status: 409, headers },
      );
    }
    return NextResponse.json(
      { status: "updated", jobId, rowVersion: result.rowVersion },
      { status: 200, headers },
    );
  } catch {
    return NextResponse.json(
      { error: "agent-os-runtime-unavailable", retryable: true },
      { status: 503, headers: { ...headers, "Retry-After": "30" } },
    );
  }
}

export function GET() {
  return new NextResponse(null, { status: 404, headers });
}

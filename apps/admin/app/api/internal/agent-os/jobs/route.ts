import { NextResponse } from "next/server";
import { z } from "zod";

import { agentOsQueueClassSchema } from "@/lib/admin/operations/agent-os-job-contract";
import { createAgentRuntimeJob } from "@/lib/admin/operations/agent-os-runtime";
import { isN8nAgentOsRequestAuthorized } from "@/lib/admin/agent-os/service-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

const bodySchema = z.object({
  correlationId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{15,159}$/),
  payloadDigestSha256: z.string().regex(/^[0-9a-f]{64}$/),
  action: z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,159}$/),
  workflowKey: z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,159}$/),
  stage: z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,159}$/),
  queueClass: agentOsQueueClassSchema,
  maxAttempts: z.number().int().min(1).max(20).optional(),
  n8nExecutionId: z.string().trim().min(1).max(160).optional(),
  providerReference: z.string().trim().min(1).max(200).optional(),
}).strict();

export async function POST(request: Request) {
  if (!isN8nAgentOsRequestAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported-media-type" }, { status: 415, headers });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 8_192) {
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
    const result = await createAgentRuntimeJob({
      ...parsed.data,
      source: "n8n",
    });

    if (result.outcome === "idempotency_conflict") {
      return NextResponse.json(
        { error: "idempotency-conflict", jobId: result.jobId, correlationId: result.correlationId },
        { status: 409, headers },
      );
    }

    return NextResponse.json(
      {
        status: result.outcome,
        jobId: result.jobId,
        correlationId: result.correlationId,
        requestId: result.requestId,
        rowVersion: result.rowVersion,
      },
      { status: result.outcome === "created" ? 202 : 200, headers },
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

import { NextResponse } from "next/server";
import { z } from "zod";

import { enqueueLocalAiJob } from "@/lib/admin/local-ai/database";
import { isN8nLocalAiRequestAuthorized } from "@/lib/admin/local-ai/service-auth";
import { localAiQueueClassSchema, localAiTaskInputSchemas } from "@/lib/local-ai/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};
const common = { idempotencyKey: z.string().min(8).max(200), queueClass: localAiQueueClassSchema.optional() };
const bodySchema = z.discriminatedUnion("taskType", [
  z.object({ taskType: z.literal("content-operations"), payload: localAiTaskInputSchemas["content-operations"], ...common }).strict(),
  z.object({ taskType: z.literal("seo-preprocessing"), payload: localAiTaskInputSchemas["seo-preprocessing"], ...common }).strict(),
]);

export async function POST(request: Request) {
  if (!isN8nLocalAiRequestAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: responseHeaders });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported-media-type" }, { status: 415, headers: responseHeaders });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 40_000) return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers: responseHeaders });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid-json" }, { status: 400, headers: responseHeaders }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid-public-safe-job" }, { status: 400, headers: responseHeaders });
  try {
    const result = parsed.data.taskType === "content-operations"
      ? await enqueueLocalAiJob({ taskType: "content-operations", payload: parsed.data.payload, actor: "n8n", idempotencyKey: parsed.data.idempotencyKey, queueClass: parsed.data.queueClass })
      : await enqueueLocalAiJob({ taskType: "seo-preprocessing", payload: parsed.data.payload, actor: "n8n", idempotencyKey: parsed.data.idempotencyKey, queueClass: parsed.data.queueClass });
    return NextResponse.json(result, { status: result.reused ? 200 : 202, headers: responseHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "LOCAL_AI_BACKPRESSURE") {
      return NextResponse.json({ error: "local-ai-backpressure", retryable: true }, { status: 429, headers: { ...responseHeaders, "Retry-After": "30" } });
    }
    if (error instanceof Error && error.message === "LOCAL_AI_IDEMPOTENCY_CONFLICT") {
      return NextResponse.json({ error: "idempotency-conflict", retryable: false }, { status: 409, headers: responseHeaders });
    }
    return NextResponse.json({ error: "local-ai-unavailable" }, { status: 503, headers: responseHeaders });
  }
}

export function GET() {
  return new NextResponse(null, { status: 404, headers: responseHeaders });
}

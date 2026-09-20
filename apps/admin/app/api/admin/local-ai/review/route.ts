import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { reviewLocalAiJob } from "@/lib/admin/local-ai/database";
import { evaluateAdminAction } from "@/lib/admin/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  jobId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(1_000).optional(),
}).strict();

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  let suppliedOrigin: string | null = null;
  try { suppliedOrigin = origin ? new URL(origin).origin : null; } catch { /* malformed origins fail closed */ }
  if (!suppliedOrigin || suppliedOrigin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (identity.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const raw = contentType.startsWith("application/json")
    ? await request.json().catch(() => null)
    : Object.fromEntries(await request.formData().catch(() => new FormData()));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success || (parsed.data.decision === "reject" && !parsed.data.reason)) {
    return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  }

  const policy = evaluateAdminAction({
    actorType: identity.actorType,
    role: identity.role,
    action: parsed.data.decision === "approve" ? "review:approve" : "review:reject",
    environment: getAdminEnvironment(),
  });
  if (!policy.allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const reviewStatus = await reviewLocalAiJob({ ...parsed.data, actor: identity.actor });
    if (contentType.startsWith("application/json")) return NextResponse.json({ jobId: parsed.data.jobId, reviewStatus });
    return NextResponse.redirect(new URL("/operations/local-ai/", request.url), 303);
  } catch (error) {
    if (error instanceof Error && ["LOCAL_AI_REVIEW_CONFLICT", "LOCAL_AI_REVIEW_REASON_REQUIRED"].includes(error.message)) {
      return NextResponse.json({ error: "review-conflict" }, { status: 409 });
    }
    return NextResponse.json({ error: "local-ai-unavailable" }, { status: 503 });
  }
}

export function GET() {
  return new NextResponse(null, { status: 404 });
}

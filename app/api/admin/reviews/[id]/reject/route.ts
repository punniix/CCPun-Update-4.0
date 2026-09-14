import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { evaluateAdminAction } from "@/lib/admin/policy";
import { reviewSeoSuggestion } from "@/lib/admin/sanity-control";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ reason: z.string().min(1).max(2000) });

export async function POST(request: Request, context: RouteContext) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const policy = evaluateAdminAction({
    actorType: identity.actorType,
    role: identity.role,
    action: "review:reject",
    environment: getAdminEnvironment(),
  });
  if (!policy.allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const requestId = randomUUID();
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid-input", requestId }, { status: 400 });

  try {
    const result = await reviewSeoSuggestion({
      id: (await context.params).id,
      decision: "reject",
      reason: body.data.reason,
      reviewedBy: identity.actor,
      actorType: identity.actorType,
      requestId,
    });
    return NextResponse.json({ ...result, requestId });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_SUGGESTION_ID") return NextResponse.json({ error: "invalid-suggestion-id", requestId }, { status: 400 });
      if (["SANITY_WRITE_NOT_CONFIGURED", "ADMIN_DATABASE_NOT_CONFIGURED"].includes(error.message)) return NextResponse.json({ error: "write-token-required", requestId }, { status: 503 });
      if (error.message === "HUMAN_REVIEW_REQUIRED") return NextResponse.json({ error: "human-review-required", requestId }, { status: 403 });
      if (["SUGGESTION_STATUS_CONFLICT", "SUGGESTION_CONFLICT"].includes(error.message)) {
        return NextResponse.json({ error: "suggestion-conflict", requestId }, { status: 409 });
      }
      if (error.message === "SUGGESTION_NOT_FOUND") return NextResponse.json({ error: "suggestion-not-found", requestId }, { status: 404 });
    }
    return NextResponse.json({ error: "mutation-failed", requestId }, { status: 502 });
  }
}

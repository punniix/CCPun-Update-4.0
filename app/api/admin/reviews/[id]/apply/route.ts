import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { evaluateAdminAction } from "@/lib/admin/policy";
import { applyApprovedSeoSuggestion } from "@/lib/admin/sanity-control";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const policy = evaluateAdminAction({
    actorType: identity.actorType,
    role: identity.role,
    action: "draft:apply",
    environment: getAdminEnvironment(),
  });

  if (!policy.allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const requestId = randomUUID();

  try {
    const applied = await applyApprovedSeoSuggestion({
      id,
      appliedBy: identity.actor,
      actorType: identity.actorType,
      requestId,
    });

    return NextResponse.json({ ...applied, status: "applied", requestId });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_SUGGESTION_ID") {
        return NextResponse.json({ error: "invalid-suggestion-id", requestId }, { status: 400 });
      }
      if (["SANITY_WRITE_NOT_CONFIGURED", "ADMIN_DATABASE_NOT_CONFIGURED"].includes(error.message)) {
        return NextResponse.json({ error: "write-token-required", requestId }, { status: 503 });
      }
      if (error.message === "HUMAN_REVIEW_REQUIRED") {
        return NextResponse.json({ error: "human-review-required", requestId }, { status: 403 });
      }
      if (error.message === "SUGGESTION_STALE_BASE") {
        return NextResponse.json({ error: "suggestion-stale", requestId }, { status: 409 });
      }
      if (error.message === "APPLY_RECONCILIATION_REQUIRED") {
        return NextResponse.json({ error: "reconciliation-required", requestId }, { status: 409 });
      }
      if (["SUGGESTION_STATUS_CONFLICT", "SUGGESTION_CONFLICT", "SUGGESTION_APPROVAL_INCOMPLETE"].includes(error.message)) {
        return NextResponse.json({ error: "suggestion-conflict", requestId }, { status: 409 });
      }
      if (error.message === "SUGGESTION_RISK_TOO_HIGH") {
        return NextResponse.json({ error: "risk-too-high", requestId }, { status: 409 });
      }
      if (error.message === "SUGGESTION_TYPE_NOT_APPLYABLE") {
        return NextResponse.json({ error: "manual-apply-required", requestId }, { status: 409 });
      }
      if (error.message === "TARGET_DRAFT_NOT_FOUND") {
        return NextResponse.json({ error: "target-draft-not-found", requestId }, { status: 404 });
      }
      if (error.message === "SUGGESTION_NOT_FOUND") {
        return NextResponse.json({ error: "suggestion-not-found", requestId }, { status: 404 });
      }
    }
    return NextResponse.json({ error: "mutation-failed", requestId }, { status: 502 });
  }
}

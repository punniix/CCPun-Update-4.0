import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { evaluateAdminAction } from "@/lib/admin/policy";
import { runSeoAudit } from "@/lib/admin/seo-audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const environment = getAdminEnvironment();
  const policy = evaluateAdminAction({
    actorType: identity.actorType,
    role: identity.role,
    action: "seo:audit",
    environment,
  });
  if (!policy.allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const requestId = randomUUID();

  try {
    const result = await runSeoAudit(id, true, {
      actor: identity.actor,
      actorType: identity.actorType,
      requestId,
    });
    return NextResponse.json({ ...result, requestId });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_ARTICLE_ID") {
      return NextResponse.json({ error: "invalid-article-id", requestId }, { status: 400 });
    }
    if (error instanceof Error && error.message === "ARTICLE_NOT_FOUND") {
      return NextResponse.json({ error: "article-not-found", requestId }, { status: 404 });
    }
    if (error instanceof Error && error.message === "SEO_AUDIT_STALE") {
      return NextResponse.json({ error: "audit-stale", requestId }, { status: 409 });
    }
    if (error instanceof Error && error.message === "SEO_AUDIT_DRAFT_REQUIRED") {
      return NextResponse.json({ error: "audit-draft-required", requestId }, { status: 409 });
    }
    return NextResponse.json({ error: "audit-failed", requestId }, { status: 502 });
  }
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { evaluateAdminAction } from "@/lib/admin/policy";
import { createSeoSuggestion } from "@/lib/admin/sanity-control";

const bodySchema = z.object({
  targetDocumentId: z.string().min(1),
  type: z.enum(["seo-title", "meta-description", "primary-keyword", "secondary-keywords", "search-intent", "structure", "internal-links", "content"]),
  before: z.string().max(12000).optional(),
  after: z.string().min(1).max(12000),
  reason: z.string().min(1).max(8000),
  confidence: z.number().min(0).max(1),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
});

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const policy = evaluateAdminAction({
    actorType: identity.actorType,
    role: identity.role,
    action: "proposal:create",
    environment: getAdminEnvironment(),
  });

  if (!policy.allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  }

  const requestId = randomUUID();

  try {
    const suggestion = await createSeoSuggestion(
      {
        ...parsed.data,
        createdBy: identity.actor,
      },
      { actorType: identity.actorType, requestId },
    );

    return NextResponse.json({ id: suggestion._id, status: "needs-human-review", requestId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["SANITY_WRITE_NOT_CONFIGURED", "ADMIN_DATABASE_NOT_CONFIGURED"].includes(error.message)) {
      return NextResponse.json({ error: "write-token-required" }, { status: 503 });
    }
    if (error instanceof Error && error.message === "TARGET_DRAFT_NOT_FOUND") {
      return NextResponse.json({ error: "target-draft-not-found" }, { status: 404 });
    }
    return NextResponse.json({ error: "mutation-failed" }, { status: 502 });
  }
}

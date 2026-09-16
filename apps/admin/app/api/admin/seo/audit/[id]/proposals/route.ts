import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { evaluateAdminAction } from "@/lib/admin/policy";
import { createSeoSuggestion } from "@/lib/admin/sanity-control";
import { getSeoProposalContext, runSeoAudit } from "@/lib/admin/seo-audit";
import { buildDeterministicSeoProposals } from "@/lib/admin/seo-proposals";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  const requestId = randomUUID();

  try {
    // Proposal generation must not mutate the article revision used for idempotency.
    const audit = await runSeoAudit(id, false);
    const contextData = await getSeoProposalContext(id);
    if (audit.sourceRevision !== contextData.revision) throw new Error("PROPOSAL_SOURCE_STALE");
    const proposals = buildDeterministicSeoProposals({
      focusKeyword: contextData.focusKeyword,
      currentSearchIntent: contextData.searchIntent,
      research: contextData.research,
      now: audit.auditedAt,
    });
    if (!proposals.length) return NextResponse.json({ error: "no-safe-proposal", requestId }, { status: 422 });

    const created = [];
    for (const proposal of proposals) {
      const suggestion = await createSeoSuggestion(
        {
          targetDocumentId: id,
          type: proposal.type,
          after: proposal.after,
          reason: proposal.reason,
          confidence: proposal.confidence,
          riskLevel: proposal.riskLevel,
          evidence: proposal.evidence,
          createdBy: identity.actor,
        },
        {
          actorType: identity.actorType,
          requestId,
          idempotentForAuditRevision: true,
          expectedTargetRevision: audit.sourceRevision,
        },
      );
      created.push({ id: suggestion._id, type: proposal.type, status: suggestion.status });
    }

    return NextResponse.json({ audit, proposals: created, requestId });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_ARTICLE_ID") {
      return NextResponse.json({ error: "invalid-article-id", requestId }, { status: 400 });
    }
    if (error instanceof Error && error.message === "ARTICLE_NOT_FOUND") {
      return NextResponse.json({ error: "article-not-found", requestId }, { status: 404 });
    }
    if (error instanceof Error && error.message === "TARGET_DRAFT_NOT_FOUND") {
      return NextResponse.json({ error: "target-draft-not-found", requestId }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PROPOSAL_SOURCE_STALE") {
      return NextResponse.json({ error: "proposal-source-stale", requestId }, { status: 409 });
    }
    return NextResponse.json({ error: "proposal-generation-failed", requestId }, { status: 502 });
  }
}

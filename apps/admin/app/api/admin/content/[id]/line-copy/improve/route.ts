import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import {
  applyImprovedLineCopyToDraft,
  readArticleLineCopyImprovementTarget,
} from "@/lib/admin/line/description-optimization";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { lineCardTextDescriptionSchema, lineCardTitleSchema } from "@/lib/local-ai/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

const revisions = {
  draftRevision: z.string().min(1).max(200),
  publishedRevision: z.string().min(1).max(200),
};
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("propose"), ...revisions, requestId: z.string().uuid() }).strict(),
  z.object({
    action: z.literal("accept"),
    ...revisions,
    lineTitle: lineCardTitleSchema,
    lineDescription: lineCardTextDescriptionSchema,
    proposalToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  }).strict(),
]);

const n8nResultSchema = z.object({
  status: z.enum(["generated", "skipped-existing", "error"]),
  lineTitle: z.string().optional(),
  lineDescription: z.string().optional(),
  repairAttempt: z.number().int().min(0).max(2).optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
  errorCategory: z.string().trim().min(1).max(120).optional(),
  errorMessage: z.string().trim().min(1).max(500).optional(),
}).strict();

function signProposal(secret: string, values: {
  id: string;
  draftRevision: string;
  publishedRevision: string;
  lineTitle: string;
  lineDescription: string;
}) {
  return createHmac("sha256", secret)
    .update("line-copy-improve-proposal-v1\0")
    .update(JSON.stringify([values.id, values.draftRevision, values.publishedRevision, values.lineTitle, values.lineDescription]))
    .digest("base64url");
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "LINE_COPY_DRAFT_REQUIRED") return NextResponse.json({ error: "line-copy-draft-required" }, { status: 409, headers });
  if (message === "LINE_COPY_PUBLISHED_REQUIRED" || message === "LINE_COPY_PUBLISHED_LINE_REQUIRED") {
    return NextResponse.json({ error: "line-copy-published-line-required" }, { status: 409, headers });
  }
  if (message === "LINE_COPY_CONFLICT") return NextResponse.json({ error: "line-copy-conflict" }, { status: 409, headers });
  if (message === "LINE_COPY_INVALID_REQUEST") return NextResponse.json({ error: "invalid-input" }, { status: 400, headers });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "line-copy-invalid-result" }, { status: 502, headers });
  return NextResponse.json({ error: "line-copy-unavailable" }, { status: 503, headers });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getAdminIdentity();
  if (!identity || identity.actorType !== "human" || identity.role !== "owner" || !hasAdminPermission(identity.role, "draft:apply")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-input" }, { status: 400, headers });
  const id = (await params).id;

  try {
    if (parsed.data.action === "accept") {
      const token = process.env.CCPUN_LOCAL_AI_N8N_TOKEN?.trim();
      if (!token || token.length < 43) return NextResponse.json({ error: "line-copy-orchestrator-unavailable" }, { status: 503, headers });
      const expected = signProposal(token, { id, ...parsed.data });
      if (!timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.data.proposalToken))) {
        return NextResponse.json({ error: "invalid-input" }, { status: 400, headers });
      }
      const applied = await applyImprovedLineCopyToDraft({ id, ...parsed.data });
      return NextResponse.json(applied, { headers });
    }

    const target = await readArticleLineCopyImprovementTarget(id);
    if (!target.draft) return NextResponse.json({ error: "line-copy-draft-required" }, { status: 409, headers });
    if (!target.published) return NextResponse.json({ error: "line-copy-published-line-required" }, { status: 409, headers });
    if (target.draft.revision !== parsed.data.draftRevision || target.published.revision !== parsed.data.publishedRevision) {
      return NextResponse.json({ error: "line-copy-conflict" }, { status: 409, headers });
    }
    const existingLineTitle = target.published.lineTitle?.trim();
    const existingLineDescription = target.published.lineDescription?.trim();
    if (!existingLineTitle || !existingLineDescription) {
      return NextResponse.json({ error: "line-copy-published-line-required" }, { status: 409, headers });
    }

    const token = process.env.CCPUN_LOCAL_AI_N8N_TOKEN?.trim();
    if (!token || token.length < 43) {
      return NextResponse.json({ error: "line-copy-orchestrator-unavailable" }, { status: 503, headers });
    }
    const baseUrl = process.env.CCPUN_LOCAL_AI_N8N_BASE_URL?.trim() || "https://n8n.srv908107.hstgr.cloud";
    let webhookUrl: URL;
    try {
      webhookUrl = new URL("/webhook/ccpun-line-card-generate", baseUrl);
    } catch {
      return NextResponse.json({ error: "line-copy-orchestrator-unavailable" }, { status: 503, headers });
    }
    if (webhookUrl.protocol !== "https:") {
      return NextResponse.json({ error: "line-copy-orchestrator-unavailable" }, { status: 503, headers });
    }

    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "improve-existing",
          requestId: parsed.data.requestId,
          triggerSource: "sanity",
          source: {
            id,
            revision: target.published.revision,
            slug: target.published.slug,
            title: target.published.title,
            category: target.published.category,
          },
          existingLineTitle,
          existingLineDescription,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(180_000),
      });
    } catch {
      return NextResponse.json({ error: "line-copy-orchestrator-timeout" }, { status: 504, headers });
    }

    const result = n8nResultSchema.safeParse(await response.json().catch(() => null));
    if (!response.ok || !result.success) {
      return NextResponse.json({ error: "line-copy-orchestrator-failed" }, { status: 502, headers });
    }
    if (result.data.status === "error") {
      return NextResponse.json({ error: "line-copy-generation-failed" }, { status: 502, headers });
    }
    if (result.data.status !== "generated" || !result.data.lineTitle || !result.data.lineDescription) {
      return NextResponse.json({ error: "line-copy-invalid-result" }, { status: 502, headers });
    }
    const lineTitle = lineCardTitleSchema.parse(result.data.lineTitle);
    const lineDescription = lineCardTextDescriptionSchema.parse(result.data.lineDescription);
    const latest = await readArticleLineCopyImprovementTarget(id);
    if (latest.draft?.revision !== target.draft.revision || latest.published?.revision !== target.published.revision) {
      return NextResponse.json({ error: "line-copy-conflict" }, { status: 409, headers });
    }
    return NextResponse.json({
      status: "proposed",
      draftRevision: target.draft.revision,
      publishedRevision: target.published.revision,
      currentLineTitle: existingLineTitle,
      currentLineDescription: existingLineDescription,
      draftLineTitle: target.draft.lineTitle,
      draftLineDescription: target.draft.lineDescription,
      lineTitle,
      lineDescription,
      proposalToken: signProposal(token, {
        id,
        draftRevision: target.draft.revision,
        publishedRevision: target.published.revision,
        lineTitle,
        lineDescription,
      }),
    }, { headers });
  } catch (error) {
    return failure(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import {
  applyGeneratedLineCopyToDraft,
  readArticleDraftLineCopy,
} from "@/lib/admin/line/description-optimization";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

const bodySchema = z.object({
  draftRevision: z.string().min(1).max(200),
  requestId: z.string().uuid(),
}).strict();

const n8nResultSchema = z.object({
  status: z.enum(["generated", "skipped-existing", "error"]),
  lineTitle: z.string().optional(),
  lineDescription: z.string().optional(),
  repairAttempt: z.number().int().min(0).max(2).optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
  errorCategory: z.string().trim().min(1).max(120).optional(),
  errorMessage: z.string().trim().min(1).max(500).optional(),
}).strict();

async function requireOwner() {
  const identity = await getAdminIdentity();
  if (!identity || identity.actorType !== "human" || identity.role !== "owner" || !hasAdminPermission(identity.role, "draft:apply")) return null;
  return identity;
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "LINE_COPY_DRAFT_REQUIRED") return NextResponse.json({ error: "line-copy-draft-required" }, { status: 409, headers });
  if (message === "LINE_COPY_CONFLICT") return NextResponse.json({ error: "line-copy-conflict" }, { status: 409, headers });
  if (message === "LINE_COPY_INVALID_REQUEST") return NextResponse.json({ error: "invalid-input" }, { status: 400, headers });
  if (message === "LINE_COPY_GENERATION_INCOMPLETE" || error instanceof z.ZodError) {
    return NextResponse.json({ error: "line-copy-invalid-result" }, { status: 502, headers });
  }
  return NextResponse.json({ error: "line-copy-unavailable" }, { status: 503, headers });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireOwner();
  if (!identity) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-input" }, { status: 400, headers });
  const id = (await params).id;

  try {
    const draft = await readArticleDraftLineCopy(id);
    if (!draft) return NextResponse.json({ error: "line-copy-draft-required" }, { status: 409, headers });
    if (draft.revision !== parsed.data.draftRevision) {
      return NextResponse.json({ error: "line-copy-conflict" }, { status: 409, headers });
    }

    const existingTitle = draft.lineTitle?.trim() ?? "";
    const existingDescription = draft.lineDescription?.trim() ?? "";
    const missingTitle = !existingTitle;
    const missingDescription = !existingDescription;
    if (!missingTitle && !missingDescription) {
      return NextResponse.json({ status: "skipped-existing", appliedFields: [], revision: draft.revision }, { headers });
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
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: parsed.data.requestId,
          triggerSource: "sanity",
          title: draft.title,
          body: draft.body,
          category: draft.category,
          source: {
            id,
            revision: draft.revision,
            slug: draft.slug,
            title: draft.title,
            category: draft.category,
          },
          existingLineTitle: existingTitle || null,
          existingLineDescription: existingDescription || null,
          missingTitle,
          missingDescription,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(150_000),
      });
    } catch {
      return NextResponse.json({ error: "line-copy-orchestrator-timeout" }, { status: 504, headers });
    }

    const payload = await response.json().catch(() => null);
    const result = n8nResultSchema.safeParse(payload);
    if (!response.ok || !result.success) {
      return NextResponse.json({ error: "line-copy-orchestrator-failed" }, { status: 502, headers });
    }
    if (result.data.status === "error") {
      return NextResponse.json({
        error: "line-copy-generation-failed",
        category: result.data.errorCategory ?? "model-output-invalid",
      }, { status: 502, headers });
    }
    if (result.data.status === "skipped-existing") {
      return NextResponse.json({ status: "skipped-existing", appliedFields: [], revision: draft.revision }, { headers });
    }

    const applied = await applyGeneratedLineCopyToDraft({
      id,
      revision: draft.revision,
      lineTitle: result.data.lineTitle,
      lineDescription: result.data.lineDescription,
    });
    return NextResponse.json({
      status: applied.status,
      appliedFields: "appliedFields" in applied ? applied.appliedFields : [],
      revision: applied.revision,
      repairAttempt: result.data.repairAttempt ?? 0,
      elapsedMs: result.data.elapsedMs ?? null,
    }, { headers });
  } catch (error) {
    return failure(error);
  }
}

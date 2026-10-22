import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentity } from "@/lib/admin/identity";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { isPostPublishAdminOriginAllowed } from "@/lib/admin/seo-intelligence/post-publish-origin";
import { resolveLineCopyN8nBridge } from "@/lib/admin/local-ai/service-auth";
import { applyArticleOverviewToDraft, articleOverviewResponseSchema, articleOverviewInferencePlan, ARTICLE_OVERVIEW_PROMPT_VERSION, readOrCreateArticleOverviewDraft } from "@/lib/admin/article-overview";
import { EDITORIAL_INSTRUCTION_VERSION, editorialInstructionSchema, resolveOverviewEditorialInstructions } from "@/lib/local-ai/editorial-instructions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
const input = z.object({ sourceRevision: z.string().min(1).max(200), requestId: z.string().uuid(), editorialInstructions: editorialInstructionSchema.optional() }).strict();
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getAdminIdentity();
  if (!identity || identity.actorType !== "human" || identity.role !== "owner" || !hasAdminPermission(identity.role, "draft:apply")) return fail("forbidden", 403);
  if (!isPostPublishAdminOriginAllowed(request, process.env, getAdminEnvironment())) return fail("invalid-origin", 403);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("invalid-input", 400);
  const bridge = resolveLineCopyN8nBridge(process.env);
  if (!bridge) return fail("overview-unavailable", 503);
  const token = bridge.lane === "admin-uat" ? bridge.token : process.env.CCPUN_LOCAL_AI_N8N_TOKEN?.trim();
  let url: URL;
  try { url = bridge.webhookUrl ?? new URL("/webhook/ccpun-line-card-generate", process.env.CCPUN_LOCAL_AI_N8N_BASE_URL?.trim() || "https://n8n.srv908107.hstgr.cloud"); }
  catch { return fail("overview-unavailable", 503); }
  if (!token || token.length < 43 || url.protocol !== "https:" || url.username || url.password) return fail("overview-unavailable", 503);
  try {
    const id = (await params).id;
    const draft = await readOrCreateArticleOverviewDraft(id, parsed.data.sourceRevision);
    if (draft.summary) return NextResponse.json({ status: "skipped-existing", revision: draft.revision, summary: draft.summary }, { headers });
    let response: Response;
    const editorialInstructions = resolveOverviewEditorialInstructions(parsed.data.editorialInstructions);
    const instructionHash = createHash("sha256").update(JSON.stringify([EDITORIAL_INSTRUCTION_VERSION, editorialInstructions])).digest("hex");
    const inferencePlan = articleOverviewInferencePlan(draft.source, editorialInstructions);
    try {
      response = await fetch(url, { method: "POST", redirect: "error", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(150_000), body: JSON.stringify({ mode: "article-overview", requestId: parsed.data.requestId, triggerSource: `sanity:${EDITORIAL_INSTRUCTION_VERSION}:${instructionHash}`, instructionHash, editorialInstructions, editorialInstructionVersion: EDITORIAL_INSTRUCTION_VERSION, inferenceProvider: inferencePlan.provider, promptVersion: ARTICLE_OVERVIEW_PROMPT_VERSION, sourceRevision: draft.revision, source: draft.source }) });
    } catch { return fail("overview-timeout", 504); }
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.status === "error") return fail(payload?.errorCategory === "model-unavailable" ? "overview-model-unavailable" : "overview-generation-failed", 502);
    const result = articleOverviewResponseSchema.safeParse(payload);
    if (!result.success || result.data.sourceRevision !== draft.revision || result.data.requestId !== parsed.data.requestId || result.data.instructionHash !== instructionHash) return fail("overview-invalid-result", 502);
    return NextResponse.json(await applyArticleOverviewToDraft(id, draft.revision, result.data.summary), { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "OVERVIEW_CONFLICT") return fail("overview-conflict", 409);
    if (code === "OVERVIEW_SOURCE_TOO_LARGE") return fail("overview-source-too-large", 413);
    if (code === "OVERVIEW_DRAFT_REQUIRED") return fail("overview-draft-required", 409);
    if (code === "OVERVIEW_INVALID_SOURCE" || error instanceof z.ZodError) return fail("invalid-input", 400);
    return fail("overview-unavailable", 503);
  }
}

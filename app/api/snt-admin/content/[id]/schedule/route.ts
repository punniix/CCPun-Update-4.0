import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { acknowledgeArticleSchedule, cancelArticleSchedule, getArticleScheduleState, markScheduleStartFailed, prepareArticleSchedule } from "@/lib/admin/article-scheduling";
import { ArticleScheduleError, articleIdSchema, cancelScheduleRequestSchema, scheduleRequestSchema as bodySchema, scheduleView } from "@/lib/admin/operations/article-schedule-contract";
import { bangkokLocalDateTimeToIso } from "@/cms/sanity/policy/article-scheduling";
import { scheduledArticlePublicationWorkflow } from "@/lib/admin/article-publication-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
async function requireScheduleIdentity() {
  const identity = await getAdminIdentity();
  if (!identity || identity.actorType !== "human" || identity.role !== "owner" || !hasAdminPermission(identity.role, "content:schedule")) return null;
  return identity;
}
function failure(error: unknown) {
  const code = error instanceof ArticleScheduleError ? error.code : "not-ready";
  const status = code === "conflict" || code === "article-not-ready" ? 409 : code === "invalid-request" ? 400 : code === "dispatch-failed" ? 502 : 503;
  return NextResponse.json({ error: code }, { status, headers });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireScheduleIdentity();
  if (!identity) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  const parsed = articleIdSchema.safeParse((await params).id);
  if (!parsed.success) return failure(new ArticleScheduleError("invalid-request"));
  try { return NextResponse.json(await getArticleScheduleState(parsed.data), { headers }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireScheduleIdentity();
  if (!identity) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  const id = articleIdSchema.safeParse((await params).id);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !parsed.success) return failure(new ArticleScheduleError("invalid-request"));
  const scheduledAt = bangkokLocalDateTimeToIso(parsed.data.scheduledLocal);
  if (!scheduledAt) return failure(new ArticleScheduleError("invalid-request"));
  try {
    const prepared = await prepareArticleSchedule({ ...parsed.data, articleId: id.data, scheduledAt, actor: identity.actor });
    if (!prepared.dispatch) return NextResponse.json({ schedule: scheduleView(prepared.row) }, { status: prepared.row.status === "preparing" ? 202 : 200, headers });
    try {
      // The framework integration statically discovers this server-side start call.
      const run = await start(scheduledArticlePublicationWorkflow, [{ articleId: id.data, generation: prepared.row.generation, scheduledAt }]);
      const schedule = await acknowledgeArticleSchedule(id.data, prepared.row.generation, run.runId);
      return NextResponse.json({ schedule }, { status: 201, headers });
    } catch {
      try { await markScheduleStartFailed(id.data, prepared.row.generation); } catch { /* An unacknowledged preparing row is never executable. */ }
      return failure(new ArticleScheduleError("dispatch-failed"));
    }
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireScheduleIdentity();
  if (!identity) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  const id = articleIdSchema.safeParse((await params).id);
  const parsed = cancelScheduleRequestSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !parsed.success) return failure(new ArticleScheduleError("invalid-request"));
  try {
    return NextResponse.json({ schedule: await cancelArticleSchedule(id.data, parsed.data.expectedGeneration, parsed.data.expectedVersion, identity.actor) }, { headers });
  } catch (error) { return failure(error); }
}

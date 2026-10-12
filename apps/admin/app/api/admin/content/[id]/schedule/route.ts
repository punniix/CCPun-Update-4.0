import { NextResponse } from "next/server";
import { getArticleScheduleResponse, deleteArticleScheduleResponse, readArticleSchedulePostRequest, articleScheduleFailure as failure, articleScheduleResponseHeaders as headers } from "@/lib/admin/article-schedule-handler";
import { acknowledgeArticleSchedule, markScheduleStartFailed, prepareArticleSchedule, registerNativeArticleSchedule } from "@/lib/admin/article-scheduling";
import { ArticleScheduleError, scheduleView } from "@/lib/admin/operations/article-schedule-contract";
import { getAdminCapabilityProfile } from "@/lib/admin/capability-profile";
import { getArticleScheduleBackend } from "@/lib/admin/article-schedule-clock";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (getAdminCapabilityProfile() !== "full") return NextResponse.json({ error: "not-found" }, { status: 404, headers });
  return getArticleScheduleResponse(request, context);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (getAdminCapabilityProfile() !== "full") return NextResponse.json({ error: "not-found" }, { status: 404, headers });
  const validated = await readArticleSchedulePostRequest(request, { params });
  if (!validated.ok) return validated.response;
  const { identity, id, parsed, scheduledAt } = validated;
  const backend = getArticleScheduleBackend();
  if (backend === "disabled") return failure(new ArticleScheduleError("not-ready"));
  try {
    const prepared = await prepareArticleSchedule({ ...parsed.data, articleId: id.data, scheduledAt, actor: identity.actor });
    if (!prepared.dispatch) return NextResponse.json({ schedule: scheduleView(prepared.row) }, { status: prepared.row.status === "preparing" ? 202 : 200, headers });
    try {
      let schedule;
      if (backend === "native-neon") {
        schedule = await registerNativeArticleSchedule(id.data, prepared.row.generation);
      } else {
        // Only the retained legacy lane loads the SDK's eager runtime imports.
        const { start } = await import("workflow/api");
        const { scheduledArticlePublicationWorkflow } = await import("@/lib/admin/article-publication-workflow");
        const run = await start(scheduledArticlePublicationWorkflow, [{ articleId: id.data, generation: prepared.row.generation, scheduledAt }]);
        schedule = await acknowledgeArticleSchedule(id.data, prepared.row.generation, run.runId);
      }
      return NextResponse.json({ schedule }, { status: 201, headers });
    } catch {
      try { await markScheduleStartFailed(id.data, prepared.row.generation); } catch { /* An unacknowledged preparing row is never executable. */ }
      return failure(new ArticleScheduleError("dispatch-failed"));
    }
  } catch (error) { return failure(error); }
}


export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (getAdminCapabilityProfile() !== "full") return NextResponse.json({ error: "not-found" }, { status: 404, headers });
  return deleteArticleScheduleResponse(request, context);
}

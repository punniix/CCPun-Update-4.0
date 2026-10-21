import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getArticleScheduleResponse, deleteArticleScheduleResponse, readArticleSchedulePostRequest, articleScheduleFailure as failure, articleScheduleResponseHeaders as headers } from "@/lib/admin/article-schedule-handler";
import { acknowledgeArticleSchedule, markScheduleStartFailed, prepareArticleSchedule } from "@/lib/admin/article-scheduling";
import { ArticleScheduleError, scheduleView } from "@/lib/admin/operations/article-schedule-contract";
import { scheduledArticlePublicationWorkflow } from "@/lib/admin/article-publication-workflow";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return getArticleScheduleResponse(request, context);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const validated = await readArticleSchedulePostRequest(request, { params });
  if (!validated.ok) return validated.response;
  const { identity, id, parsed, scheduledAt } = validated;
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


export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return deleteArticleScheduleResponse(request, context);
}

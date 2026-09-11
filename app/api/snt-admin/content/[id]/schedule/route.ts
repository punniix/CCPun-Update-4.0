import { NextResponse } from "next/server";
import { z } from "zod";
import { start } from "workflow/api";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import {
  cancelArticleSchedule,
  getArticleSchedule,
  markScheduleStartFailed,
  prepareArticleSchedule,
} from "@/lib/admin/article-scheduling";
import { scheduledArticlePublicationWorkflow } from "@/lib/admin/article-publication-workflow";
import { bangkokLocalDateTimeToIso } from "@/cms/sanity/policy/article-scheduling";

const bodySchema = z.object({
  scheduledLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
});

async function requireScheduleIdentity() {
  const identity = await getAdminIdentity();
  if (!identity || !hasAdminPermission(identity.role, "content:schedule")) return null;
  return identity;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireScheduleIdentity();
  if (!identity) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  return NextResponse.json({ schedule: await getArticleSchedule(id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireScheduleIdentity();
  if (!identity) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  const scheduledAt = bangkokLocalDateTimeToIso(parsed.data.scheduledLocal);
  if (!scheduledAt) return NextResponse.json({ error: "invalid-bangkok-time" }, { status: 400 });

  const { id } = await params;
  try {
    const prepared = await prepareArticleSchedule({ articleId: id, scheduledAt, createdByRole: identity.role });
    try {
      await start(scheduledArticlePublicationWorkflow, [{
        scheduleId: prepared.scheduleId,
        generation: prepared.generation,
        delaySeconds: prepared.delaySeconds,
      }]);
    } catch {
      await markScheduleStartFailed(prepared.scheduleId, prepared.generation);
      return NextResponse.json({ error: "workflow-start-failed" }, { status: 502 });
    }
    return NextResponse.json({ schedule: await getArticleSchedule(id) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "schedule-failed";
    const status = message.startsWith("SCHEDULE_BLOCKED:") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireScheduleIdentity();
  if (!identity) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  try {
    return NextResponse.json({ schedule: await cancelArticleSchedule(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "cancel-failed" }, { status: 400 });
  }
}

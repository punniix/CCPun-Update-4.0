import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { isPostPublishAdminOriginAllowed as isArticleScheduleOriginAllowed } from "@/lib/admin/seo-intelligence/post-publish-origin";
import { cancelArticleSchedule, getArticleScheduleState } from "@/lib/admin/article-scheduling";
import { ArticleScheduleError, articleIdSchema, cancelScheduleRequestSchema, scheduleRequestSchema as bodySchema, scheduleView } from "@/lib/admin/operations/article-schedule-contract";
import { bangkokLocalDateTimeToIso } from "@/cms/sanity/policy/article-scheduling";

export const articleScheduleResponseHeaders = { "Cache-Control": "private, no-store" };
const headers = articleScheduleResponseHeaders;
async function requireScheduleIdentity() {
  const identity = await getAdminIdentity();
  if (!identity || identity.actorType !== "human" || identity.role !== "owner" || !hasAdminPermission(identity.role, "content:schedule")) return null;
  return identity;
}
export function articleScheduleFailure(error: unknown) {
  const code = error instanceof ArticleScheduleError ? error.code : "not-ready";
  const status = code === "conflict" || code === "article-not-ready" ? 409 : code === "invalid-request" ? 400 : code === "dispatch-failed" ? 502 : 503;
  return NextResponse.json({ error: code }, { status, headers });
}

const failure = articleScheduleFailure;

export async function getArticleScheduleResponse(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireScheduleIdentity();
  if (!identity) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  const parsed = articleIdSchema.safeParse((await params).id);
  if (!parsed.success) return failure(new ArticleScheduleError("invalid-request"));
  try { return NextResponse.json(await getArticleScheduleState(parsed.data), { headers }); }
  catch (error) { return failure(error); }
}

export async function deleteArticleScheduleResponse(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireScheduleIdentity();
  if (!identity) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (!isArticleScheduleOriginAllowed(request, process.env, getAdminEnvironment())) return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  const id = articleIdSchema.safeParse((await params).id);
  const parsed = cancelScheduleRequestSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !parsed.success) return failure(new ArticleScheduleError("invalid-request"));
  try {
    return NextResponse.json({ schedule: await cancelArticleSchedule(id.data, parsed.data.expectedGeneration, parsed.data.expectedVersion, identity.actor) }, { headers });
  } catch (error) { return failure(error); }
}

export async function readArticleSchedulePostRequest(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireScheduleIdentity();
  if (!identity) return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403, headers }) };
  if (!isArticleScheduleOriginAllowed(request, process.env, getAdminEnvironment())) return { ok: false as const, response: NextResponse.json({ error: "invalid-origin" }, { status: 403, headers }) };
  const id = articleIdSchema.safeParse((await params).id);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !parsed.success) return { ok: false as const, response: failure(new ArticleScheduleError("invalid-request")) };
  const scheduledAt = bangkokLocalDateTimeToIso(parsed.data.scheduledLocal);
  if (!scheduledAt) return { ok: false as const, response: failure(new ArticleScheduleError("invalid-request")) };
  return { ok: true as const, identity, id, parsed, scheduledAt };
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { addAdvisorPrivateNote, readAdvisorPrivateNotes } from "@/lib/admin/line/advisor-workflow";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate", "X-Robots-Tag": "noindex, nofollow, noarchive" };
const noteSchema = z.object({ text: z.string().trim().min(1).max(4000) }).strict();

export async function GET(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || !hasAdminPermission(identity.role, "advisor:note")) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  const leadId = z.string().uuid().safeParse((await params).leadId);
  if (!leadId.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });
  const notes = await readAdvisorPrivateNotes(leadId.data);
  return NextResponse.json(notes, { status: notes.state === "unavailable" ? 503 : 200, headers });
}

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || !hasAdminPermission(identity.role, "advisor:note")) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  const leadId = z.string().uuid().safeParse((await params).leadId);
  const body = noteSchema.safeParse(await request.json().catch(() => null));
  if (!leadId.success || !body.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });
  try {
    return NextResponse.json(await addAdvisorPrivateNote({ leadId: leadId.data, actor: identity.actor, text: body.data.text }), { headers });
  } catch (error) {
    const status = error instanceof Error && error.message === "ADVISOR_NOTE_NOT_CONFIGURED" ? 503 : 503;
    return NextResponse.json({ error: "private-notes-not-configured" }, { status, headers });
  }
}

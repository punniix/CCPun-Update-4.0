import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { updateLineLeadStage } from "@/lib/admin/line/control-plane";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { LINE_CASE_STAGES } from "@/lib/line/ecosystem";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
const bodySchema = z.object({ stage: z.enum(LINE_CASE_STAGES) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || !hasAdminPermission(identity.role, "advisor:case:update")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }
  const leadId = z.string().uuid().safeParse((await params).leadId);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!leadId.success || !body.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });

  try {
    const result = await updateLineLeadStage({ leadId: leadId.data, stage: body.data.stage, actor: identity.actor });
    return NextResponse.json(result, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "LINE_STAGE_TRANSITION_INVALID" ? 409 : code === "LINE_STAGE_INVALID" ? 400 : 503;
    return NextResponse.json({ error: status === 409 ? "invalid-stage-transition" : status === 400 ? "invalid-request" : "stage-update-unavailable" }, { status, headers });
  }
}

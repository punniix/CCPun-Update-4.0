import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { enqueueLineAdminReply, getLineActivationStatus } from "@/lib/admin/line/control-plane";
import { sendLineOutboundById } from "@/lib/admin/line/provider";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
const bodySchema = z.object({
  text: z.string().trim().min(1).max(2000),
  requestId: z.string().uuid().optional(),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || !hasAdminPermission(identity.role, "advisor:reply")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }
  const activation = getLineActivationStatus();
  if (!activation.outboundEnabled) {
    return NextResponse.json({ error: "line-outbound-not-configured" }, { status: 503, headers });
  }
  const leadId = z.string().uuid().safeParse((await params).leadId);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!leadId.success || !body.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });

  try {
    const queued = await enqueueLineAdminReply({ leadId: leadId.data, text: body.data.text, actor: identity.actor, requestId: body.data.requestId });
    if (queued.outcome === "duplicate") {
      return NextResponse.json({ outcome: "duplicate", outboundId: queued.outboundId }, { status: 200, headers });
    }
    const sent = await sendLineOutboundById(queued.outboundId);
    if (sent.ok) return NextResponse.json({ outcome: "sent", outboundId: queued.outboundId }, { status: 200, headers });
    if (sent.status === "reconciliation_required") {
      return NextResponse.json({ outcome: "reconciliation_required", outboundId: queued.outboundId }, { status: 202, headers });
    }
    return NextResponse.json({ error: sent.status, outboundId: queued.outboundId }, { status: sent.status === "not_configured" ? 503 : 502, headers });
  } catch {
    return NextResponse.json({ error: "line-reply-unavailable" }, { status: 503, headers });
  }
}

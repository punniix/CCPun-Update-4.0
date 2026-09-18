import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { recordLineEvidenceAccess } from "@/lib/admin/line/conversation-archive";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

const bodySchema = z.object({
  action: z.literal("print"),
  itemCount: z.number().int().min(0).max(500),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || !hasAdminPermission(identity.role, "advisor:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }
  const leadId = z.string().uuid().safeParse((await params).leadId);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!leadId.success || !body.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });
  try {
    await recordLineEvidenceAccess({
      leadId: leadId.data,
      actor: identity.actor,
      action: "print",
      itemCount: body.data.itemCount,
    });
    return NextResponse.json({ outcome: "recorded" }, { headers });
  } catch {
    return NextResponse.json({ error: "evidence-audit-unavailable" }, { status: 503, headers });
  }
}

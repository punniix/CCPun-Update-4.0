import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentity } from "@/lib/admin/identity";
import { readLineCaseDetail } from "@/lib/admin/line/control-plane";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (!hasAdminPermission(identity.role, "advisor:read")) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  const parsed = z.string().uuid().safeParse((await params).leadId);
  if (!parsed.success) return NextResponse.json({ error: "invalid-lead" }, { status: 400, headers });

  const detail = await readLineCaseDetail(parsed.data);
  if (detail.unavailableReason === "lead_not_found") return NextResponse.json({ error: "not-found" }, { status: 404, headers });
  if (detail.unavailableReason) return NextResponse.json({ error: detail.unavailableReason }, { status: 503, headers });

  return NextResponse.json({
    item: detail.item,
    stageHistory: detail.stageHistory,
    transcript: detail.transcript,
    botDecision: detail.botDecision,
    status: detail.status,
  }, { headers });
}

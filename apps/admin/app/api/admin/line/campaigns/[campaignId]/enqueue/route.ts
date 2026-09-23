import { NextResponse } from "next/server";
import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { enqueueLineCampaign } from "@/lib/admin/line/campaigns";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate", "X-Robots-Tag": "noindex, nofollow, noarchive" };

export async function POST(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || !hasAdminPermission(identity.role, "campaign:write")) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  try { return NextResponse.json(await enqueueLineCampaign((await params).campaignId, identity.actor), { headers }); }
  catch { return NextResponse.json({ error: "campaign-enqueue-unavailable" }, { status: 503, headers }); }
}

import { NextResponse } from "next/server";
import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { listLineCampaigns, saveLineCampaign, lineCampaignProviderEnabled } from "@/lib/admin/line/campaigns";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate", "X-Robots-Tag": "noindex, nofollow, noarchive" };

export async function GET() {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (!hasAdminPermission(identity.role, "campaign:read")) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  try {
    return NextResponse.json({ campaigns: await listLineCampaigns(), providerSendEnabled: lineCampaignProviderEnabled() }, { headers });
  } catch {
    return NextResponse.json({ error: "campaign-runtime-unavailable" }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || !hasAdminPermission(identity.role, "campaign:write")) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  const body = await request.json().catch(() => null);
  try {
    return NextResponse.json(await saveLineCampaign(body, identity.actor), { status: 201, headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "CAMPAIGN_INVALID" ? "invalid-request" : "campaign-save-unavailable" }, { status: error instanceof Error && error.message === "CAMPAIGN_INVALID" ? 400 : 503, headers });
  }
}
